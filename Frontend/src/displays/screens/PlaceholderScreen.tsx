import { Text, View } from 'react-native';
import { NotFoundScreen } from '../../displays/screens/ErrorScreens';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="text-gray-400 text-lg">{title}</Text>
      <Text className="text-gray-300 text-sm mt-2">Próximamente disponible</Text>
    </View>
  );
}

export { NotFoundScreen };
