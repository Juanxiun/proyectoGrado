import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { HeroBanner } from '../../../displays/components/HeroBanner';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

const SUBJECTS = [
  { name: 'Psicología del Aprendizaje', teacher: 'Dra. Elena Ruiz', progress: 85 },
  { name: 'Didáctica General', teacher: 'Prof. Marco Torres', progress: 72 },
  { name: 'Metodología Investigación', teacher: 'Dr. Luis Mendez', progress: 90 },
  { name: 'Tecnología Educativa', teacher: 'Ing. Ana López', progress: 68 },
];

const DEADLINES = [
  { title: 'Ensayo: Teorías Cognitivas', due: 'MAÑANA, 23:59', tag: 'Psicología', color: '#2563EB' },
  { title: 'Proyecto: Plan de Clase', due: '25 JUN, 18:00', tag: 'Didáctica', color: '#16A34A' },
  { title: 'Informe de Práctica', due: '28 JUN, 23:59', tag: 'Metodología', color: '#EAB308' },
];

const DAYS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE'];
const ATTENDANCE = ['present', 'present', 'present', 'late', 'present'];

const QUICK_LINKS = [
  { label: 'Inscripciones', icon: 'document-text' as const },
  { label: 'Biblioteca', icon: 'library' as const },
  { label: 'Certificados', icon: 'ribbon' as const },
  { label: 'Pagos', icon: 'card' as const },
  { label: 'Evaluaciones', icon: 'clipboard' as const },
  { label: 'Soporte IT', icon: 'headset' as const },
];

