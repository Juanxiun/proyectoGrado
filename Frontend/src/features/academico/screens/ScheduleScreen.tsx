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
import { useResponsive } from '../../../utils/responsive';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

type ScheduleRow = {
  id: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  materia?: { nombre?: string };
  aula?: { nombre?: string };
  maestro?: { nombre?: string; apellidoPaterno?: string };
  curso?: { nivel: string; grado: string; paralelo: string };
  turno?: { codigo: 'manana' | 'tarde'; nombre: string };
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
  const { isMobile } = useResponsive();
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
  const [selectedDayIndex, setSelectedDayIndex] = useState(Math.max(0, Math.min(4, new Date().getDay() - 1)));
  const [weekOffset, setWeekOffset] = useState(0);

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
      if (!id || isTeacher) {
        const periods = await academicManagementApi.listPeriods(isScheduleManager ? {} : { activo: 'true' });
        const options = (periods.data ?? []) as Array<{ id: string; anio: number; nombre: string; activo: boolean; estado: string }>;
        setPeriodOptions(options);
        const currentYear = new Date().getFullYear();
        const requested = options.find((period) => String(period.id) === String(id));
        const preferred = isTeacher && requested?.activo ? requested
          : options.find((period) => period.anio === currentYear && !period.activo)
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
      } else if (isTeacher && user) {
        filters.maestroId = String(user.maestroId ?? user.id);
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
  const weekDates = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + weekOffset * 7);
    return DAYS.map((day, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { day, number: date.getDate(), date };
    });
  }, [weekOffset]);

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

  if (isMobile && isStudent) return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
      <View className="rounded-2xl overflow-hidden bg-[#801F3F] flex-row min-h-36">
        <View className="flex-1 p-4 justify-center"><Text className="self-start rounded-full bg-[#F3D9B7] px-2.5 py-1 text-[#801F3F] text-[9px] font-extrabold">{weekDates[0].date.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }).toUpperCase()}</Text><Text className="text-white text-xl font-black mt-2">Tu semana de clases</Text><Text className="text-white/75 text-[10px] mt-1">Organiza tus clases y llega a tiempo.</Text><Text className="text-[#F3D9B7] text-[10px] font-bold mt-3">{rows.length} sesiones programadas</Text></View>
        <View className="w-24 bg-white/10 items-center justify-center"><Ionicons name="calendar" size={42} color="#F3D9B7" /></View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-[#F3D9B7] p-3.5"><Ionicons name="notifications-outline" size={17} color="#801F3F"/><Text className="text-[#801F3F] text-[10px] font-extrabold mt-2">RECORDATORIO</Text><Text className="text-[#801F3F] text-[10px] mt-1">Revisa tus próximas clases.</Text></View>
        <View className="flex-1 rounded-2xl bg-[#FBF5EC] p-3.5"><Ionicons name="time-outline" size={17} color="#801F3F"/><Text className="text-[#801F3F] text-[10px] font-extrabold mt-2">HORARIO PUBLICADO</Text><Text className="text-gray-600 text-[10px] mt-1">{rows.length ? 'Consulta el itinerario del día.' : 'Aún no hay clases asignadas.'}</Text></View>
      </View>
      <View className="flex-row items-center justify-between px-1 mt-1"><Text className="text-[#801F3F] text-sm font-extrabold">SELECTOR DE DÍA</Text><View className="flex-row gap-4"><TouchableOpacity onPress={() => setWeekOffset((value) => value - 1)}><Ionicons name="chevron-back" size={19} color="#801F3F" /></TouchableOpacity><TouchableOpacity onPress={() => setWeekOffset((value) => value + 1)}><Ionicons name="chevron-forward" size={19} color="#801F3F" /></TouchableOpacity></View></View>
      <View className="flex-row rounded-2xl bg-[#FBF5EC] p-2 border border-[#EFE6DB]">
        {weekDates.map((item, index) => <TouchableOpacity key={item.day} onPress={() => setSelectedDayIndex(index)} className={`flex-1 rounded-xl items-center py-2 ${selectedDayIndex === index ? 'bg-[#801F3F]' : ''}`}><Text className={`text-[9px] font-bold ${selectedDayIndex === index ? 'text-white/80' : 'text-gray-500'}`}>{item.day.slice(0, 3).toUpperCase()}</Text><Text className={`text-base font-black mt-1 ${selectedDayIndex === index ? 'text-white' : 'text-gray-700'}`}>{item.number}</Text>{selectedDayIndex === index && <View className="w-1 h-1 bg-[#F3D9B7] rounded-full mt-1"/>}</TouchableOpacity>)}
      </View>
      <View className="flex-row items-center justify-between px-1 mt-2"><Text className="text-[#801F3F] text-sm font-extrabold">ITINERARIO DE HOY</Text><View className="rounded-full bg-[#F2E8EC] px-2 py-1"><Text className="text-[#801F3F] text-[9px] font-bold">{grouped[selectedDayIndex]?.rows.length ?? 0} SESIONES</Text></View></View>
      {(grouped[selectedDayIndex]?.rows ?? []).length === 0 ? <View className="rounded-2xl bg-white border border-gray-200 items-center py-10"><Ionicons name="calendar-clear-outline" size={32} color="#A94E6D"/><Text className="text-gray-700 text-sm font-bold mt-2">Día libre</Text><Text className="text-gray-500 text-xs mt-1">No tienes clases programadas este día.</Text></View> : (grouped[selectedDayIndex]?.rows ?? []).map((row, index) => <View key={row.id} className={`rounded-2xl p-4 border ${index === 0 ? 'bg-[#FBF5EC] border-[#E8D2B6]' : 'bg-white border-gray-200'}`}><View className="flex-row items-center justify-between"><View className="flex-row items-center gap-2"><View className={`w-8 h-8 rounded-lg items-center justify-center ${index === 0 ? 'bg-[#801F3F]' : 'bg-gray-100'}`}><Ionicons name={index === 0 ? 'time' : 'time-outline'} size={16} color={index === 0 ? '#FFFFFF' : '#6B7280'}/></View><View><Text className="text-gray-500 text-[9px] font-bold">{row.horaInicio} - {row.horaFin}</Text><Text className="text-[#801F3F] text-[9px] font-extrabold mt-0.5">{index === 0 ? 'PRÓXIMA CLASE' : 'CLASE PROGRAMADA'}</Text></View></View><View className="rounded-full bg-[#801F3F] px-2 py-1"><Text className="text-white text-[9px] font-bold">{row.turno?.nombre ?? 'Clase'}</Text></View></View><Text className="text-[#801F3F] text-base font-bold mt-3">{row.materia?.nombre ?? 'Materia'}</Text><Text className="text-gray-500 text-xs mt-1">{row.maestro?.nombre ? `${row.maestro.nombre} ${row.maestro.apellidoPaterno ?? ''}` : 'Docente asignado'}</Text><View className="border-t border-gray-200 mt-3 pt-3 flex-row items-center justify-between"><View className="flex-row items-center gap-1.5"><Ionicons name="location-outline" size={13} color="#801F3F"/><Text className="text-gray-600 text-[10px]">{row.aula?.nombre ?? 'Aula por confirmar'}</Text></View><Text className="text-[#801F3F] text-[9px] font-bold">{row.curso ? `${row.curso.grado}° ${row.curso.paralelo}` : ''}</Text></View></View>)}
      <View className="rounded-2xl bg-[#F8F7F6] border border-dashed border-gray-300 p-4 flex-row items-center gap-3"><Ionicons name="information-circle-outline" size={22} color="#801F3F"/><View className="flex-1"><Text className="text-gray-800 text-xs font-bold">¿Cambió tu horario?</Text><Text className="text-gray-500 text-[10px] mt-1">Contacta a servicios académicos para consultar ajustes.</Text></View><Ionicons name="arrow-forward" size={15} color="#801F3F"/></View>
    </ScrollView>
  );

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
                  const turno = row.turno?.nombre ?? (row.turno?.codigo === 'tarde' ? 'Turno tarde' : 'Turno mañana');
                  return (
                    <View key={row.id} className="flex-row items-center justify-between bg-gray-50 p-3 rounded-2xl border border-gray-100">
                      <View className="flex-row items-center gap-3 flex-1 mr-2">
                        <View className={`w-9 h-9 rounded-xl ${fallback.bg} items-center justify-center shadow-sm`}>
                          <Ionicons name={fallback.icon} size={16} color="#FFFFFF" />
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-xs font-bold text-gray-800 flex-1 min-w-0" numberOfLines={1} ellipsizeMode="tail">{row.curso ? `${row.curso.grado}° ${row.curso.paralelo} · ` : ''}{row.materia?.nombre ?? 'Materia'}</Text>
                          <Text className="text-[11px] text-gray-500 mt-0.5" numberOfLines={1} ellipsizeMode="tail">
                            {turno} · {row.aula?.nombre ?? 'Aula asignada'}
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
