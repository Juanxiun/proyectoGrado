// tarjeta_estado -> tarjeta roja/verde/azul con título, valor, barra y gráfico simple
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VARIANTES: Record<string, { bg: string; border: string; icono: keyof typeof Ionicons.glyphMap; color: string }> = {
  peligro: { bg: 'bg-rose-50', border: 'border-rose-100', icono: 'alert-circle-outline', color: '#DC2626' },
  exito: { bg: 'bg-emerald-50', border: 'border-emerald-100', icono: 'checkmark-done-circle-outline', color: '#16A34A' },
  info: { bg: 'bg-blue-50', border: 'border-blue-100', icono: 'analytics-outline', color: '#2563EB' },
};

interface TarjetaEstadoProps {
  variante: 'peligro' | 'exito' | 'info';
  titulo: string;
  valor: string;
  subtitulo?: string;
  porcentaje?: number; // 0-100 para la barra de progreso
  iconoColor?: string;
}

export function TarjetaEstado({
  variante,
  titulo,
  valor,
  subtitulo,
  porcentaje,
  iconoColor,
}: TarjetaEstadoProps) {
  const v = VARIANTES[variante];
  const color = iconoColor ?? v.color;

  return (
    <View className={`rounded-3xl p-5 shadow-sm border ${v.bg} ${v.border}`}>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <View className={`w-9 h-9 rounded-2xl ${v.bg.replace('-50', '-100')} items-center justify-center`}>
            <Ionicons name={v.icono} size={18} color={color} />
          </View>
          <Text className="text-sm font-bold text-gray-800">{titulo}</Text>
        </View>
        <Text className={`text-2xl font-black ${color}`}>{valor}</Text>
      </View>
      {subtitulo && <Text className="text-xs text-gray-500 mb-3">{subtitulo}</Text>}
      {porcentaje !== null && porcentaje !== undefined && (
        <View className="gap-2">
          <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.max(0, Math.min(100, porcentaje))}%`, backgroundColor: color }}
            />
          </View>
          <Text className="text-[10px] font-bold text-gray-600 text-right">
            {porcentaje}%
          </Text>
        </View>
      )}
    </View>
  );
}
