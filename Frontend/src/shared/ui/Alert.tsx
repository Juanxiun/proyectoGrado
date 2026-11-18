// Alert -> aviso en línea para formularios
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Tone = 'danger' | 'warning' | 'info' | 'success';

const TONES: Record<
  Tone,
  { box: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string; text: string }
> = {
  // danger -> fondo sólido para leerse con brillo
  danger: { box: 'bg-red-600 border-red-600', icon: 'alert-circle', iconColor: '#FFFFFF', text: 'text-white' },
  warning: { box: 'bg-amber-50 border-amber-300', icon: 'alert-circle-outline', iconColor: '#B45309', text: 'text-amber-900' },
  info: { box: 'bg-blue-50 border-blue-200', icon: 'information-circle', iconColor: '#2563EB', text: 'text-blue-800' },
  success: { box: 'bg-green-50 border-green-200', icon: 'checkmark-circle', iconColor: '#16A34A', text: 'text-green-800' },
};

export function Alert({
  tone = 'danger',
  title,
  message,
  className = '',
}: {
  tone?: Tone;
  title?: string;
  message: string;
  className?: string;
}) {
  const { box, icon, iconColor, text } = TONES[tone];

  return (
    <View className={`flex-row items-start gap-2.5 rounded-xl border p-3.5 ${box} ${className}`}>
      <Ionicons name={icon} size={20} color={iconColor} style={{ marginTop: 1 }} />
      <View className="flex-1">
        {title ? (
          <Text className={`text-sm font-bold ${text}`}>{title}</Text>
        ) : null}
        <Text className={`text-[15px] leading-5 font-medium ${text}`}>{message}</Text>
      </View>
    </View>
  );
}
