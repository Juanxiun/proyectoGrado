import { Text, View } from 'react-native';
import type { EstadoUsuario } from '../../types';

interface StatusBadgeProps {
  status?: EstadoUsuario;
  label?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const VARIANTS = {
  success: 'bg-green-100 text-green-700 border-green-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function StatusBadge({ status, label, variant }: StatusBadgeProps) {
  let badgeLabel = label ?? 'Activo';
  let badgeVariant = variant ?? 'success';

  if (status !== undefined) {
    switch (status) {
      case 1:
        badgeLabel = 'Activo';
        badgeVariant = 'success';
        break;
      case 0:
        badgeLabel = 'Inactivo';
        badgeVariant = 'neutral';
        break;
      case 2:
        badgeLabel = 'Suspendido';
        badgeVariant = 'danger';
        break;
      default:
        badgeLabel = 'Desconocido';
        badgeVariant = 'warning';
        break;
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
