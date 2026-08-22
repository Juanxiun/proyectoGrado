import { Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';

interface HeroBannerProps {
  badge?: string;
  badgeSecondary?: string;
  title: string;
  subtitle: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  variant?: 'maroon' | 'bronze';
}

export function HeroBanner({
  badge,
  badgeSecondary,
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  variant = 'maroon',
}: HeroBannerProps) {
  const colors = variant === 'maroon'
    ? [COLORS.maroon, COLORS.maroonDark] as const
    : ['#8B6914', '#5c4510'] as const;

  return (
    <LinearGradient colors={colors} style={{ borderRadius: 16, padding: 24, minHeight: 180 }}>
      <View className="flex-row flex-wrap gap-2 mb-3">
        {badge && (
          <View className="bg-white/20 px-3 py-1 rounded-full">
            <Text className="text-white text-xs font-semibold uppercase">{badge}</Text>
          </View>
        )}
        {badgeSecondary && (
          <View className="bg-white/10 px-3 py-1 rounded-full">
            <Text className="text-white/80 text-xs">{badgeSecondary}</Text>
          </View>
        )}
      </View>
      <Text className="text-white text-2xl font-bold mb-2">{title}</Text>
      <Text className="text-white/80 text-sm leading-5 mb-4">{subtitle}</Text>
      <View className="flex-row flex-wrap gap-3">
        {primaryAction && (
          <TouchableOpacity
            onPress={primaryAction.onPress}
            className="bg-tan px-5 py-2.5 rounded-xl"
          >
            <Text className="text-maroon-dark font-semibold text-sm">{primaryAction.label}</Text>
          </TouchableOpacity>
        )}
        {secondaryAction && (
          <TouchableOpacity
            onPress={secondaryAction.onPress}
            className="border border-white/40 px-5 py-2.5 rounded-xl"
          >
            <Text className="text-white font-semibold text-sm">{secondaryAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}
