import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from './BentoCard';

interface KpiCardProps {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
}

export function KpiCard({ label, value, trend, trendUp = true, icon, iconColor = '#801529' }: KpiCardProps) {
  return (
    <BentoCard className="p-4 flex-1 min-w-[140px]">
      <View className="flex-row items-center justify-between mb-3">
        <View className="w-10 h-10 rounded-xl bg-maroon/10 items-center justify-center">
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        {trend && (
          <Text className={`text-xs font-semibold ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
            {trend}
          </Text>
        )}
      </View>
      <Text className="text-gray-500 text-xs uppercase tracking-wide">{label}</Text>
      <Text className="text-2xl font-bold text-gray-900 mt-1">{value}</Text>
    </BentoCard>
  );
}
