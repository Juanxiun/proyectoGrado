import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicManagementApi, academicServicesApi } from '../../../api/academicServices.api';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { InteractiveScheduleBuilder } from '../components/InteractiveScheduleBuilder';
import { getFallbackGradient } from '../components/CoverImagePicker';
import { useRealtimeResource } from '../../../hooks/useRealtimeResource';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

type ScheduleRow = {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  materia?: { nombre?: string };
  aula?: { nombre?: string };
  maestro?: { nombre?: string; apellidoPaterno?: string };
  cursoPeriodoId: string;
};

type CourseOption = {
  id: string;
  label: string;
  nivel: string;
  grado: string;
  paralelo: string;
  turno?: string;
};

export function ScheduleScreen({ onNavigate, initialPeriodoId }: { onNavigate?: (route: string) => void; initialPeriodoId?: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodoId, setPeriodoId] = useState(String(initialPeriodoId ?? user?.periodoId ?? ''));
  const [periodOptions, setPeriodOptions] = useState<Array<{ id: string; anio: number; nombre: string; activo: boolean; estado: string }>>([]);

  // Multicurso monitor para Director / Control / Admin
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [nivelTab, setNivelTab] = useState<'primaria' | 'secundaria'>('primaria');
  const [selectedCourseForEdit, setSelectedCourseForEdit] = useState<string | undefined>(undefined);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);

  // Modo construcción de horarios para dirección, control y administración
  const [showBuilder, setShowBuilder] = useState(false);

  const role = (user?.rol ?? '').toLowerCase();
  const isStudent = role.includes('estudiante') || role.includes('alumno');
  const isTeacher = role.includes('profesor') || role.includes('maestro') || role.includes('docente');
  const isDirectorOrControl = ['director', 'control', 'gerencia', 'administrativo', 'secretaria', 'secretario', 'editor'].includes(role);
  const isAdmin = role === 'admin' || role === 'administrador';
  const isScheduleManager = isDirectorOrControl || isAdmin;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let id = periodoId;
      if (!id) {
        const periods = await academicManagementApi.listPeriods(isScheduleManager ? {} : { activo: 'true' });
        const options = (periods.data ?? []) as Array<{ id: string; anio: number; nombre: string; activo: boolean; estado: string }>;
        setPeriodOptions(options);
        const currentYear = new Date().getFullYear();
        const preferred = options.find((period) => period.anio === currentYear && !period.activo)
          ?? options.find((period) => period.anio === currentYear && period.activo)
          ?? options.find((period) => period.activo)
          ?? options[0];
        id = String(preferred?.id ?? '');
        setPeriodoId(id);
      }
      if (!id) return;

      // Cargar lista de cursos para el selector multicurso si es director, control o admin
      if (isDirectorOrControl || isAdmin) {
        const cpRes = await academicServicesApi.list('cursos-periodo', { periodoId: id, estado: 'activo', limit: 100 });
        const rawCps = (cpRes.data ?? []) as Array<Record<string, any>>;
        const opts: CourseOption[] = rawCps.map((cp) => {
          const grado = cp.curso?.grado ?? cp.grado ?? '';
          const paralelo = cp.curso?.paralelo ?? cp.paralelo ?? '';
          const nivel = (cp.curso?.nivel ?? cp.nivel ?? '').toUpperCase();
          return {
            id: String(cp.id),
            label: `${grado} ${paralelo} - ${nivel}`.trim(),
            nivel: cp.curso?.nivel ?? cp.nivel ?? '',
            grado,
            paralelo,
            turno: String(cp.turnoCodigo ?? cp.turno?.codigo ?? 'manana').toLowerCase(),
          };
        });
        setCourses(opts);
      }

      // Parámetros según rol
      const filters: Record<string, string | undefined> = {};
      if (isStudent && user?.cursoPeriodoId) {
        filters.cursoPeriodoId = String(user.cursoPeriodoId);
      } else if (isTeacher && user?.maestroId) {
        filters.maestroId = String(user.maestroId);
      }

      const response = await academicManagementApi.listSchedules(id, filters);
      setRows(response as ScheduleRow[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [periodoId, isStudent, isTeacher, isDirectorOrControl, isAdmin, user]);

  useEffect(() => {
    if (initialPeriodoId) setPeriodoId(initialPeriodoId);
  }, [initialPeriodoId]);

  useEffect(() => {
    if (!isScheduleManager || periodOptions.length) return;
    void academicManagementApi.listPeriods({}).then((response) => {
      const options = (response.data ?? []) as Array<{ id: string; anio: number; nombre: string; activo: boolean; estado: string }>;
      setPeriodOptions(options);
      setPeriodoId((current) => {
        if (current && options.some((option) => option.id === current)) return current;
        const currentYear = new Date().getFullYear();
        return String(options.find((option) => option.anio === currentYear && !option.activo)?.id
          ?? options.find((option) => option.anio === currentYear)?.id
          ?? options[0]?.id
          ?? '');
      });
    }).catch(() => undefined);
  }, [isScheduleManager, periodOptions.length]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const refreshFromRealtime = useCallback(() => {
    void loadData();
  }, [loadData]);
  useRealtimeResource('horarios', refreshFromRealtime);
  useRealtimeResource('periodos', refreshFromRealtime);

  const grouped = useMemo(() => DAYS.map((day, index) => ({
    day,
    rows: rows.filter((row) => row.diaSemana === index + 1).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
  })), [rows]);

  const courseCards = useMemo(() => courses.map((course) => ({
    ...course,
    rows: rows
      .filter((row) => row.cursoPeriodoId === course.id)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
  })), [courses, rows]);

  const primariaCards = useMemo(() => courseCards.filter((c) => c.nivel.toLowerCase().includes('primaria')), [courseCards]);
  const secundariaCards = useMemo(() => courseCards.filter((c) => c.nivel.toLowerCase().includes('secundaria')), [courseCards]);
  const displayedCards = nivelTab === 'primaria' ? primariaCards : secundariaCards;
  const selectedScheduleCourse = displayedCards.find((course) => course.id === expandedCourseId);

  const handleOpenBuilderForCourse = (courseId: string) => {
    setSelectedCourseForEdit(courseId);
    setShowBuilder(true);
  };

  if (loading && !rows.length) {
    return (
      <View className="p-8 items-center justify-center">
        <ActivityIndicator color="#801529" size="large" />
        <Text className="text-xs text-gray-500 mt-2">Cargando horario...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-8">
      {/* Header y Acciones de Horarios */}
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <View>
            <Text className="text-xl font-bold text-gray-900">
              {isStudent
                ? `Mi Horario de Clases`
                : isTeacher
                ? `Mi Agenda Semanal de Clases`
                : `Monitoreo de Horarios por Curso`}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {isStudent && user?.grado && user?.paralelo
                ? `Curso: ${user.grado} ${user.paralelo}`
                : isTeacher
                ? `Consolidado de clases asignadas · Lunes a Viernes`
                : `Seleccione un curso para consultar su horario y editarlo`}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <StatusBadge label={rows.length ? 'Publicado' : 'Sin horario'} variant={rows.length ? 'success' : 'warning'} />
          </View>
        </View>

        {/* Pestañas de Nivel (Primaria / Secundaria) para gestores de horarios cuando no está en builder */}
        {isScheduleManager && !showBuilder && (
          <View className="flex-row items-center gap-2 mt-4 pt-3 border-t border-gray-100">
            <TouchableOpacity
              onPress={() => setNivelTab('primaria')}
              className={`flex-row items-center gap-2 px-4 py-2 rounded-xl border ${
                nivelTab === 'primaria'
                  ? 'bg-maroon border-maroon shadow-sm'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Ionicons
                name="school-outline"
                size={16}
                color={nivelTab === 'primaria' ? '#FFFFFF' : '#374151'}
              />
              <Text
                className={`text-xs font-bold ${
                  nivelTab === 'primaria' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Primaria
              </Text>
              <View
                className={`px-1.5 py-0.5 rounded-full ${
                  nivelTab === 'primaria' ? 'bg-white/20' : 'bg-gray-200'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    nivelTab === 'primaria' ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {primariaCards.length}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setNivelTab('secundaria')}
              className={`flex-row items-center gap-2 px-4 py-2 rounded-xl border ${
                nivelTab === 'secundaria'
                  ? 'bg-maroon border-maroon shadow-sm'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Ionicons
                name="book-outline"
                size={16}
                color={nivelTab === 'secundaria' ? '#FFFFFF' : '#374151'}
              />
              <Text
                className={`text-xs font-bold ${
                  nivelTab === 'secundaria' ? 'text-white' : 'text-gray-700'
                }`}
              >
                Secundaria
              </Text>
              <View
                className={`px-1.5 py-0.5 rounded-full ${
                  nivelTab === 'secundaria' ? 'bg-white/20' : 'bg-gray-200'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    nivelTab === 'secundaria' ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {secundariaCards.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {isScheduleManager && periodOptions.length > 0 && (
          <View className="mt-4 pt-3 border-t border-gray-100 gap-2">
            <Text className="text-xs font-bold text-gray-700">Gestión académica</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {periodOptions.map((period) => (
                  <TouchableOpacity
                    key={period.id}
                    onPress={() => setPeriodoId(period.id)}
                    className={`px-3 py-2 rounded-xl border ${periodoId === period.id ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'}`}
                  >
                    <Text className={`text-xs font-bold ${periodoId === period.id ? 'text-white' : 'text-gray-700'}`}>
                      {period.nombre} · {period.anio}
                    </Text>
                    <Text className={`text-[10px] ${periodoId === period.id ? 'text-white/80' : 'text-gray-400'}`}>
                      {period.activo ? 'Activa' : 'Configuración'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </BentoCard>

      {/* Si está en modo Construcción de horarios */}
      {showBuilder && isScheduleManager ? (
        <InteractiveScheduleBuilder
          periodoId={periodoId}
          initialCourseId={selectedCourseForEdit}
          onSaved={() => {
            void loadData();
          }}
          onNavigateToInscripciones={() => {
            onNavigate?.('Inscripciones');
          }}
          onClose={() => {
            setShowBuilder(false);
          }}
        />
      ) : isScheduleManager ? (
        <>
        <View className="flex-row flex-wrap justify-center gap-4">
          {displayedCards.length === 0 ? (
            <BentoCard className="p-5 items-center">
              <Ionicons name="alert-circle-outline" size={32} color="#9CA3AF" />
              <Text className="text-sm font-bold text-gray-800 mt-2">
                No hay cursos de {nivelTab === 'primaria' ? 'Primaria' : 'Secundaria'} registrados
              </Text>
              <Text className="text-xs text-gray-500 mt-1 text-center">
                Genere la estructura de la gestión académica antes de monitorear o editar horarios.
              </Text>
            </BentoCard>
          ) : displayedCards.map((course) => {
            return (
            <BentoCard key={course.id} className="flex-1 min-w-[280px] max-w-[520px] p-0 overflow-hidden">
              <TouchableOpacity
                onPress={() => setExpandedCourseId(course.id)}
                className="flex-row items-center gap-3 p-4 bg-white"
                accessibilityLabel={`Ver horario de ${course.label}`}
              >
                <View className="w-11 h-11 rounded-2xl bg-maroon/10 items-center justify-center">
                  <Ionicons name="calendar-outline" size={20} color="#801529" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="font-bold text-maroon text-sm" numberOfLines={2} ellipsizeMode="tail">{course.label}</Text>
                  <Text className="text-[11px] text-gray-500 mt-1">
                    {course.rows.length} {course.rows.length === 1 ? 'clase asignada' : 'clases asignadas'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#801529" />
              </TouchableOpacity>
            </BentoCard>
            );
          })}
        </View>
        <Modal
          visible={Boolean(selectedScheduleCourse)}
          transparent
          animationType="fade"
          onRequestClose={() => setExpandedCourseId(null)}
        >
          <View className="flex-1 bg-black/50 items-center justify-center p-4">
            <View className="w-full max-w-5xl max-h-[90%] bg-white rounded-3xl overflow-hidden shadow-2xl">
              <View className="flex-row items-center justify-between p-5 border-b border-gray-100">
                <View className="flex-1 min-w-0 mr-3">
                  <Text className="text-lg font-bold text-maroon" numberOfLines={1}>
                    {selectedScheduleCourse?.label}
                  </Text>
                  <Text className="text-xs text-gray-500 mt-1">Horario semanal · {selectedScheduleCourse?.rows.length ?? 0} clases</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setExpandedCourseId(null)}
                  className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
                  accessibilityLabel="Cerrar horario"
                >
                  <Ionicons name="close" size={21} color="#374151" />
                </TouchableOpacity>
              </View>
              <ScrollView className="p-5" contentContainerStyle={{ paddingBottom: 20 }}>
                {!selectedScheduleCourse?.rows.length ? (
                  <Text className="text-sm text-gray-500 text-center py-10">Este curso aun no tiene clases programadas.</Text>
                ) : (
                  <View className="flex-row flex-wrap justify-center gap-3">
                    {DAYS.map((day, index) => {
                      const dayRows = selectedScheduleCourse.rows.filter((row) => row.diaSemana === index + 1);
                      return (
                        <View key={day} className="flex-1 min-w-[220px] max-w-[330px] bg-gray-50 rounded-2xl border border-gray-100 p-3">
                          <Text className="text-xs font-bold text-maroon mb-2">{day}</Text>
                          {!dayRows.length ? (
                            <Text className="text-xs text-gray-400 py-2">Sin clases</Text>
                          ) : dayRows.map((row) => (
                            <View key={row.id} className="bg-white rounded-xl border border-gray-100 p-3 mb-2">
                              <Text className="text-xs font-bold text-gray-800" numberOfLines={1}>
                                {row.materia?.nombre ?? 'Materia'}
                              </Text>
                              <Text className="text-[11px] text-gray-500 mt-1">{row.horaInicio} - {row.horaFin}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
              <View className="flex-row justify-end p-4 border-t border-gray-100">
                <TouchableOpacity
                  onPress={() => handleOpenBuilderForCourse(selectedScheduleCourse!.id)}
                  disabled={!selectedScheduleCourse}
                  className="flex-row items-center gap-2 rounded-xl bg-maroon px-5 py-3"
                >
                  <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">
                    {selectedScheduleCourse?.rows.length ? 'Editar horario' : 'Crear horario'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        </>
      ) : (
        <View className="flex-row flex-wrap justify-center gap-4">
        {grouped.map((group) => (
          <BentoCard key={group.day} className="flex-1 min-w-[260px] max-w-[440px] p-4">
            <View className="flex-row items-center justify-between mb-3 border-b border-gray-100 pb-2">
              <Text className="font-bold text-maroon text-sm">{group.day.toUpperCase()}</Text>
              <Text className="text-[11px] text-gray-500 font-medium">
                {group.rows.length} {group.rows.length === 1 ? 'clase' : 'clases'}
              </Text>
            </View>
            {group.rows.length === 0 ? (
              <Text className="text-xs text-gray-400 py-2 italic">Sin clases programadas para este día</Text>
            ) : (
              <View className="gap-2">
                {group.rows.map((row) => {
                  const fallback = getFallbackGradient(row.materia?.nombre);
                  return (
                    <View key={row.id} className="flex-row items-center justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <View className="flex-row items-center gap-3 flex-1 mr-2">
                        <View className={`w-9 h-9 rounded-xl ${fallback.bg} items-center justify-center shadow-sm`}>
                          <Ionicons name={fallback.icon} size={16} color="#FFFFFF" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs font-bold text-gray-800 flex-1 min-w-0" numberOfLines={1} ellipsizeMode="tail">{row.materia?.nombre ?? 'Materia'}</Text>
                          <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                            {row.aula?.nombre ?? 'Aula asignada'}
                            {row.maestro?.nombre ? ` · Prof. ${row.maestro.nombre} ${row.maestro.apellidoPaterno ?? ''}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View className="items-end bg-white px-2.5 py-1.5 rounded-xl border border-gray-200">
                        <Text className="text-xs font-bold text-maroon">{row.horaInicio} - {row.horaFin}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </BentoCard>
        ))}
        </View>
      )}
    </ScrollView>
  );
}
