// badge -> mostrar estado con color
import { Text, View } from 'react-native';
import type { EstadoUsuario } from '../../types';

interface StatusBadgeProps {
  status?: EstadoUsuario;
  label?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
}

const VARIANTS = {
  brand: 'bg-maroon/10 text-maroon border-maroon/20',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-gray-100 text-gray-700 border-gray-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function StatusBadge({ status, label, variant }: StatusBadgeProps) {
  let badgeLabel = label ?? 'Activo';
  let badgeVariant = variant ?? 'success';

  if (status !== undefined) {
    if (status === 1 || status === 'activo') {
      badgeLabel = 'Activo';
      badgeVariant = 'success';
    } else if (status === 0 || status === 'inactivo') {
      badgeLabel = 'Inactivo';
      badgeVariant = 'neutral';
    } else if (status === 2 || status === 'bloqueado') {
      badgeLabel = 'Bloqueado';
      badgeVariant = 'danger';
    } else {
      badgeLabel = String(status);
      badgeVariant = 'warning';
    }
  }

  const styles = VARIANTS[badgeVariant];
  const [bgClass, textClass, borderClass] = styles.split(' ');

  return (
    <View className={`px-2.5 py-1 rounded-full border ${bgClass} ${borderClass}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wider ${textClass}`}>{badgeLabel}</Text>
    </View>
  );
}