export function UsuariosDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const fullName = user ? getFullName(user.nombre, user.apellidoPaterno, user.apellidoMaterno) : 'Estudiante';

  return (
    <View className="gap-4">
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <View className={isMobile ? '' : 'flex-[2]'}>
          <HeroBanner
            badge="Ciclo Escolar 2024-1"
            title={`¡Hola de nuevo, ${user?.nombre ?? 'Estudiante'}!`}
            subtitle="Has completado el 78% de tus actividades este periodo. ¡Sigue así!"
            primaryAction={{ label: 'Ver Horario Completo', onPress: () => {} }}
            secondaryAction={{ label: 'Descargar Boleta', onPress: () => {} }}
          />
        </View>

        <BentoCard className={`p-5 bg-cream ${isMobile ? '' : 'flex-1'}`}>
          <View className="items-center">
            {user?.fotoUrl ? <Image source={{ uri: user.fotoUrl }} className="w-20 h-20 rounded-full bg-gray-100 mb-3" /> : <View className="w-20 h-20 rounded-full bg-maroon items-center justify-center mb-3"><Text className="text-white text-2xl font-bold">{user?.nombre?.charAt(0) ?? 'E'}</Text></View>}
            <Text className="text-lg font-bold text-gray-900">{fullName}</Text>
            <Text className="text-xs text-gray-400 mt-1">STU-2024-{user?.id?.padStart(4, '0') ?? '0892'}</Text>
            <StatusBadge label="Estudiante Regular" variant="success" />
            <View className="w-full mt-4 gap-2">
              <View className="flex-row justify-between">
                <Text className="text-xs text-gray-500">Carrera</Text>
                <Text className="text-xs font-semibold text-gray-800">
                  {user?.nivel ?? 'Lic. Educación Primaria'}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-xs text-gray-500">Semestre</Text>
                <Text className="text-xs font-semibold text-gray-800">
                  {user?.grado ? `${user.grado}° ${user.paralelo ?? ''}` : '4to Semestre'}
                </Text>
              </View>
            </View>
            <Text className="text-4xl font-bold text-maroon mt-4">9.4</Text>
            <Text className="text-xs text-gray-400 uppercase tracking-widest">Promedio General</Text>
          </View>
        </BentoCard>
      </View>

      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <Text className="text-lg font-bold text-gray-900 mb-4">Materias Actuales</Text>
          <View className={`gap-3 ${isMobile ? '' : 'flex-row flex-wrap'}`}>
            {SUBJECTS.map((subject) => (
              <View key={subject.name} className={`bg-gray-50 rounded-xl p-4 ${isMobile ? '' : 'w-[48%]'}`}>
                <View className="flex-row justify-between items-start mb-2">
                  <Ionicons name="book" size={18} color="#801529" />
                  <StatusBadge label="Activa" variant="success" />
                </View>
                <Text className="font-semibold text-gray-800 text-sm">{subject.name}</Text>
                <Text className="text-xs text-gray-400 mt-1">{subject.teacher}</Text>
                <View className="h-1.5 bg-gray-200 rounded-full mt-3 overflow-hidden">
                  <View className="h-full bg-maroon rounded-full" style={{ width: `${subject.progress}%` }} />
                </View>
                <Text className="text-xs text-maroon font-semibold mt-1">{subject.progress}%</Text>
              </View>
            ))}
          </View>
        </BentoCard>

        <View className={`gap-4 ${isMobile ? '' : 'flex-1'}`}>
          <BentoCard className="p-5">
            <Text className="text-lg font-bold text-gray-900 mb-4">Asistencia Semanal</Text>
            <View className="flex-row justify-between mb-4">
              {DAYS.map((day, i) => (
                <View key={day} className="items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center ${
                    ATTENDANCE[i] === 'present' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <Ionicons
                      name={ATTENDANCE[i] === 'present' ? 'checkmark' : 'time'}
                      size={18}
                      color={ATTENDANCE[i] === 'present' ? '#16A34A' : '#DC2626'}
                    />
                  </View>
                  <Text className="text-[10px] text-gray-400 mt-1">{day}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-gray-600">Total del mes <Text className="font-bold">96%</Text></Text>
              <TouchableOpacity>
                <Text className="text-red-500 text-xs font-semibold">DETALLES</Text>
              </TouchableOpacity>
            </View>
          </BentoCard>

          <BentoCard className="p-5">
            <Text className="text-lg font-bold text-gray-900 mb-4">Próximas Entregas</Text>
            {DEADLINES.map((item) => (
              <View key={item.title} className="mb-3 pb-3 border-b border-gray-50">
                <Text className="text-[10px] text-red-500 font-semibold">VENCE: {item.due}</Text>
                <View className="flex-row justify-between items-center mt-1">
                  <Text className="text-sm text-gray-800 flex-1">{item.title}</Text>
                  <View className="px-2 py-0.5 rounded" style={{ backgroundColor: `${item.color}20` }}>
                    <Text className="text-xs font-semibold" style={{ color: item.color }}>{item.tag}</Text>
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity className="bg-maroon/10 rounded-xl py-2.5 items-center">
              <Text className="text-maroon text-sm font-semibold">Abrir Calendario Académico</Text>
            </TouchableOpacity>
          </BentoCard>
        </View>
      </View>

      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Evolución de Notas</Text>
            <View className="bg-maroon/10 px-3 py-1 rounded-lg">
              <Text className="text-maroon text-xs font-semibold">Meta: 9.5</Text>
            </View>
          </View>
          <View className="h-36 bg-gray-50 rounded-xl items-center justify-center">
            <Ionicons name="analytics" size={40} color="#801529" />
            <Text className="text-gray-400 text-sm mt-2">Rendimiento académico mensual</Text>
          </View>
        </BentoCard>

        <LinearGradient colors={['#8B6914', '#5c4510']} style={{ borderRadius: 16, padding: 20, flex: isMobile ? undefined : 1 }}>
          <Ionicons name="star" size={28} color="#FFD700" />
          <Text className="text-white font-bold text-lg mt-3">Estudiante Destacado</Text>
          <Text className="text-white/70 text-sm mt-1">Top 5% de tu generación este mes.</Text>
          <View className="mt-4">
            <Text className="text-white/60 text-xs">Nivel 4</Text>
            <View className="h-2 bg-white/20 rounded-full mt-1 overflow-hidden">
              <View className="h-full bg-yellow-400 rounded-full" style={{ width: '75%' }} />
            </View>
            <Text className="text-white/60 text-xs mt-1">12,450 XP</Text>
          </View>
        </LinearGradient>
      </View>

      <BentoCard className="p-4">
        <Text className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Accesos Directos</Text>
        <View className="flex-row flex-wrap gap-3">
          {QUICK_LINKS.map((link) => (
            <TouchableOpacity key={link.label} className="items-center w-[30%] min-w-[80px]">
              <View className="w-12 h-12 bg-gray-50 rounded-xl items-center justify-center mb-1">
                <Ionicons name={link.icon} size={22} color="#801529" />
              </View>
              <Text className="text-[10px] text-gray-600 text-center">{link.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BentoCard>
    </View>
  );
}
