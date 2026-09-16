import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { useResponsive } from '../../../utils/responsive';

interface CursoGroup {
  cursoPeriodoId: string;
  cursoId?: string;
  grado: string;
  paralelo: string;
  nivel: string;
  anio?: string | number;
  materias: { id: string; nombre: string; asignacionId: string }[];
}

interface EstudianteInscrito {
  id: string;
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno?: string;
  numeroDoc?: string;
  estado: string;
  fechaInscripcion?: string;
}

export function MaestroCursosScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cursos, setCursos] = useState<CursoGroup[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<CursoGroup | null>(null);

  // Modal de estudiantes
  const [studentsModalOpen, setStudentsModalOpen] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [students, setStudents] = useState<EstudianteInscrito[]>([]);
  const [searchStudent, setSearchStudent] = useState('');

  const loadCursos = async () => {
    try {
      setLoading(true);
      // Intentar cargar asignaciones desde el backend
      const res = await academicServicesApi.list('asignaciones', {
        limit: 200,
      });

      const allAsignaciones = res.data as any[];

      // Filtrar por el maestro autenticado (por maestroId, usuarioId o nombre)
      const teacherAsignaciones = allAsignaciones.filter((asig) => {
        if (!user) return false;
        const m = asig.maestro;
        if (!m) return true; // Fallback seguro
        if (user.maestroId && String(asig.maestroId) === String(user.maestroId)) return true;
        if (String(m.usuarioId) === String(user.id)) return true;
        if (
          user.nombre &&
          m.nombre &&
          String(m.nombre).toLowerCase() === user.nombre.toLowerCase() &&
          String(m.apellidoPaterno ?? '').toLowerCase() === (user.apellidoPaterno ?? '').toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      // Si no encontró por filtro estricto pero el usuario tiene cursos en el token:
      const sourceAsignaciones = teacherAsignaciones.length > 0
        ? teacherAsignaciones
        : (user?.cursos?.map((c) => ({
            id: c.asignacionId,
            cursoPeriodoId: (c as any).cursoPeriodoId ?? c.cursoId,
            materia: { id: c.materiaId, nombre: c.materia },
            cursoPeriodo: {
              id: (c as any).cursoPeriodoId ?? c.cursoId,
              curso: { grado: c.grado, paralelo: c.paralelo, nivel: c.nivel },
              periodo: { anio: c.anio },
            },
          })) ?? allAsignaciones);

      // Agrupar por cursoPeriodoId
      const map = new Map<string, CursoGroup>();

      for (const item of sourceAsignaciones) {
        const cpId = String(item.cursoPeriodoId || item.cursoPeriodo?.id || 'sin-id');
        const cursoInfo = item.cursoPeriodo?.curso || {};
        const grado = cursoInfo.grado || item.grado || '1';
        const paralelo = cursoInfo.paralelo || item.paralelo || 'A';
        const nivel = cursoInfo.nivel || item.nivel || 'Secundaria';
        const anio = item.cursoPeriodo?.periodo?.anio || item.periodo?.anio || new Date().getFullYear();

        const materiaNombre = item.materia?.nombre || item.materiaNombre || 'Materia';
        const materiaId = String(item.materia?.id || item.materiaId || '0');
        const asignacionId = String(item.id || '0');

        if (!map.has(cpId)) {
          map.set(cpId, {
            cursoPeriodoId: cpId,
            cursoId: String(cursoInfo.id || ''),
            grado,
            paralelo,
            nivel,
            anio,
            materias: [],
          });
        }

        const current = map.get(cpId)!;
        if (!current.materias.some((m) => m.id === materiaId)) {
          current.materias.push({ id: materiaId, nombre: materiaNombre, asignacionId });
        }
      }

      setCursos(Array.from(map.values()));
    } catch (err) {
      console.error('Error cargando cursos de maestro:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCursos();
  }, [user?.id]);

  const handleOpenCourseStudents = async (curso: CursoGroup) => {
    setSelectedCurso(curso);
    setStudentsModalOpen(true);
    setLoadingStudents(true);
    setSearchStudent('');
    try {
      // Buscar nómina de alumnos inscritos en este cursoPeriodo
      const res = await academicServicesApi.list('inscripciones', {
        cursoPeriodoId: curso.cursoPeriodoId,
        limit: 150,
      });

      const list: EstudianteInscrito[] = (res.data as any[]).map((row) => ({
        id: String(row.id),
        estudianteId: String(row.estudianteId || row.estudiante?.id || ''),
        nombre: row.estudiante?.nombre || row.nombre || 'Estudiante',
        apellidoPaterno: row.estudiante?.apellidoPaterno || row.apellidoPaterno || '',
        apellidoMaterno: row.estudiante?.apellidoMaterno || row.apellidoMaterno || '',
        numeroDoc: row.estudiante?.numeroDoc || row.numeroDoc || 'Sin CI',
        estado: row.estado || 'activo',
        fechaInscripcion: row.fechaInscripcion,
      }));

      setStudents(list);
    } catch (err) {
      console.error('Error al cargar nómina de estudiantes:', err);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchStudent.trim()) return students;
    const q = searchStudent.toLowerCase();
    return students.filter((s) =>
      `${s.apellidoPaterno} ${s.apellidoMaterno} ${s.nombre} ${s.numeroDoc}`.toLowerCase().includes(q),
    );
  }, [students, searchStudent]);

  return (
    <View className="flex-1 gap-4">
      {/* Header Banner */}
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Mis Cursos y Paralelos</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Consulta los cursos a tu cargo y visualiza la nómina oficial de alumnos matriculados.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setRefreshing(true);
              loadCursos();
            }}
            className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200"
          >
            <Ionicons name="refresh-outline" size={20} color="#801529" />
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* Listado de cursos */}
      {loading ? (
        <View className="p-12 items-center justify-center">
          <ActivityIndicator size="large" color="#801529" />
          <Text className="text-gray-500 text-sm mt-3">Cargando cursos asignados...</Text>
        </View>
      ) : cursos.length === 0 ? (
        <BentoCard className="p-8 items-center justify-center text-center">
          <Ionicons name="school-outline" size={48} color="#D1D5DB" />
          <Text className="text-lg font-bold text-gray-700 mt-3">No tienes cursos asignados</Text>
          <Text className="text-sm text-gray-400 mt-1 max-w-sm text-center">
            Aún no se han registrado asignaciones docentes para tu cuenta en el período académico activo.
          </Text>
        </BentoCard>
      ) : (
        <View className={`gap-4 ${isMobile ? '' : 'flex-row flex-wrap'}`}>
          {cursos.map((curso) => {
            const isSecundaria = String(curso.nivel).toLowerCase().includes('secundaria');
            return (
              <BentoCard
                key={curso.cursoPeriodoId}
                className={`p-5 ${isMobile ? 'w-full' : 'w-[48%]'}`}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center ${
                        isSecundaria ? 'bg-maroon/10' : 'bg-gold/20'
                      }`}
                    >
                      <Ionicons
                        name="school"
                        size={22}
                        color={isSecundaria ? '#801529' : '#B45309'}
                      />
                    </View>
                    <View>
                      <Text className="text-lg font-bold text-gray-900">
                        {curso.grado}° &quot;{curso.paralelo}&quot;
                      </Text>
                      <Text className="text-xs text-gray-500 capitalize">
                        Nivel {curso.nivel} {curso.anio ? `• Gestión ${curso.anio}` : ''}
                      </Text>
                    </View>
                  </View>
                  <StatusBadge
                    label={curso.nivel}
                    variant={isSecundaria ? 'info' : 'warning'}
                  />
                </View>

                {/* Materias asignadas en este curso */}
                <View className="mt-4 pt-3 border-t border-gray-100">
                  <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Materias que impartes:
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {curso.materias.map((m) => (
                      <View
                        key={m.id}
                        className="bg-gray-100 px-2.5 py-1 rounded-lg flex-row items-center gap-1"
                      >
                        <Ionicons name="book-outline" size={12} color="#801529" />
                        <Text className="text-xs font-medium text-gray-800">{m.nombre}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Acción para ver detalle de estudiantes */}
                <TouchableOpacity
                  onPress={() => handleOpenCourseStudents(curso)}
                  className="mt-5 bg-maroon rounded-xl py-2.5 px-4 flex-row items-center justify-center gap-2 shadow-sm"
                >
                  <Ionicons name="people-outline" size={18} color="#FFFFFF" />
                  <Text className="text-white text-sm font-semibold">Ver Nómina de Estudiantes</Text>
                </TouchableOpacity>
              </BentoCard>
            );
          })}
        </View>
      )}

      {/* Modal de Detalle de Estudiantes */}
      <Modal
        visible={studentsModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setStudentsModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            {/* Header del Modal */}
            <View className="p-5 border-b border-gray-100 flex-row items-center justify-between bg-gray-50">
              <View>
                <Text className="text-lg font-bold text-gray-900">
                  Nómina de Alumnos — {selectedCurso?.grado}° &quot;{selectedCurso?.paralelo}&quot; {selectedCurso?.nivel}
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Lista completa de estudiantes inscritos en el curso
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setStudentsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Buscador de estudiantes */}
            <View className="p-4 border-b border-gray-100 bg-white">
              <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 gap-2">
                <Ionicons name="search" size={18} color="#6B7280" />
                <TextInput
                  value={searchStudent}
                  onChangeText={setSearchStudent}
                  placeholder="Buscar estudiante por nombre, apellido o CI..."
                  className="flex-1 text-sm text-gray-800"
                  placeholderTextColor="#9CA3AF"
                />
                {searchStudent ? (
                  <TouchableOpacity onPress={() => setSearchStudent('')}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View className="flex-row justify-between items-center mt-2 px-1">
                <Text className="text-xs text-gray-500 font-medium">
                  Total inscritos: {students.length}
                </Text>
                <Text className="text-xs text-gray-400">
                  Mostrando: {filteredStudents.length}
                </Text>
              </View>
            </View>

            {/* Lista de Estudiantes */}
            <ScrollView className="p-4 max-h-[50vh]">
              {loadingStudents ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="small" color="#801529" />
                  <Text className="text-xs text-gray-500 mt-2">Cargando nómina oficial...</Text>
                </View>
              ) : filteredStudents.length === 0 ? (
                <View className="py-8 items-center justify-center">
                  <Ionicons name="people-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-semibold text-gray-600 mt-2">
                    {searchStudent ? 'No se encontraron alumnos con ese criterio' : 'No hay estudiantes inscritos en este curso'}
                  </Text>
                </View>
              ) : (
                <View className="gap-2 pb-4">
                  {filteredStudents.map((st, index) => (
                    <View
                      key={st.id || index}
                      className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex-row items-center justify-between"
                    >
                      <View className="flex-row items-center gap-3">
                        <View className="w-9 h-9 rounded-full bg-maroon/10 items-center justify-center">
                          <Text className="text-xs font-bold text-maroon">
                            {st.apellidoPaterno?.charAt(0) || st.nombre?.charAt(0) || 'E'}
                          </Text>
                        </View>
                        <View>
                          <Text className="text-sm font-bold text-gray-800">
                            {st.apellidoPaterno} {st.apellidoMaterno} {st.nombre}
                          </Text>
                          <Text className="text-xs text-gray-400">
                            CI: {st.numeroDoc} {st.fechaInscripcion ? `• Inscrito: ${st.fechaInscripcion.slice(0, 10)}` : ''}
                          </Text>
                        </View>
                      </View>
                      <StatusBadge
                        label={st.estado}
                        variant={st.estado === 'activo' ? 'success' : 'neutral'}
                      />
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            {/* Footer Modal */}
            <View className="p-4 border-t border-gray-100 bg-gray-50 flex-row justify-end">
              <TouchableOpacity
                onPress={() => setStudentsModalOpen(false)}
                className="bg-gray-200 px-5 py-2.5 rounded-xl"
              >
                <Text className="text-sm font-semibold text-gray-700">Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
