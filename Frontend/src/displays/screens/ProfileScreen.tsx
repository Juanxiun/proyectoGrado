import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useUsuarioDetail, useUsuarioUpdate } from '../../hooks/useUsuarios';
import { BentoCard } from '../components/BentoCard';
import { getFullName } from '../../utils/validation';
import type { Genero } from '../../types';

export function ProfileScreen() {
  const { user, updateLocalUser, logout } = useAuth();
  const { usuario, loading: loadingDetail, fetchById } = useUsuarioDetail();
  const { loading: saving, update, updateWithPhoto, success } = useUsuarioUpdate();

  const [nombre, setNombre] = useState('');
  const [apellidoPaterno, setApellidoPaterno] = useState('');
  const [apellidoMaterno, setApellidoMaterno] = useState('');
  const [email, setEmail] = useState('');
  const [genero, setGenero] = useState<Genero>('masculino');
  const [telefono, setTelefono] = useState('');
  const [zona, setZona] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fotoUri, setFotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) fetchById(user.id);
  }, [user?.id, fetchById]);

  useEffect(() => {
    if (!usuario) return;
    setNombre(usuario.nombre ?? '');
    setApellidoPaterno(usuario.apellidoPaterno ?? '');
    setApellidoMaterno(usuario.apellidoMaterno ?? '');
    setEmail(usuario.cuenta?.email ?? usuario.email ?? '');
    setGenero((usuario.genero as Genero) ?? 'masculino');
    setTelefono(usuario.contactos?.find((c) => c.tipo === 'Celular')?.contenido ?? '');
    setZona(usuario.direccion?.zona ?? '');
  }, [usuario]);

  useEffect(() => {
    if (success) Alert.alert('Éxito', 'Perfil actualizado correctamente');
  }, [success]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setFotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const payload = {
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      genero,
      cuenta: {
        email,
        ...(newPassword ? { password: newPassword } : {}),
      },
      contactos: telefono ? [{ tipo: 'Celular' as const, contenido: telefono }] : [],
      direccion: zona ? { zona } : undefined,
    };

    try {
      let result;
      if (fotoUri) {
        result = await updateWithPhoto(user.id, payload, fotoUri);
      } else {
        result = await update(user.id, payload);
      }

      updateLocalUser({
        nombre,
        apellidoPaterno,
        apellidoMaterno,
        email,
        fotoUrl: result.fotoUrl ?? user.fotoUrl,
      });
      setNewPassword('');
      setFotoUri(null);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el perfil');
    }
  };

  if (loadingDetail && !usuario) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color="#801529" />
      </View>
    );
  }

  const displayPhoto = fotoUri ?? usuario?.fotoUrl ?? user?.fotoUrl;

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <BentoCard className="p-6 mb-4">
        <View className="items-center mb-6">
          <TouchableOpacity onPress={pickImage} className="relative">
            {displayPhoto ? (
              <Image source={{ uri: displayPhoto }} className="w-24 h-24 rounded-full" />
            ) : (
              <View className="w-24 h-24 rounded-full bg-maroon items-center justify-center">
                <Text className="text-white text-3xl font-bold">
                  {nombre.charAt(0) || 'U'}
                </Text>
              </View>
            )}
            <View className="absolute bottom-0 right-0 w-8 h-8 bg-maroon rounded-full items-center justify-center border-2 border-white">
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 mt-3">
            {getFullName(nombre, apellidoPaterno, apellidoMaterno)}
          </Text>
          <Text className="text-gray-400 text-sm">@{user?.username}</Text>
        </View>

        <View className="gap-4">
          <Field label="Nombre" value={nombre} onChangeText={setNombre} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Apellido Paterno" value={apellidoPaterno} onChangeText={setApellidoPaterno} />
            </View>
            <View className="flex-1">
              <Field label="Apellido Materno" value={apellidoMaterno} onChangeText={setApellidoMaterno} />
            </View>
          </View>
          <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" />
          <Field label="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
          <Field label="Zona / Dirección" value={zona} onChangeText={setZona} />

          <View>
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
              Nueva contraseña (opcional)
            </Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl px-4 border border-gray-200">
              <TextInput
                className="flex-1 py-3 text-gray-800"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                placeholder="Mínimo 8 caracteres"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-maroon rounded-xl py-4 mt-6 items-center"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-bold">Guardar cambios</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={logout}
          className="border border-red-200 rounded-xl py-3 mt-3 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="log-out-outline" size={18} color="#DC2626" />
          <Text className="text-red-600 font-semibold">Cerrar sesión</Text>
        </TouchableOpacity>
      </BentoCard>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View>
      <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{label}</Text>
      <TextInput
        className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}
