import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ErrorScreenProps {
  code: string;
  title: string;
  message: string;
  onGoBack?: () => void;
}

export function ErrorScreen({ code, title, message, onGoBack }: ErrorScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-gray-100 items-center justify-center px-8">
      <View className="items-center">
        <View className="w-24 h-24 rounded-full bg-maroon/10 items-center justify-center mb-6">
          <Text className="text-maroon text-4xl font-bold">{code}</Text>
        </View>
        <Text className="text-2xl font-bold text-gray-900 mb-2">{title}</Text>
        <Text className="text-gray-500 text-center leading-6 mb-8">{message}</Text>
        {onGoBack && (
          <TouchableOpacity
            onPress={onGoBack}
            className="flex-row items-center gap-2 bg-maroon px-6 py-3 rounded-xl"
          >
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
            <Text className="text-white font-semibold">Volver al inicio</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

export function NotFoundScreen({ onGoBack }: { onGoBack?: () => void }) {
  return (
    <ErrorScreen
      code="404"
      title="Página no encontrada"
      message="La página que buscas no existe o fue movida a otra ubicación."
      onGoBack={onGoBack}
    />
  );
}

export function ServerErrorScreen({ onGoBack }: { onGoBack?: () => void }) {
  return (
    <ErrorScreen
      code="500"
      title="Error del servidor"
      message="Ocurrió un error interno. Intenta de nuevo más tarde o contacta soporte técnico."
      onGoBack={onGoBack}
    />
  );
}
