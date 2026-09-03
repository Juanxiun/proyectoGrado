import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { BentoCard } from '../../../displays/components/BentoCard';

/** Bandeja preparada para conectar las notificaciones del usuario. */
export function NotificationsInboxCard() {
  return (
    <BentoCard className="p-5 bg-white">
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 rounded-xl bg-maroon/10 items-center justify-center">
          <Ionicons name="notifications-outline" size={21} color="#7A1F3D" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-gray-900">Bandeja de notificaciones</Text>
          <Text className="text-sm text-gray-500 mt-0.5">Mantente al tanto de las novedades.</Text>
        </View>
      </View>

      <View className="mt-4 rounded-xl bg-amber-50 border border-amber-100 px-3 py-3 flex-row items-center gap-2">
        <Ionicons name="construct-outline" size={18} color="#B45309" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-amber-900">En desarrollo</Text>
          <Text className="text-xs text-amber-800 mt-0.5">Muy pronto podrás ver tus avisos aquí.</Text>
        </View>
      </View>
    </BentoCard>
  );
}
