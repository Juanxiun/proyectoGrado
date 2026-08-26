import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { HeroBanner } from '../../../displays/components/HeroBanner';
import { KpiCard } from '../../../displays/components/KpiCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

const TRANSACTIONS = [
  { id: 'TX-001', user: 'María García', concept: 'Matrícula', amount: '$450', status: 'success' as const },
  { id: 'TX-002', user: 'Carlos López', concept: 'Mensualidad', amount: '$120', status: 'warning' as const },
  { id: 'TX-003', user: 'Ana Torres', concept: 'Certificado', amount: '$35', status: 'success' as const },
  { id: 'TX-004', user: 'Pedro Ruiz', concept: 'Matrícula', amount: '$450', status: 'danger' as const },
];

const QUICK_ACCESS = [
  'Cierre de Caja Diario',
  'Validación de Títulos',
  'Gestión de Becas',
  'Auditoría de Usuarios',
];

export function ControlDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const name = user ? getFullName(user.nombre, user.apellidoPaterno) : 'Administrador';

  return (
    <View className="gap-4">
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <View className={isMobile ? '' : 'flex-[2]'}>
          <HeroBanner
            badge="Gestión Administrativa"
            badgeSecondary="Ciclo 2024-B"
            title="Control Institucional y Financiero"
            subtitle={`${name}, monitorea métricas financieras y administrativas en tiempo real.`}
            primaryAction={{ label: 'Nuevo Registro de Pago', onPress: () => {} }}
            secondaryAction={{ label: 'Descargar Reporte Mensual', onPress: () => {} }}
          />
        </View>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <Text className="text-lg font-bold text-gray-900 mb-4">Accesos Directos</Text>
          {QUICK_ACCESS.map((item) => (
            <TouchableOpacity key={item} className="flex-row items-center justify-between py-3 border-b border-gray-50">
              <View className="flex-row items-center gap-3">
                <Ionicons name="chevron-forward-circle-outline" size={18} color="#9CA3AF" />
                <Text className="text-sm text-gray-700">{item}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </BentoCard>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <KpiCard label="Ingresos Totales" value="$124,500" trend="+15.2%" icon="cash" />
        <KpiCard label="Pendiente de Cobro" value="$12,300" trend="-5.1%" trendUp={false} icon="time" />
        <KpiCard label="Matrículas Nuevas" value="42" trend="+ 8" icon="person-add" />
        <KpiCard label="Egresos Mes" value="$8,400" trend="+2.4%" icon="trending-down" />
      </View>

      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Tendencia de Inscripciones</Text>
            <View className="bg-gray-100 px-3 py-1 rounded-lg">
              <Text className="text-gray-600 text-xs">Mes</Text>
            </View>
          </View>
          <View className="h-40 bg-gray-50 rounded-xl items-center justify-center">
            <Ionicons name="trending-up" size={48} color="#801529" />
            <Text className="text-gray-400 text-sm mt-2">Inscritos reales vs meta planeada</Text>
          </View>
        </BentoCard>

        <BentoCard className={`p-5 items-center ${isMobile ? '' : 'flex-1'}`}>
          <Text className="text-lg font-bold text-gray-900 mb-4 self-start">Distribución de Usuarios</Text>
          <View className="w-28 h-28 rounded-full border-[12px] border-maroon items-center justify-center mb-4">
            <Text className="text-2xl font-bold text-maroon">2,344</Text>
          </View>
          {[
            { label: 'Estudiantes', count: 1284 },
            { label: 'Docentes', count: 86 },
            { label: 'Administrativos', count: 24 },
            { label: 'Padres', count: 950 },
          ].map((item) => (
            <View key={item.label} className="flex-row justify-between w-full py-1">
              <Text className="text-sm text-gray-600">{item.label}</Text>
              <Text className="text-sm font-semibold">{item.count}</Text>
            </View>
          ))}
        </BentoCard>
      </View>

      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-900">Transacciones Recientes</Text>
            <TouchableOpacity>
              <Text className="text-maroon text-xs font-semibold">Ver Todo</Text>
            </TouchableOpacity>
          </View>
          {TRANSACTIONS.map((tx) => (
            <View key={tx.id} className="flex-row items-center py-2.5 border-b border-gray-50">
              <Text className="text-xs text-gray-400 w-16">{tx.id}</Text>
              <Text className="flex-1 text-sm text-gray-800">{tx.user}</Text>
              <Text className="text-sm text-gray-600 w-24">{tx.concept}</Text>
              <Text className="text-sm font-semibold w-16 text-right">{tx.amount}</Text>
              <StatusBadge
                label={tx.status === 'success' ? 'Completado' : tx.status === 'warning' ? 'Pendiente' : 'Fallido'}
                variant={tx.status}
              />
            </View>
          ))}
        </BentoCard>

        <View className={`gap-4 ${isMobile ? '' : 'flex-1'}`}>
          <BentoCard className="p-5 bg-maroon">
            <Text className="text-white text-lg font-bold mb-3">Alertas Críticas</Text>
            {['Tesorería: Cierre pendiente', 'Sistemas: Backup requerido'].map((alert) => (
              <View key={alert} className="mb-2">
                <Text className="text-white/90 text-sm">{alert}</Text>
              </View>
            ))}
            <TouchableOpacity className="mt-2">
              <Text className="text-white/70 text-xs font-semibold uppercase">
                Resolver todas →
              </Text>
            </TouchableOpacity>
          </BentoCard>

          <BentoCard className="p-5">
            <Text className="text-lg font-bold text-gray-900 mb-2">Meta de Matrícula Anual</Text>
            <Text className="text-4xl font-bold text-maroon mb-2">86%</Text>
            <View className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <View className="h-full bg-maroon rounded-full" style={{ width: '86%' }} />
            </View>
            <Text className="text-xs text-gray-400">1,284 / 1,500 vacantes</Text>
          </BentoCard>
        </View>
      </View>
    </View>
  );
}
