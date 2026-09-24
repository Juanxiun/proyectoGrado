import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicManagementApi, academicServicesApi } from '../../../api/academicServices.api';
import { usuariosApi } from '../../../api/usuarios.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { getFallbackGradient } from './CoverImagePicker';
import { useAuth } from '../../../context/AuthContext';

interface InteractiveScheduleBuilderProps {
  periodoId: string;
  initialCourseId?: string;
  onSaved?: () => void;
  onNavigateToInscripciones?: () => void;
  onClose?: () => void;
}

interface TimeBlock {
  id: string;
  horaInicio: string;
  horaFin: string;
  isRecess?: boolean;
  label?: string;
}

const MORNING_TIME_BLOCKS: TimeBlock[] = [
  { id: 'm1', horaInicio: '07:00', horaFin: '07:45' },
  { id: 'm2', horaInicio: '07:45', horaFin: '08:30' },
  { id: 'm3', horaInicio: '08:30', horaFin: '09:15' },
  { id: 'recreo-m', horaInicio: '09:30', horaFin: '10:00', isRecess: true, label: 'RECREO INSTITUCIONAL' },
  { id: 'm4', horaInicio: '10:00', horaFin: '10:45' },
  { id: 'm5', horaInicio: '10:45', horaFin: '11:30' },
  { id: 'm6', horaInicio: '11:30', horaFin: '12:15' },
];

const AFTERNOON_TIME_BLOCKS: TimeBlock[] = [
  { id: 't1', horaInicio: '14:00', horaFin: '14:45' },
  { id: 't2', horaInicio: '14:45', horaFin: '15:30' },
  { id: 'recreo-t', horaInicio: '16:00', horaFin: '16:30', isRecess: true, label: 'RECREO INSTITUCIONAL' },
  { id: 't3', horaInicio: '16:30', horaFin: '17:15' },
  { id: 't4', horaInicio: '17:15', horaFin: '18:00' },
];

const DAYS = [
  { num: 1, name: 'Lunes' },
  { num: 2, name: 'Martes' },
  { num: 3, name: 'Miércoles' },
  { num: 4, name: 'Jueves' },
  { num: 5, name: 'Viernes' },
];

interface CourseOption {
  id: string; // curso_periodo id
  label: string; // "1° Secundaria A"
  nivel: string;
  grado: string;
  paralelo: string;
  turno?: string;
}

interface SubjectCard {
  id: string; // materia id
  codigo: string;
  nombre: string;
  tipoMateria: string;
  cargaHorariaSemanal: number;
  profesorId?: string; // maestro id seleccionado
}

interface TeacherOption {
  id: string; // usuario_id del docente
  nombreCompleto: string;
  materiaIds?: string[];
  materiasConfigurado?: boolean;
}

interface GridSlot {
  diaSemana: number;
  blockId: string;
  horaInicio: string;
  horaFin: string;
  materiaId: string;
  materiaNombre: string;
  maestroId?: string;
  maestroNombre?: string;
}

