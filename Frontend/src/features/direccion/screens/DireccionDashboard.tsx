import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { HeroBanner } from '../../../displays/components/HeroBanner';
import { KpiCard } from '../../../displays/components/KpiCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

const DEPARTMENTS = [
  { name: 'Académico', lead: 'Dra. Elena Ruiz', budget: 78, status: 'success' as const },
  { name: 'Finanzas', lead: 'Lic. Marco Torres', budget: 92, status: 'success' as const },
  { name: 'RR.HH.', lead: 'Ing. Ana López', budget: 65, status: 'warning' as const },
  { name: 'Infraestructura', lead: 'Arq. Luis Mendez', budget: 45, status: 'danger' as const },
];

const PRIORITIES = [
  { title: 'Aprobación de presupuesto', tag: 'TESORERÍA', urgent: true },
  { title: 'Informe de acreditación', tag: 'MINISTERIO DE EDUCACIÓN', urgent: false },
  { title: 'Evaluación docente 95%', tag: 'RR.HH.', urgent: false },
];

export function DireccionDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const name = user ? getFullName(user.nombre, user.apellidoPaterno) : 'Director';

  return (
    <View className="gap-4">
      <HeroBanner
        badge="Nivel Ejecutivo"
        badgeSecondary="Ciclo Académico 2024-2025"
        title="Control Institucional Global"
        subtitle={`Bienvenido, ${name}. La matrícula global creció un 5.4% y la retención académica se mantiene en 97.8%.`}
        primaryAction={{ label: 'Descargar Informe Anual', onPress: () => {} }}
        secondaryAction={{ label: 'Configurar Alertas', onPress: () => {} }}
      />

      <View className={`flex-row flex-wrap gap-3 ${isMobile ? '' : ''}`}>
        <KpiCard label="Matrícula Global" value="3,412" trend="+ 5.4%" icon="people" />
        <KpiCard label="Ingresos Proyectados" value="$1.2M" trend="+ 8.2%" icon="cash" />
        <KpiCard label="Retención Académica" value="97.8%" trend="+ 0.5%" icon="trending-up" />
        <KpiCard label="Personal Docente" value="245" trend="+ 12" icon="business" />
      </View>

      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Rendimiento Financiero</Text>
            <View className="flex-row gap-2">
              <View className="bg-maroon/10 px-3 py-1 rounded-lg">
                <Text className="text-maroon text-xs font-semibold">Trimestral</Text>
              </View>
            </View>
          </View>
          <View className="h-40 bg-gray-50 rounded-xl items-center justify-center">
            <Ionicons name="analytics" size={48} color="#801529" />
            <Text className="text-gray-400 text-sm mt-2">Ingresos reales vs proyectados</Text>
          </View>
        </BentoCard>

        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <Text className="text-lg font-bold text-gray-900 mb-4">Indicadores Académicos</Text>
          {['Primaria', 'Secundaria', 'Bachillerato'].map((level, i) => (
            <View key={level} className="mb-3">
              <View className="flex-row justify-between mb-1">
                <Text className="text-sm text-gray-600">{level}</Text>
                <Text className="text-sm font-semibold text-maroon">{[8.5, 8.8, 9.1][i]}</Text>
              </View>
              <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <View className="h-full bg-maroon rounded-full" style={{ width: `${[85, 88, 91][i]}%` }} />
              </View>
            </View>
          ))}
        </BentoCard>
      </View>

      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <Text className="text-lg font-bold text-gray-900 mb-4">Supervisión Departamental</Text>
          {DEPARTMENTS.map((dept) => (
            <View key={dept.name} className="flex-row items-center py-3 border-b border-gray-50">
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">{dept.name}</Text>
                <Text className="text-xs text-gray-400">{dept.lead}</Text>
              </View>
              <View className="w-20 mr-3">
                <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <View className="h-full bg-maroon rounded-full" style={{ width: `${dept.budget}%` }} />
                </View>
                <Text className="text-[10px] text-gray-400 text-center mt-0.5">{dept.budget}%</Text>
              </View>
              <StatusBadge
                label={dept.status === 'success' ? 'Al día' : dept.status === 'warning' ? 'Revisión' : 'Crítico'}
                variant={dept.status}
              />
            </View>
          ))}
        </BentoCard>

        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <Text className="text-lg font-bold text-gray-900 mb-4">Prioridades Directivas</Text>
          {PRIORITIES.map((item) => (
            <View key={item.title} className="mb-4 pb-3 border-b border-gray-50">
              <View className="flex-row items-start gap-2">
                <Ionicons
                  name={item.urgent ? 'alert-circle' : 'information-circle'}
                  size={18}
                  color={item.urgent ? '#DC2626' : '#2563EB'}
                />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-800">{item.title}</Text>
                  <Text className="text-[10px] text-maroon font-semibold mt-1">{item.tag}</Text>
                </View>
              </View>
            </View>
          ))}
        </BentoCard>
      </View>

      <BentoCard className="p-4 bg-tan/20 border-tan/30">
        <View className="flex-row items-center justify-between flex-wrap gap-3">
          <View className="flex-row items-center gap-3 flex-1">
            <Ionicons name="business" size={24} color="#801529" />
            <View>
              <Text className="font-semibold text-gray-800">Expansión Laboratorio de Ciencias</Text>
              <Text className="text-xs text-gray-500">Progreso: 85% completado</Text>
            </View>
          </View>
          <Text className="text-sm font-bold text-maroon">$450,000 / $700,000</Text>
        </View>
      </BentoCard>
    </View>
  );
}
