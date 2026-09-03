import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface ProfilePhotoPickerProps {
  photoUri?: string;
  onChange: (uri: string | undefined) => void;
  required?: boolean;
}

export function ProfilePhotoPicker({ photoUri, onChange, required = true }: ProfilePhotoPickerProps) {
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled) {
        onChange(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'No se pudo seleccionar la foto');
    }
  };

  const clearPhoto = () => {
    if (!required) onChange(undefined);
    else Alert.alert('Foto obligatoria', 'La foto de perfil es requerida');
  };

  return (
    <View className="items-center mb-3">
      <TouchableOpacity onPress={pickPhoto} className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center overflow-hidden border-2 border-maroon/20">
        {photoUri ? (
          <Image source={{ uri: photoUri }} className="w-full h-full" />
        ) : (
          <Ionicons name="camera-outline" size={30} color="#7A1F3D" />
        )}
      </TouchableOpacity>
      <Text className="text-xs text-gray-500 mt-1">
        Foto PNG/JPG{required ? ' *' : ' (Opcional)'}
      </Text>
      {photoUri && !required && (
        <TouchableOpacity onPress={clearPhoto} className="mt-1 flex-row items-center gap-1">
          <Ionicons name="trash" size={12} color="#EF4444" />
          <Text className="text-red-500 text-xs">Quitar foto</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}