export function InteractiveScheduleBuilder({
  periodoId,
  initialCourseId,
  onSaved,
  onNavigateToInscripciones,
  onClose,
}: InteractiveScheduleBuilderProps) {
  const { user } = useAuth();
  const hideDayNames = ['director', 'control', 'gerencia', 'administrativo', 'secretaria', 'secretario', 'editor', 'admin', 'administrador'].includes((user?.rol ?? '').toLowerCase());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeNivelTab, setActiveNivelTab] = useState<'primaria' | 'secundaria'>('primaria');
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId ?? '');

  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectCard[]>([]);
  const [curriculum, setCurriculum] = useState<Array<Record<string, any>>>([]);

  // Todos los horarios existentes en la gestión (para validación de choques en tiempo real)
  const [allSchedules, setAllSchedules] = useState<Array<Record<string, any>>>([]);

  // Borrador local de la grilla para el curso seleccionado: key = `${diaSemana}:${horaInicio}`
  const [draftGrid, setDraftGrid] = useState<Record<string, GridSlot>>({});
  const [selectedSubjectToPlace, setSelectedSubjectToPlace] = useState<SubjectCard | null>(null);
  const activeCourse = courses.find((course) => course.id === selectedCourseId);
  const timeBlocks = activeCourse?.turno === 'tarde' ? AFTERNOON_TIME_BLOCKS : MORNING_TIME_BLOCKS;

  // Cargar datos del período
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!periodoId) return;
      setLoading(true);
      try {
        const [cpRes, teachersRes, materiasRes, schedRes, curriculumRes] = await Promise.all([
          academicServicesApi.list('cursos-periodo', { periodoId, estado: 'activo', limit: 100 }),
          usuariosApi.list({ limit: 100 }),
          academicServicesApi.list('materias', { activo: 'true', limit: 100 }),
          academicManagementApi.listSchedules(periodoId),
          academicManagementApi.listCurriculum(periodoId).catch(() => []),
        ]);

        if (!mounted) return;

        // Cursos del periodo
        const rawCps = (cpRes.data ?? []) as Array<Record<string, any>>;
        const courseOpts: CourseOption[] = rawCps.map((cp) => {
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
        setCourses(courseOpts);
        const targetCourse = courseOpts.find((c) => c.id === (initialCourseId || selectedCourseId)) || courseOpts[0];
        if (targetCourse) {
          setSelectedCourseId(targetCourse.id);
          const nivelLower = targetCourse.nivel.toLowerCase();
          if (nivelLower.includes('secundaria')) {
            setActiveNivelTab('secundaria');
          } else {
            setActiveNivelTab('primaria');
          }
        }

        // Los docentes se obtienen del registro de usuarios; el curso se asigna al guardar el horario.
        const rawUsers = (teachersRes.data ?? []) as Array<Record<string, any>>;
        const teachersMap = new Map<string, TeacherOption>();
        rawUsers
          .filter((teacher) => {
            const role = String(teacher.rol ?? '').toLowerCase();
            const estado = String(teacher.estado ?? '').toLowerCase();
            const inactive = teacher.estado === 0 || teacher.estado === 2 || estado === 'inactivo' || estado === 'bloqueado';
            return !inactive && (role === 'profesor' || role === 'profesores' || role === 'maestro' || role === 'maestros' || role === 'docente' || String(teacher.rolId) === '2');
          })
          .forEach((teacher) => {
            const teacherId = String(teacher.id);
            const fullName = `${teacher.nombre ?? ''} ${teacher.apellidoPaterno ?? ''}`.trim() || 'Docente';
            const materiaIds = Array.isArray(teacher.materias)
              ? teacher.materias.map((materia: Record<string, any>) => String(materia.id))
              : undefined;
            teachersMap.set(teacherId, {
              id: teacherId,
              nombreCompleto: fullName,
              materiaIds,
              materiasConfigurado: Boolean(teacher.materiasConfigurado),
            });
          });
        setTeachers(Array.from(teachersMap.values()));
        setCurriculum((curriculumRes ?? []) as Array<Record<string, any>>);

        // Materias
        const rawMats = (materiasRes.data ?? []) as Array<Record<string, any>>;
        const subCards: SubjectCard[] = rawMats.map((m) => ({
          id: String(m.id),
          codigo: m.codigo,
          nombre: m.nombre,
          tipoMateria: m.tipoMateria ?? 'principal',
          cargaHorariaSemanal: Number(m.cargaHorariaSemanal ?? 5),
          profesorId: '',
        }));
        setSubjects(subCards);

        // Guardar todos los horarios
        setAllSchedules((schedRes ?? []) as Array<Record<string, any>>);
      } catch (err) {
        Alert.alert('Error', 'No se pudieron cargar los datos para la construcción de horarios.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void init();
    return () => { mounted = false; };
  }, [periodoId]);

  // Mostrar sólo las materias de la malla del curso seleccionado.
  useEffect(() => {
    const course = courses.find((item) => item.id === selectedCourseId);
    if (!course) return;
    const courseSubjects = curriculum.filter((item) =>
      String(item.nivel ?? '').toLowerCase() === course.nivel.toLowerCase()
      && String(item.grado ?? '').trim() === course.grado.trim(),
    );
    if (!courseSubjects.length) {
      if (curriculum.length) setSubjects([]);
      return;
    }
    setSubjects(courseSubjects.map((item) => {
      const materia = item.materia ?? {};
      return {
        id: String(item.materiaId ?? materia.id ?? ''),
        codigo: String(materia.codigo ?? ''),
        nombre: String(materia.nombre ?? 'Materia'),
        tipoMateria: String(item.tipoMateria ?? materia.tipoMateria ?? 'principal'),
        cargaHorariaSemanal: Number(item.cargaHorariaSemanal ?? materia.cargaHorariaSemanal ?? 5),
        profesorId: '',
      };
    }));
  }, [courses, curriculum, selectedCourseId]);

  // Sincronizar grilla borrador cuando cambia el curso seleccionado
  useEffect(() => {
    if (!selectedCourseId) return;
    const courseScheds = allSchedules.filter((s) => String(s.cursoPeriodoId) === selectedCourseId);
    const initialDraft: Record<string, GridSlot> = {};

    courseScheds.forEach((s) => {
      const hInicio = String(s.horaInicio ?? '').slice(0, 5);
      const hFin = String(s.horaFin ?? '').slice(0, 5);
      const dia = Number(s.diaSemana);
      const key = `${dia}:${hInicio}`;

      const block = timeBlocks.find((b) => b.horaInicio === hInicio) ?? { id: `custom_${hInicio}`, horaInicio: hInicio, horaFin: hFin };

      initialDraft[key] = {
        diaSemana: dia,
        blockId: block.id,
        horaInicio: hInicio,
        horaFin: hFin,
        materiaId: String(s.materiaId ?? s.materia?.id ?? ''),
        materiaNombre: s.materia?.nombre ?? 'Materia',
        maestroId: s.maestro?.usuarioId ?? (s.maestroId ? String(s.maestroId) : undefined),
        maestroNombre: s.maestro ? `${s.maestro.nombre ?? ''} ${s.maestro.apellidoPaterno ?? ''}`.trim() : undefined,
      };
    });

    setDraftGrid(initialDraft);
    setSelectedSubjectToPlace(null);
  }, [selectedCourseId, allSchedules, timeBlocks]);

  // Actualizar profesor en tarjeta de materia
  const handleTeacherChange = (materiaId: string, maestroId: string) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === materiaId ? { ...s, profesorId: maestroId } : s)),
    );
    if (selectedSubjectToPlace && selectedSubjectToPlace.id === materiaId) {
      setSelectedSubjectToPlace((prev) => (prev ? { ...prev, profesorId: maestroId } : null));
    }
  };

  // Validar y colocar materia en la celda horaria
  const handleSlotClick = (diaSemana: number, block: TimeBlock) => {
    if (block.isRecess) {
      Alert.alert(
        'Franja de Recreo Inamovible',
        `${block.horaInicio} a ${block.horaFin} está bloqueado de forma fija como horario de recreo para los estudiantes.`,
      );
      return;
    }

    const key = `${diaSemana}:${block.horaInicio}`;

    // Si no hay materia seleccionada para colocar, si la celda tiene contenido, permitir quitarla
    if (!selectedSubjectToPlace) {
      if (draftGrid[key]) {
        const copy = { ...draftGrid };
        delete copy[key];
        setDraftGrid(copy);
      }
      return;
    }

    const subject = selectedSubjectToPlace;
    const maestroId = subject.profesorId;
    const teacherObj = teachers.find((t) => t.id === maestroId);

    // Validación de traslape de profesores en tiempo real (Hard Constraint Warning)
    if (maestroId) {
      // Buscar en otros cursos del periodo
      const conflict = allSchedules.find((other) => {
        if (String(other.cursoPeriodoId) === selectedCourseId) return false;
        const otherTeacherId = String(other.maestro?.usuarioId ?? other.maestroId ?? '');
        if (otherTeacherId !== maestroId) return false;
        if (Number(other.diaSemana) !== diaSemana) return false;

        const otherInicio = String(other.horaInicio ?? '').slice(0, 5);
        const otherFin = String(other.horaFin ?? '').slice(0, 5);
        return otherInicio < block.horaFin && otherFin > block.horaInicio;
      });

      if (conflict) {
        const profName = teacherObj?.nombreCompleto ?? 'Profesor';
        const otherCp = courses.find((c) => c.id === String(conflict.cursoPeriodoId));
        const cursoLabel = otherCp ? otherCp.label : `Curso ID ${conflict.cursoPeriodoId}`;
        const materiaName = conflict.materia?.nombre ?? 'su materia';

        Alert.alert(
          'Choque de Horario Detectado',
          `El profesor ${profName} ya está asignado en este horario en el curso ${cursoLabel} impartiendo la materia ${materiaName}.`,
        );
        return;
      }
    }

    // Colocar materia en la celda borrador
    setDraftGrid((prev) => ({
      ...prev,
      [key]: {
        diaSemana,
        blockId: block.id,
        horaInicio: block.horaInicio,
        horaFin: block.horaFin,
        materiaId: subject.id,
        materiaNombre: subject.nombre,
        maestroId: maestroId || undefined,
        maestroNombre: teacherObj?.nombreCompleto || undefined,
      },
    }));
  };

  // Guardar horario manual completo en DB
  const handleSaveSchedule = async () => {
    if (!selectedCourseId) return;
    const slotsWithoutTeacher = Object.values(draftGrid).filter((slot) => !slot.maestroId);
    if (slotsWithoutTeacher.length) {
      Alert.alert(
        'Falta asignar un docente',
        'Asigne un docente a cada materia antes de guardar la construcción de horarios.',
      );
      return;
    }

    const slots = Object.values(draftGrid).map((s) => ({
      diaSemana: s.diaSemana,
      horaInicio: s.horaInicio,
      horaFin: s.horaFin,
      materiaId: s.materiaId,
      maestroId: s.maestroId || null,
    }));

    setSaving(true);
    try {
      await academicManagementApi.saveManualSchedule(periodoId, {
        cursoPeriodoId: selectedCourseId,
        slots,
      });

      // Recargar lista global de horarios
      const updatedSchedules = await academicManagementApi.listSchedules(periodoId);
      setAllSchedules(updatedSchedules as Array<Record<string, any>>);

      Alert.alert(
        'Construcción guardada',
        'El horario del curso y las asignaciones docente-materia fueron guardados correctamente.',
      );
      if (onSaved) onSaved();
    } catch (err) {
      Alert.alert(
        'No se pudo guardar el horario',
        err instanceof Error ? err.message : 'Verifique choques o restricciones.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFinishAndGoToEnrollment = async () => {
    if (Object.keys(draftGrid).length > 0) {
      await handleSaveSchedule();
    }
    setSaving(true);
    try {
      const state = await academicManagementApi.getState(periodoId);
      if (state.estado !== 'activo' && !state.listoParaActivar) {
        Alert.alert(
          'La gestión aún no está lista',
          state.bloqueos.join('\n'),
        );
        return;
      }
      if (state.estado !== 'activo') {
        await academicManagementApi.activate(periodoId);
      }
    } catch (err) {
      Alert.alert(
        'No se pudieron habilitar las inscripciones',
        err instanceof Error ? err.message : 'Complete todos los horarios y docentes antes de continuar.',
      );
      return;
    } finally {
      setSaving(false);
    }
    Alert.alert(
      'Horarios Configurados',
      'Horarios configurados. La gestión quedó activa y las inscripciones están habilitadas.',
    );
    if (onNavigateToInscripciones) {
      onNavigateToInscripciones();
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  if (loading) {
    return (
      <View className="py-12 items-center justify-center">
        <ActivityIndicator color="#801529" size="large" />
        <Text className="text-xs text-gray-500 mt-2">Cargando construcción de horarios...</Text>
      </View>
    );
  }

  const filteredCourses = courses.filter((c) =>
    activeNivelTab === 'primaria'
      ? c.nivel.toLowerCase().includes('primaria')
      : c.nivel.toLowerCase().includes('secundaria'),
  );

  return (
    <View className="gap-4 min-w-0">
      {/* Selector superior de Curso / Paralelo */}
      <BentoCard className="p-4 border border-maroon/20 overflow-hidden">
        <View className="flex-row items-center justify-between flex-wrap gap-2 mb-3">
          <View className="flex-row items-center gap-2 flex-1 min-w-0">
            {onClose && (
              <TouchableOpacity
                onPress={onClose}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-300 mr-1"
              >
                <Ionicons name="arrow-back" size={16} color="#374151" />
              </TouchableOpacity>
            )}
            <Ionicons name="calendar-outline" size={20} color="#801529" />
            <Text className="text-base font-bold text-gray-900" numberOfLines={2} ellipsizeMode="tail">
              Construcción y Edición de Horarios
            </Text>
          </View>

          <View className="flex-row items-center gap-2 flex-wrap">
            <TouchableOpacity
              onPress={handleSaveSchedule}
              disabled={saving}
              className="flex-row items-center gap-2 px-4 py-2.5 bg-maroon rounded-xl shadow"
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white uppercase">Guardar horario</Text>
                </>
              )}
            </TouchableOpacity>

            {onNavigateToInscripciones && (
              <TouchableOpacity
                onPress={handleFinishAndGoToEnrollment}
                disabled={saving}
                className="flex-row items-center gap-1.5 px-4 py-2.5 bg-emerald-700 rounded-xl shadow"
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white uppercase">Finalizar e Ir a Inscripciones</Text>
                <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Pestañas de Nivel (Primaria / Secundaria) */}
        <View className="flex-row items-center gap-2 mb-3 bg-gray-100 p-1 rounded-xl self-start">
          <TouchableOpacity
            onPress={() => {
              setActiveNivelTab('primaria');
              const firstPrim = courses.find((c) => c.nivel.toLowerCase().includes('primaria'));
              if (firstPrim) setSelectedCourseId(firstPrim.id);
            }}
            className={`px-4 py-2 rounded-lg flex-row items-center gap-1.5 ${
              activeNivelTab === 'primaria' ? 'bg-maroon shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="school-outline"
              size={15}
              color={activeNivelTab === 'primaria' ? '#FFFFFF' : '#4B5563'}
            />
            <Text
              className={`text-xs font-bold ${
                activeNivelTab === 'primaria' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Primaria
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setActiveNivelTab('secundaria');
              const firstSec = courses.find((c) => c.nivel.toLowerCase().includes('secundaria'));
              if (firstSec) setSelectedCourseId(firstSec.id);
            }}
            className={`px-4 py-2 rounded-lg flex-row items-center gap-1.5 ${
              activeNivelTab === 'secundaria' ? 'bg-maroon shadow-sm' : 'bg-transparent'
            }`}
          >
            <Ionicons
              name="book-outline"
              size={15}
              color={activeNivelTab === 'secundaria' ? '#FFFFFF' : '#4B5563'}
            />
            <Text
              className={`text-xs font-bold ${
                activeNivelTab === 'secundaria' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Secundaria
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-xs font-semibold text-gray-600 mb-2">
          Cursos de {activeNivelTab === 'primaria' ? 'Primaria' : 'Secundaria'}:
        </Text>
        <View className="w-full flex-row flex-wrap gap-2">
            {filteredCourses.map((c) => {
              const active = c.id === selectedCourseId;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCourseId(c.id)}
                  className={`flex-1 min-w-[170px] max-w-[240px] px-3 py-2 rounded-xl border ${
                    active ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-bold flex-1 min-w-0 ${active ? 'text-white' : 'text-gray-800'}`} numberOfLines={2} ellipsizeMode="tail">
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {filteredCourses.length === 0 && (
              <Text className="text-xs text-gray-400 italic py-1">No hay cursos registrados para este nivel.</Text>
            )}
        </View>
      </BentoCard>

      {/* Panel Superior: Tarjetas de Materias con Selector de Profesor */}
      <BentoCard className="p-4 bg-gray-50 overflow-hidden">
        <View className="flex-row items-start justify-between gap-2 mb-2 min-w-0">
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-bold text-maroon uppercase">
              Tarjetas de Materias para {selectedCourse?.label ?? 'el curso'}
            </Text>
            <Text className="text-[11px] text-gray-500">
              Seleccione el docente, toque una tarjeta para activarla y luego toque la casilla de la grilla para asignarla. La materia y el docente se asignan a este curso al guardar.
            </Text>
          </View>
          {selectedSubjectToPlace && (
            <TouchableOpacity
              onPress={() => setSelectedSubjectToPlace(null)}
              className="px-2.5 py-1 bg-gray-200 rounded-lg"
            >
              <Text className="text-[11px] font-bold text-gray-700">Deseleccionar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="w-full flex-row flex-wrap gap-3 py-2">
            {subjects.map((sub) => {
              const isSelected = selectedSubjectToPlace?.id === sub.id;
              const fallback = getFallbackGradient(sub.nombre);
               const eligibleTeachers = teachers.filter((teacher) =>
                 !teacher.materiasConfigurado || Boolean(teacher.materiaIds?.includes(sub.id)),
               );
              return (
                <View
                  key={sub.id}
                  className={`flex-1 min-w-[220px] max-w-[280px] p-3 rounded-2xl border bg-white shadow-sm flex-col justify-between ${
                    isSelected ? 'border-maroon ring-2 ring-maroon/30 bg-maroon/5' : 'border-gray-200'
                  }`}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedSubjectToPlace(sub)}
                    className="flex-row items-center gap-2 mb-2"
                  >
                    <View className={`w-8 h-8 rounded-xl ${fallback.bg} items-center justify-center`}>
                      <Ionicons name={fallback.icon} size={15} color="#FFFFFF" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-xs font-bold text-gray-900" numberOfLines={1}>
                        {sub.nombre}
                      </Text>
                      <Text className="text-[10px] text-gray-500">{sub.codigo} · {sub.cargaHorariaSemanal} hrs</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Selector de Profesor */}
                  <View className="border-t border-gray-100 pt-2">
                    <Text className="text-[10px] font-semibold text-gray-500 mb-1">Docente Asignado:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="w-full gap-1">
                      {eligibleTeachers.map((t) => {
                        const isTeacherSelected = sub.profesorId === t.id;
                        return (
                          <TouchableOpacity
                            key={t.id}
                            onPress={() => handleTeacherChange(sub.id, isTeacherSelected ? '' : t.id)}
                            className={`px-2 py-1 rounded-md border mr-1 ${
                              isTeacherSelected ? 'bg-indigo-700 border-indigo-700' : 'bg-gray-100 border-gray-200'
                            }`}
                          >
                            <Text
                              className={`text-[10px] ${
                                isTeacherSelected ? 'text-white font-bold' : 'text-gray-700'
                              }`}
                              numberOfLines={1}
                            >
                              {t.nombreCompleto}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedSubjectToPlace(isSelected ? null : sub)}
                    className={`mt-2 py-1.5 rounded-lg items-center ${
                      isSelected ? 'bg-maroon' : 'bg-gray-100'
                    }`}
                  >
                    <Text className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                      {isSelected ? '✓ Seleccionada para colocar' : 'Asignar a Grilla'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>
      </BentoCard>

      {/* Grilla Semanal de Horario (Lunes a Viernes) */}
      <BentoCard className="p-4 overflow-hidden">
        <Text className="text-xs font-bold text-gray-800 uppercase mb-3">
          Grilla Semanal · {selectedCourse?.label ?? 'Curso'}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View className="min-w-[650px]">
            {/* Header Días */}
            <View className="flex-row border-b border-gray-200 pb-2 mb-2">
              <View className="w-24 items-center">
                <Text className="text-xs font-bold text-gray-500">HORA</Text>
              </View>
              {DAYS.map((d) => (
                <View key={d.num} className="flex-1 items-center">
                  <Text className="text-xs font-bold text-maroon">{hideDayNames ? d.num : d.name.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Filas de Bloques Horarios */}
            {timeBlocks.map((block) => {
              if (block.isRecess) {
                return (
                  <View
                    key={block.id}
                    className="flex-row items-center bg-amber-100/70 border-y border-amber-300 py-2.5 my-1.5 rounded-xl px-2"
                  >
                    <View className="w-24 items-center">
                      <Text className="text-[11px] font-bold text-amber-900">
                        {block.horaInicio} - {block.horaFin}
                      </Text>
                    </View>
                    <View className="flex-1 items-center flex-row justify-center gap-2">
                      <Ionicons name="cafe" size={16} color="#92400E" />
                      <Text className="text-xs font-bold text-amber-900 tracking-wider">
                        {block.label} (INAMOVIBLE)
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <View key={block.id} className="flex-row items-center border-b border-gray-100 py-1.5">
                  <View className="w-24 items-center pr-2">
                    <Text className="text-xs font-bold text-gray-700">{block.horaInicio}</Text>
                    <Text className="text-[10px] text-gray-400">{block.horaFin}</Text>
                  </View>

                  {DAYS.map((d) => {
                    const key = `${d.num}:${block.horaInicio}`;
                    const slotData = draftGrid[key];
                    const fallback = slotData ? getFallbackGradient(slotData.materiaNombre) : null;

                    return (
                      <TouchableOpacity
                        key={d.num}
                        onPress={() => handleSlotClick(d.num, block)}
                        className={`flex-1 min-w-0 m-1 p-2 min-h-[58px] rounded-xl border items-center justify-center transition-all ${
                          slotData
                            ? `${fallback?.bg ?? 'bg-maroon'} border-black/10 shadow-sm`
                            : selectedSubjectToPlace
                            ? 'bg-maroon/5 border-dashed border-maroon/40'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        {slotData ? (
                          <View className="items-center w-full">
                            <Text className="text-xs font-bold text-white text-center flex-1 min-w-0" numberOfLines={1}>
                              {slotData.materiaNombre}
                            </Text>
                            {slotData.maestroNombre ? (
                              <Text className="text-[9px] text-white/90 text-center font-medium mt-0.5" numberOfLines={1}>
                                {slotData.maestroNombre}
                              </Text>
                            ) : (
                              <Text className="text-[9px] text-amber-200 italic">Sin docente</Text>
                            )}
                          </View>
                        ) : (
                          <Text className="text-[10px] text-gray-400">
                            {selectedSubjectToPlace ? '+ Asignar' : '—'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </BentoCard>
    </View>
  );
}
