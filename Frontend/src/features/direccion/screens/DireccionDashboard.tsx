import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard, HeroBanner, KpiCard, StatusBadge } from '../../../shared/ui';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

interface NivelStat {
  nivel: string;
  cursos: number;
  estudiantes: number;
  promedio: number;
  asistencia: number;
}

const NIVELES_DATA: NivelStat[] = [
  { nivel: 'Primaria', cursos: 12, estudiantes: 240, promedio: 82.5, asistencia: 94 },
  { nivel: 'Secundaria', cursos: 12, estudiantes: 228, promedio: 76.8, asistencia: 91 },
];

const ALERTAS_SEGUIMIENTO = [
  { estudiante: 'Camila Rodriguez', curso: '3° Sec. A', causa: 'Promedio bajo (48 pts)', tipo: 'danger' as const },
  { estudiante: 'Lucas Fernández', curso: '2° Sec. B', causa: 'Inasistencias recurrentes (4)', tipo: 'warning' as const },
  { estudiante: 'Mateo Vargas', curso: '5° Prim. A', causa: 'Encargos sin entregar (3)', tipo: 'warning' as const },
];

const ACCESOS_DIRECTOS = [
  { title: 'Plantel Docente', desc: 'Asignaciones y materias', icon: 'school-outline' as const, tag: 'DOCENTES' },
  { title: 'Matrícula Escolar', desc: 'Inscripciones y cupos', icon: 'people-outline' as const, tag: 'ESTUDIANTES' },
  { title: 'Seguimiento Académico', desc: 'Cálculo de riesgo en tiempo real', icon: 'analytics-outline' as const, tag: 'CALIFICACIONES' },
  { title: 'Generador de Horarios', desc: 'Distribución semanal de aulas', icon: 'time-outline' as const, tag: 'HORARIOS' },
];

export function DireccionDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const name = user ? getFullName(user.nombre, user.apellidoPaterno) : 'Director';

  return (
    <View className="gap-5">
      {/* Hero Banner */}
      <HeroBanner
        badge="Dirección General"
        badgeSecondary="Gestión Académica Activa"
        title="Supervisión y Control Institucional"
        subtitle={`Bienvenido, ${name}. El sistema académico reporta 468 estudiantes activos con una asistencia promedio del 92.5%.`}
        variant="maroon"
      />

      {/* KPI Bento Grid */}
      <View className="flex-row flex-wrap gap-3">
        <KpiCard label="Cursos Activos" value="24" trend="Primaria & Secundaria" icon="book-outline" />
        <KpiCard label="Estudiantes" value="468" trend="+4.2% este ciclo" icon="people-outline" />
        <KpiCard label="Docentes" value="28" trend="100% Asignados" icon="school-outline" />
        <KpiCard label="Alertas de Riesgo" value="3" trend="Requieren atención" trendUp={false} icon="alert-circle-outline" iconColor="#DC2626" />
      </View>

      {/* Bento Main Grid */}
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        {/* Nivel Educativo Overview */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">Rendimiento por Nivel Educativo</Text>
              <Text className="text-xs text-gray-500">Métricas consolidadas del trimestre en curso</Text>
            </View>
            <View className="bg-maroon/10 px-2.5 py-1 rounded-lg">
              <Text className="text-maroon text-xs font-bold uppercase">Trimestre Actual</Text>
            </View>
          </View>

          <View className="gap-4">
            {NIVELES_DATA.map((item) => (
              <View key={item.nivel} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="school" size={18} color="#801529" />
                    <Text className="font-bold text-gray-900 text-base">Nivel {item.nivel}</Text>
                  </View>
                  <Text className="text-xs font-semibold text-gray-500">{item.cursos} Cursos · {item.estudiantes} Alumnos</Text>
                </View>

                {/* Progress Indicators */}
                <View className="gap-2.5 mt-2">
                  <View>
                    <View className="flex-row justify-between text-xs mb-1">
                      <Text className="text-xs text-gray-600">Promedio General de Calificaciones</Text>
                      <Text className="text-xs font-bold text-maroon">{item.promedio} / 100 pts</Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View className="h-full bg-maroon rounded-full" style={{ width: `${item.promedio}%` }} />
                    </View>
                  </View>

                  <View>
                    <View className="flex-row justify-between text-xs mb-1">
                      <Text className="text-xs text-gray-600">Asistencia Efectiva</Text>
                      <Text className="text-xs font-bold text-green-700">{item.asistencia}%</Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View className="h-full bg-green-600 rounded-full" style={{ width: `${item.asistencia}%` }} />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </BentoCard>

        {/* Alertas de Seguimiento */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Alertas de Seguimiento</Text>
            <Ionicons name="warning-outline" size={20} color="#DC2626" />
          </View>

          <View className="gap-3">
            {ALERTAS_SEGUIMIENTO.map((alerta, idx) => (
              <View key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-gray-900 text-sm">{alerta.estudiante}</Text>
                  <StatusBadge
                    label={alerta.tipo === 'danger' ? 'Crítico' : 'Observación'}
                    variant={alerta.tipo}
                  />
                </View>
                <Text className="text-xs text-gray-500 mt-0.5">{alerta.curso}</Text>
                <Text className="text-xs text-red-600 font-medium mt-1">{alerta.causa}</Text>
              </View>
            ))}
          </View>

          <View className="mt-4 pt-3 border-t border-gray-100">
            <Text className="text-[11px] text-gray-500 leading-tight">
              Los promedios se calculan sobre encargos publicados y ponderaciones en tiempo real.
            </Text>
          </View>
        </BentoCard>
      </View>

      {/* Bento Grid: Accesos Rápidos Institucionales */}
      <BentoCard className="p-5">
        <Text className="text-lg font-bold text-gray-900 mb-4">Gestión Institucional y Accesos Rápidos</Text>
        <View className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {ACCESOS_DIRECTOS.map((item) => (
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

