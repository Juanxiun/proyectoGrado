import { Text, View } from 'react-native';

interface StatusBadgeProps {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const VARIANTS = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
};

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <View className={`px-3 py-1 rounded-full self-start ${VARIANTS[variant].split(' ')[0]}`}>
      <Text className={`text-xs font-semibold ${VARIANTS[variant].split(' ')[1]}`}>{label}</Text>
    </View>
  );
}
