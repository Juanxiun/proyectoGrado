import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { HeroBanner } from '../../../displays/components/HeroBanner';
import { KpiCard } from '../../../displays/components/KpiCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

const STUDENTS = [
  { name: 'Sofía Martínez', grade: 9.2, attendance: 'success' as const },
  { name: 'Carlos Mendoza', grade: 7.8, attendance: 'info' as const },
  { name: 'Ana García', grade: 6.5, attendance: 'danger' as const },
  { name: 'Luis Torres', grade: 8.9, attendance: 'success' as const },
  { name: 'María López', grade: 8.1, attendance: 'info' as const },
];

const SCHEDULE = [
  { time: '08:00', course: 'Matemática Avanzada', room: 'Aula 204' },
  { time: '10:00', course: 'Física General', room: 'Lab 102' },
  { time: '12:00', course: 'Estadística', room: 'Aula 301' },
];

const PENDING = [
  { title: 'Calificar examen parcial', deadline: 'HOY', urgent: true },
  { title: 'Revisar tareas Matemática', deadline: 'MAÑANA', urgent: false },
  { title: 'Informe mensual', deadline: '18 JUN', urgent: false },
];

export function MaestrosDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const name = user ? getFullName(user.nombre, user.apellidoPaterno) : 'Profesor';
  const cursos = user?.cursos ?? [
    { materia: 'Matemática Avanzada', grado: '3', paralelo: 'A', nivel: 'Secundaria' },
    { materia: 'Física General', grado: '2', paralelo: 'B', nivel: 'Secundaria' },
    { materia: 'Estadística', grado: '4', paralelo: 'A', nivel: 'Bachillerato' },
  ];

  return (
    <View className="gap-4">
      <HeroBanner
        badge="Ciclo Académico 2024-II"
        title={`¡Buenos días, Prof. ${user?.nombre ?? 'Docente'}!`}
        subtitle="Tienes 3 clases programadas hoy y 14 tareas pendientes de calificación."
        primaryAction={{ label: 'Cargar Notas', onPress: () => {} }}
        secondaryAction={{ label: 'Ver Calendario', onPress: () => {} }}
      />

      <View className="flex-row flex-wrap gap-3">
        <KpiCard label="Asistencia Hoy" value="92%" trend="+ 3%" icon="checkmark-circle" />
        <KpiCard label="Tareas Pendientes" value="14" trend="- 2" trendUp={false} icon="clipboard" />
        <KpiCard label="Promedio Grupal" value="8.4" trend="+ 0.2" icon="school" />
        <KpiCard label="Mensajes Nuevos" value="5" trend="Nuevo" icon="chatbubbles" />
      </View>

      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <View className={`gap-4 ${isMobile ? '' : 'flex-[2]'}`}>
          <BentoCard className="p-5">
            <Text className="text-lg font-bold text-gray-900 mb-4">Cursos Asignados</Text>
            <View className={`gap-3 ${isMobile ? '' : 'flex-row flex-wrap'}`}>
              {cursos.slice(0, 3).map((curso, i) => (
                <View key={i} className={`bg-gray-50 rounded-xl p-4 ${isMobile ? '' : 'flex-1 min-w-[180px]'}`}>
                  <Text className="font-semibold text-gray-800">{curso.materia}</Text>
                  <Text className="text-xs text-gray-400 mt-1">
                    Sección {curso.paralelo} • {curso.nivel}
                  </Text>
                  <Text className="text-[10px] text-gray-400 uppercase mt-3 mb-1">Progreso de Sílabo</Text>
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View className="h-full bg-maroon rounded-full" style={{ width: `${[85, 72, 90][i]}%` }} />
                  </View>
                  <Text className="text-xs text-maroon font-semibold mt-1">{[85, 72, 90][i]}%</Text>
                </View>
              ))}
            </View>
          </BentoCard>

          <BentoCard className="p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-900">Control de Alumnos</Text>
              <TouchableOpacity className="bg-gray-100 px-3 py-1.5 rounded-lg">
                <Text className="text-xs text-gray-600">Filtrar</Text>
              </TouchableOpacity>
            </View>
            {STUDENTS.map((student) => (
              <View key={student.name} className="flex-row items-center py-3 border-b border-gray-50">
                <View className="w-8 h-8 rounded-full bg-maroon/10 items-center justify-center mr-3">
                  <Text className="text-maroon text-xs font-bold">{student.name.charAt(0)}</Text>
                </View>
                <Text className="flex-1 text-sm font-medium text-gray-800">{student.name}</Text>
                <View className={`px-2 py-0.5 rounded-lg mr-3 ${
                  student.grade >= 8 ? 'bg-green-100' : student.grade >= 7 ? 'bg-blue-100' : 'bg-red-100'
                }`}>
                  <Text className={`text-xs font-bold ${
                    student.grade >= 8 ? 'text-green-700' : student.grade >= 7 ? 'text-blue-700' : 'text-red-700'
                  }`}>{student.grade}</Text>
                </View>
                <StatusBadge
                  label={student.attendance === 'success' ? 'Presente' : student.attendance === 'info' ? 'Tardanza' : 'Ausente'}
                  variant={student.attendance}
                />
              </View>
            ))}
            <TouchableOpacity className="mt-3">
              <Text className="text-maroon text-xs font-semibold uppercase text-center">
                Ver reporte de calificaciones
              </Text>
            </TouchableOpacity>
          </BentoCard>

          <View className={`gap-3 ${isMobile ? '' : 'flex-row'}`}>
            {[
              { title: 'Foro de Docentes', desc: 'Comparte recursos', icon: 'chatbubbles' as const },
              { title: 'Banco de Exámenes', desc: 'Plantillas listas', icon: 'document' as const },
              { title: 'Tutorías', desc: 'Agenda sesiones', icon: 'people' as const },
            ].map((item) => (
              <BentoCard key={item.title} className="p-4 flex-1">
                <Ionicons name={item.icon} size={22} color="#801529" />
                <Text className="font-semibold text-gray-800 mt-2 text-sm">{item.title}</Text>
                <Text className="text-xs text-gray-400">{item.desc}</Text>
              </BentoCard>
            ))}
          </View>
        </View>

        <View className={`gap-4 ${isMobile ? '' : 'flex-1'}`}>
          <BentoCard className="p-5">
            <Text className="text-lg font-bold text-gray-900 mb-4">Horario de Hoy</Text>
            {SCHEDULE.map((item) => (
              <View key={item.time} className="flex-row items-start gap-3 mb-4">
                <Text className="text-sm font-bold text-maroon w-12">{item.time}</Text>
                <View>
                  <Text className="text-sm font-medium text-gray-800">{item.course}</Text>
                  <Text className="text-xs text-gray-400">{item.room}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity className="bg-gray-100 rounded-xl py-2.5 items-center">
              <Text className="text-gray-600 text-sm">Ver Horario Completo</Text>
            </TouchableOpacity>
          </BentoCard>

          <BentoCard className="p-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-bold text-gray-900">Pendientes</Text>
              <View className="bg-red-100 px-2 py-0.5 rounded-full">
                <Text className="text-red-600 text-xs font-bold">3 Críticas</Text>
              </View>
            </View>
            {PENDING.map((item) => (
              <View
                key={item.title}
                className={`border-l-4 pl-3 mb-3 ${
                  item.urgent ? 'border-red-500' : item.deadline === 'MAÑANA' ? 'border-orange-400' : 'border-green-500'
                }`}
              >
                <Text className="text-sm font-medium text-gray-800">{item.title}</Text>
                <Text className="text-xs text-gray-400">{item.deadline}</Text>
              </View>
            ))}
          </BentoCard>

          <BentoCard className="p-4 bg-gray-800">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-white/60 text-xs">Cumplimiento Admin.</Text>
                <Text className="text-white text-2xl font-bold">88%</Text>
              </View>
              <Ionicons name="arrow-up-circle" size={32} color="#16A34A" />
            </View>
          </BentoCard>
        </View>
      </View>
    </View>
  );
}
