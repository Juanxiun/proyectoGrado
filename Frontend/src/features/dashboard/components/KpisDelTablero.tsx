import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { KpiCard } from '../../../shared/ui';
import type { TarjetaKpi } from '../../../api/dashboard.api';

/** Las tarjetas del encabezado, con el valor ya formateado. */
export function KpisDelTablero({ kpis }: { kpis: TarjetaKpi[] }) {
  if (kpis.length === 0) {
    return (
      <View className="py-10 items-center">
        <Ionicons name="stats-chart-outline" size={34} color="#9CA3AF" />
        <Text className="text-sm text-gray-500 mt-2">Sin indicadores para este período.</Text>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap gap-3">
      {kpis.map((kpi) => (
        <View key={kpi.clave} className="flex-1 min-w-[150px]">
          <KpiCard
            label={kpi.etiqueta}
            value={formatear(kpi)}
            icon={kpi.icono as keyof typeof Ionicons.glyphMap}
            iconColor={kpi.alerta ? '#DC2626' : '#801529'}
            trend={kpi.detalle}
            trendUp={!kpi.alerta}
          />
        </View>
      ))}
    </View>
  );
}

function formatear(kpi: TarjetaKpi): string {
  if (kpi.valor === null || kpi.valor === undefined) return '—';
  const base = typeof kpi.valor === 'number' ? String(kpi.valor) : kpi.valor;
  return kpi.sufijo ? `${base}${kpi.sufijo}` : base;
}
