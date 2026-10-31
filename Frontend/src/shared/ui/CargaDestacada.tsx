// carga_destacada -> pantalla de carga resaltada mientras espera feedback de Mistral
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CargaDestacadaProps {
  mensaje?: string;
  submensaje?: string;
  color?: string;
}

export function CargaDestacada({
  mensaje = 'Generando tu retroalimentación personalizada…',
  submensaje = 'Mistral está analizando tus respuestas. Esto toma unos segundos.',
  color = '#801529',
}: CargaDestacadaProps) {
  return (
    <View className="flex-1 items-center justify-center bg-[#F4F5F7] py-8 px-4">
      <View className="items-center gap-4">
        <View className="w-20 h-20 rounded-full border-8 border-[#F4F5F7] border-t-[color:var(--color, #801529)] flex items-center justify-center">
          <ActivityIndicator size="large" color={color} />
        </View>
        <View className="w-10 h-10 rounded-full bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm border border-gray-100">
          <Ionicons name="sparkles" size={20} color={color} />
        </View>
      </View>
      <Text className="text-lg font-black text-gray-900 text-center mt-4">{mensaje}</Text>
      <Text className="text-sm text-gray-500 text-center mt-1 px-6 leading-relaxed">{submensaje}</Text>
    </View>
  );
}
