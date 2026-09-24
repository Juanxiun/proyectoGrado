import { useState } from 'react';
import { Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface CoverImagePickerProps {
  value?: string | null;
  onChange: (uri: string | undefined) => void;
  label?: string;
  fallbackText?: string;
  fallbackColor?: string;
  levelOrType?: string;
}

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function getFallbackGradient(typeOrLevel?: string): { bg: string; text: string; icon: keyof typeof Ionicons.glyphMap } {
  const norm = (typeOrLevel ?? '').toLowerCase();
  if (norm.includes('primaria')) return { bg: 'bg-emerald-700', text: 'text-emerald-100', icon: 'school-outline' };
  if (norm.includes('secundaria')) return { bg: 'bg-indigo-700', text: 'text-indigo-100', icon: 'library-outline' };
  if (norm.includes('inicial')) return { bg: 'bg-amber-600', text: 'text-amber-100', icon: 'color-palette-outline' };
  if (norm.includes('bachillerato')) return { bg: 'bg-purple-800', text: 'text-purple-100', icon: 'ribbon-outline' };
  if (norm.includes('extracurricular')) return { bg: 'bg-teal-700', text: 'text-teal-100', icon: 'trophy-outline' };
  if (norm.includes('matem') || norm.includes('fisi') || norm.includes('quim')) return { bg: 'bg-blue-800', text: 'text-blue-100', icon: 'calculator-outline' };
  if (norm.includes('leng') || norm.includes('lit')) return { bg: 'bg-rose-800', text: 'text-rose-100', icon: 'book-outline' };
  if (norm.includes('cien') || norm.includes('bio')) return { bg: 'bg-green-800', text: 'text-green-100', icon: 'leaf-outline' };
  if (norm.includes('soc') || norm.includes('hist')) return { bg: 'bg-amber-800', text: 'text-amber-100', icon: 'earth-outline' };
  if (norm.includes('ing') || norm.includes('idio')) return { bg: 'bg-violet-800', text: 'text-violet-100', icon: 'language-outline' };
  return { bg: 'bg-maroon', text: 'text-red-100', icon: 'bookmark-outline' };
}

export function CoverImagePicker({
  value,
  onChange,
  label = 'Carátula / Portada',
  fallbackText = 'Portada',
  levelOrType = 'general',
}: CoverImagePickerProps) {
  const [failed, setFailed] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fallback = getFallbackGradient(levelOrType);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const ext = uri.split('.').pop()?.toLowerCase() ?? '';

        // Validar formato si tiene extensión
        if (ext && !ALLOWED_EXTENSIONS.includes(ext) && !uri.startsWith('data:image/')) {
          Alert.alert('Formato inválido', 'Solo se permiten imágenes en formato JPG, PNG o WEBP.');
          return;
        }

        // Validar tamaño si está disponible
        if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
          Alert.alert('Archivo muy grande', 'La imagen de portada debe pesar entre 2 MB y 5 MB como máximo.');
          return;
        }

        setFailed(false);
        onChange(uri);
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const clearImage = () => {
    setFailed(false);
    onChange(undefined);
  };

  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-gray-700 mb-1.5">{label}</Text>
      
      <View className="flex-row items-center gap-3">
        {/* Visual Preview o Fallback */}
        <View className="w-28 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative items-center justify-center bg-gray-100">
          {value && !failed ? (
            <Image
              source={{ uri: value }}
              className="w-full h-full"
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <View className={`w-full h-full ${fallback.bg} items-center justify-center p-1`}>
              <Ionicons name={fallback.icon} size={20} color="#FFFFFF" />
              <Text className="text-[10px] font-bold text-white text-center mt-0.5" numberOfLines={1}>
                {fallbackText}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="flex-1 gap-1.5">
          <View className="flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={pickImage}
              className="flex-row items-center gap-1.5 px-3 py-2 bg-maroon/10 border border-maroon/30 rounded-xl"
            >
              <Ionicons name="image-outline" size={15} color="#801529" />
              <Text className="text-xs font-bold text-maroon">Examinar...</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowUrlInput((curr) => !curr)}
              className="flex-row items-center gap-1.5 px-2.5 py-2 bg-gray-100 border border-gray-300 rounded-xl"
            >
              <Ionicons name="link-outline" size={15} color="#4B5563" />
              <Text className="text-xs text-gray-700">URL</Text>
            </TouchableOpacity>

            {value ? (
              <TouchableOpacity
                onPress={clearImage}
                className="flex-row items-center gap-1 px-2.5 py-2 bg-red-50 border border-red-200 rounded-xl"
              >
                <Ionicons name="trash-outline" size={14} color="#DC2626" />
                <Text className="text-xs text-red-600">Quitar</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text className="text-[11px] text-gray-500">
            JPG, PNG, WEBP (Máx. 5 MB) · Si no adjunta, se usará el distintivo por defecto.
          </Text>
        </View>
      </View>

      {showUrlInput && (
        <View className="mt-2 flex-row gap-2 items-center">
          <TextInput
            value={value ?? ''}
            onChangeText={(txt) => {
              setFailed(false);
              onChange(txt.trim() || undefined);
            }}
            placeholder="https://ejemplo.com/caratula.webp"
            className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-800"
            autoCapitalize="none"
          />
        </View>
      )}
    </View>
  );
}
