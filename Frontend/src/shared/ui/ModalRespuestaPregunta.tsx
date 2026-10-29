// modal_respuesta_pregunta -> modal con la explicación de una pregunta fallada
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ModalRespuestaPreguntaProps {
  visible: boolean;
  pregunta: string;
  respuestaEstudiante: string;
  respuestaCorrecta: string;
  explicacion?: string;
  onClose: () => void;
}

export function ModalRespuestaPregunta({
  visible,
  pregunta,
  respuestaEstudiante,
  respuestaCorrecta,
  explicacion,
  onClose,
}: ModalRespuestaPreguntaProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
      <View className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[70%]">
        <View className="bg-[#801529] p-5 flex-row items-center justify-between">
          <Text className="text-white font-black text-lg">Respuesta de la pregunta</Text>
          <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
            <Ionicons name="close" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView className="p-5" contentContainerClassName="gap-4 pb-6">
          <View className="bg-rose-50 border border-rose-100 p-4 rounded-2xl">
            <Text className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-1">
              Tu respuesta
            </Text>
            <Text className="text-sm text-gray-800">{respuestaEstudiante}</Text>
          </View>

          <View className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
            <Text className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Respuesta correcta
            </Text>
            <Text className="text-sm text-gray-800">{respuestaCorrecta}</Text>
          </View>

          {explicacion && (
            <View className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex-row items-start gap-3">
              <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center shrink-0">
                <Ionicons name="bulb-outline" size={16} color="#2563EB" />
              </View>
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">
                  ¿Por qué?
                </Text>
                <Text className="text-sm text-gray-800">{explicacion}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          onPress={onClose}
          className="w-full bg-[#801529] py-4 rounded-xl items-center justify-center mt-3"
        >
          <Text className="text-white font-bold text-sm">Entendido</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
  );
}
