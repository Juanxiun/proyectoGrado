import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard, HeroBanner, KpiCard, StatusBadge } from '../../../shared/ui';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

interface MateriaProgreso {
  nombre: string;
  docente: string;
  promedio: number;
  encargosEntregados: string;
}

const MATERIAS_ESTUDIANTE: MateriaProgreso[] = [
  { nombre: 'Matemática', docente: 'Prof. Carlos Morales', promedio: 88, encargosEntregados: '4/4 entregados' },
  { nombre: 'Lenguaje y Literatura', docente: 'Prof. Laura Méndez', promedio: 92, encargosEntregados: '3/3 entregados' },
  { nombre: 'Ciencias Naturales', docente: 'Prof. Roberto Silva', promedio: 85, encargosEntregados: '3/4 entregados' },
  { nombre: 'Historia y Geografía', docente: 'Prof. Ana Torres', promedio: 90, encargosEntregados: '2/2 entregados' },
];

const PROXIMAS_ENTREGAS = [
  { materia: 'Ciencias Naturales', titulo: 'Informe: La Célula Vegetal', fecha: 'Mañana, 23:59', ponderacion: '15 pts', pendiente: true },
  { materia: 'Matemática', titulo: 'Ejercicios de Fracciones #4', fecha: 'Viernes, 18:00', ponderacion: '20 pts', pendiente: true },
  { materia: 'Lenguaje', titulo: 'Redacción: Crónica Escolar', fecha: 'Próx. Lunes', ponderacion: '15 pts', pendiente: false },
];

const ACCESOS_ESTUDIANTE = [
  { title: 'Aula y Evaluaciones', desc: 'Tareas, guías y entregas de archivos', icon: 'clipboard-outline' as const, tag: 'TAREAS' },
  { title: 'Mis Materias', desc: 'Contenido y material de apoyo', icon: 'book-outline' as const, tag: 'MATERIAS' },
  { title: 'Horario Escolar', desc: 'Distribución semanal de períodos', icon: 'time-outline' as const, tag: 'HORARIOS' },
  { title: 'Expediente y Apoderado', desc: 'Datos personales y contactos', icon: 'person-outline' as const, tag: 'PERFIL' },
];

export function UsuariosDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const fullName = user ? getFullName(user.nombre, user.apellidoPaterno, user.apellidoMaterno) : 'Estudiante';
  const roleName = user?.rol?.toLowerCase().includes('padre') ? 'Apoderado' : 'Estudiante';

  return (
    <View className="gap-5">
      {/* Hero Banner */}
      <HeroBanner
        badge={`Portal ${roleName}`}
        badgeSecondary="Ciclo Lectivo Activo"
        title={`¡Hola, ${user?.nombre ?? 'Estudiante'}!`}
        subtitle="Revisa tus actividades escolares, calificaciones del trimestre y las próximas tareas asignadas."
        variant="maroon"
      />

      {/* KPI Bento Grid */}
      <View className="flex-row flex-wrap gap-3">
        <KpiCard label="Materias Activas" value="4" trend="1° Trimestre" icon="book-outline" />
        <KpiCard label="Promedio General" value="88.7" trend="Aprobado destacado" icon="ribbon-outline" />
        <KpiCard label="Tareas Pendientes" value="2" trend="Por entregar" trendUp={false} icon="document-text-outline" />
        <KpiCard label="Asistencia" value="96%" trend="24 asistencias" icon="checkmark-circle-outline" />
      </View>

      {/* Bento Main Grid */}
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        {/* Mis Materias y Rendimiento */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">Mis Materias y Calificaciones</Text>
              <Text className="text-xs text-gray-500">Progreso en las materias del trimestre</Text>
            </View>
            <View className="bg-maroon/10 px-2.5 py-1 rounded-lg">
              <Text className="text-maroon text-xs font-bold uppercase">Trimestre 1</Text>
            </View>
          </View>

          <View className="gap-3">
            {MATERIAS_ESTUDIANTE.map((materia) => (
              <View key={materia.nombre} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <View className="flex-row items-start justify-between mb-2">
                  <View>
                    <Text className="font-bold text-gray-900 text-base">{materia.nombre}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">{materia.docente} · {materia.encargosEntregados}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-gray-400 font-semibold uppercase">Nota</Text>
                    <Text className="text-base font-bold text-maroon">{materia.promedio} / 100</Text>
                  </View>
                </View>

                <View className="mt-1">
                  <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <View className="h-full bg-maroon rounded-full" style={{ width: `${materia.promedio}%` }} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </BentoCard>

        {/* Ficha del Estudiante */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <View className="items-center text-center pb-4 border-b border-gray-100">
            <View className="w-16 h-16 rounded-2xl bg-maroon items-center justify-center mb-3">
              <Text className="text-white text-2xl font-bold">{user?.nombre?.charAt(0) ?? 'E'}</Text>
            </View>
            <Text className="text-base font-bold text-gray-900">{fullName}</Text>
            <Text className="text-xs text-gray-400 mt-0.5">Estudiante Regular · ID {user?.id ?? '—'}</Text>
            <View className="mt-2">
              <StatusBadge label="Matrícula Activa" variant="success" />
            </View>
          </View>

          <View className="gap-2.5 mt-4">
            <View className="flex-row justify-between py-1 border-b border-gray-50">
              <Text className="text-xs text-gray-500">Nivel</Text>
              <Text className="text-xs font-semibold text-gray-800">{user?.nivel ?? 'Secundaria'}</Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-gray-50">
              <Text className="text-xs text-gray-500">Grado y Paralelo</Text>
              <Text className="text-xs font-semibold text-gray-800">
                {user?.grado ? `${user.grado}° ${user.paralelo ?? 'A'}` : '3° A'}
              </Text>
            </View>
            <View className="flex-row justify-between py-1 border-b border-gray-50">
              <Text className="text-xs text-gray-500">Turno</Text>
              <Text className="text-xs font-semibold text-gray-800">Mañana</Text>
            </View>
            <View className="flex-row justify-between py-1">
              <Text className="text-xs text-gray-500">Modalidad</Text>
              <Text className="text-xs font-semibold text-gray-800">Presencial</Text>
            </View>
          </View>
        </BentoCard>
      </View>

      {/* Bento Grid Row 2: Próximas Entregas */}
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">Próximas Tareas y Evaluaciones</Text>
              <Text className="text-xs text-gray-500">Encargos pendientes de entrega</Text>
            </View>
            <Ionicons name="calendar-outline" size={20} color="#801529" />
          </View>

          <View className="gap-3">
            {PROXIMAS_ENTREGAS.map((entrega, idx) => (
              <View key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex-row items-center justify-between flex-wrap gap-2">
                <View className="flex-1 min-w-[180px]">
                  <Text className="text-xs font-bold text-maroon uppercase">{entrega.materia}</Text>
                  <Text className="font-bold text-gray-900 text-sm mt-0.5">{entrega.titulo}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">Vence: {entrega.fecha}</Text>
                </View>

                <View className="items-end">
                  <StatusBadge
                    label={entrega.pendiente ? 'Pendiente' : 'Entregado'}
                    variant={entrega.pendiente ? 'warning' : 'success'}
                  />
                  <Text className="text-xs font-bold text-gray-700 mt-1">{entrega.ponderacion}</Text>
                </View>
              </View>
            ))}
          </View>
        </BentoCard>
      </View>

      {/* Accesos Rápidos Escolares */}
      <BentoCard className="p-5">
        <Text className="text-lg font-bold text-gray-900 mb-4">Accesos Rápidos del Estudiante</Text>
        <View className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {ACCESOS_ESTUDIANTE.map((item) => (
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

