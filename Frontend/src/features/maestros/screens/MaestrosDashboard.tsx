import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard, HeroBanner, KpiCard, StatusBadge } from '../../../shared/ui';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

interface CursoItem {
  materia: string;
  grado: string;
  paralelo: string;
  nivel: string;
  alumnos: number;
  avance: number;
}

const MIS_CURSOS: CursoItem[] = [
  { materia: 'Matemática', grado: '3°', paralelo: 'A', nivel: 'Secundaria', alumnos: 31, avance: 80 },
  { materia: 'Física', grado: '2°', paralelo: 'B', nivel: 'Secundaria', alumnos: 27, avance: 75 },
  { materia: 'Química', grado: '4°', paralelo: 'A', nivel: 'Secundaria', alumnos: 29, avance: 85 },
];

const HORARIO_HOY = [
  { hora: '08:00 - 09:30', materia: 'Matemática', curso: '3° Sec. A', aula: 'Aula 201' },
  { hora: '10:00 - 11:30', materia: 'Física', curso: '2° Sec. B', aula: 'Laboratorio 1' },
  { hora: '11:45 - 13:15', materia: 'Química', curso: '4° Sec. A', aula: 'Aula 203' },
];

const TAREAS_PENDIENTES = [
  { titulo: 'Práctica #3: Ecuaciones cuadráticas', curso: '3° Sec. A', entregas: '28/31', vence: 'Hoy', urgente: true },
  { titulo: 'Laboratorio #2: Movimiento Rectilíneo', curso: '2° Sec. B', entregas: '24/27', vence: 'Mañana', urgente: false },
  { titulo: 'Cuestionario: Enlaces químicos', curso: '4° Sec. A', entregas: '20/29', vence: 'En 3 días', urgente: false },
];

const ACCIONES_DOCENTE = [
  { title: 'Registrar Calificaciones', desc: 'Ponderación y notas trimestrales', icon: 'clipboard-outline' as const, tag: 'EVALUACIÓN' },
  { title: 'Control de Asistencia', desc: 'Presentes, atrasos y faltas del día', icon: 'checkmark-circle-outline' as const, tag: 'ASISTENCIA' },
  { title: 'Publicar Encargo / Material', desc: 'Subir guías o tareas a MinIO', icon: 'cloud-upload-outline' as const, tag: 'CONTENIDO' },
  { title: 'Consultar Mi Horario', desc: 'Distribución semanal de períodos', icon: 'time-outline' as const, tag: 'HORARIOS' },
];

export function MaestrosDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const name = user ? getFullName(user.nombre, user.apellidoPaterno) : 'Docente';

  return (
    <View className="gap-5">
      {/* Hero Banner */}
      <HeroBanner
        badge="Panel Docente"
        badgeSecondary="Ciclo Lectivo Activo"
        title={`¡Bienvenido, Prof. ${user?.nombre ?? 'Docente'}!`}
        subtitle="Tienes 3 períodos de clase programados para hoy y 87 entregas listas para revisión."
        variant="maroon"
      />

      {/* KPI Bento Grid */}
      <View className="flex-row flex-wrap gap-3">
        <KpiCard label="Cursos Asignados" value="3" trend="87 Estudiantes" icon="school-outline" />
        <KpiCard label="Encargos Publicados" value="12" trend="Trimestre en curso" icon="document-text-outline" />
        <KpiCard label="Por Calificar" value="14" trend="Entregas pendientes" trendUp={false} icon="create-outline" />
        <KpiCard label="Asistencia Promedio" value="94%" trend="+2% esta semana" icon="checkmark-done-circle-outline" />
      </View>

      {/* Bento Main Grid */}
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        {/* Mis Cursos Asignados */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">Mis Cursos y Materias Asignadas</Text>
              <Text className="text-xs text-gray-500">Avance de contenido y planificación curricular</Text>
            </View>
            <View className="bg-maroon/10 px-2.5 py-1 rounded-lg">
              <Text className="text-maroon text-xs font-bold uppercase">Gestión Activa</Text>
            </View>
          </View>

          <View className="gap-3">
            {MIS_CURSOS.map((curso) => (
              <View key={curso.materia} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <View className="flex-row items-start justify-between mb-2">
                  <View>
                    <Text className="font-bold text-gray-900 text-base">{curso.materia}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {curso.grado} Paralelo {curso.paralelo} · Nivel {curso.nivel} · {curso.alumnos} Alumnos
                    </Text>
                  </View>
                  <StatusBadge label="En curso" variant="success" />
                </View>

                {/* Progress Bar */}
                <View className="mt-2">
                  <View className="flex-row justify-between text-xs mb-1">
                    <Text className="text-xs text-gray-500">Avance de Planificación</Text>
                    <Text className="text-xs font-bold text-maroon">{curso.avance}%</Text>
                  </View>
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View className="h-full bg-maroon rounded-full" style={{ width: `${curso.avance}%` }} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </BentoCard>

        {/* Horario de Hoy */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold text-gray-900">Horario de Hoy</Text>
            <Ionicons name="calendar-outline" size={20} color="#801529" />
          </View>

          <View className="gap-3">
            {HORARIO_HOY.map((item, idx) => (
              <View key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-bold text-maroon">{item.hora}</Text>
                  <Text className="text-xs font-semibold text-gray-600">{item.aula}</Text>
                </View>
                <Text className="text-sm font-bold text-gray-900">{item.materia}</Text>
                <Text className="text-xs text-gray-500">{item.curso}</Text>
              </View>
            ))}
          </View>
        </BentoCard>
      </View>

      {/* Bento Grid Row 2: Tareas Pendientes de Calificar */}
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">Encargos y Entregas por Calificar</Text>
              <Text className="text-xs text-gray-500">Revisión de actividades de los estudiantes</Text>
            </View>
            <Ionicons name="clipboard-outline" size={20} color="#801529" />
          </View>

          <View className="gap-3">
            {TAREAS_PENDIENTES.map((tarea, idx) => (
              <View key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex-row items-center justify-between flex-wrap gap-2">
                <View className="flex-1 min-w-[200px]">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-bold text-gray-900 text-sm">{tarea.titulo}</Text>
                    {tarea.urgente && (
                      <View className="bg-red-100 px-2 py-0.5 rounded-full">
                        <Text className="text-[10px] font-bold text-red-600 uppercase">Urgente</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-500 mt-0.5">{tarea.curso} · Vence: {tarea.vence}</Text>
                </View>

                <View className="items-end">
                  <Text className="text-xs text-gray-500">Entregas</Text>
                  <Text className="text-sm font-bold text-maroon">{tarea.entregas}</Text>
                </View>
              </View>
            ))}
          </View>
        </BentoCard>
      </View>

      {/* Accesos Rápidos de Docencia */}
      <BentoCard className="p-5">
        <Text className="text-lg font-bold text-gray-900 mb-4">Herramientas de Docencia</Text>
        <View className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {ACCIONES_DOCENTE.map((item) => (
            <View key={item.title} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <View className="flex-row items-center justify-between mb-2">
                <View className="w-9 h-9 rounded-lg bg-maroon/10 items-center justify-center">
                  <Ionicons name={item.icon} size={19} color="#801529" />
                </View>
                <Text className="text-[10px] font-bold text-maroon uppercase">{item.tag}</Text>
              </View>
              <Text className="font-bold text-gray-900 text-sm">{item.title}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{item.desc}</Text>
            </View>
          ))}
        </View>
      </BentoCard>
    </View>
  );
}

