import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usuariosApi } from '../../../api/usuarios.api';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';

export function FirstLoginProfileModal({ visible }: { visible: boolean }) {
  const { user, updateLocalUser, logout } = useAuth();
  const [zona, setZona] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tutorNombre, setTutorNombre] = useState('');
  const [tutorTelefono, setTutorTelefono] = useState('');
  const [saving, setSaving] = useState(false);

  if (!visible || !user) return null;

  const save = async () => {
    if (!zona.trim() || !telefono.trim() || !tutorNombre.trim() || !tutorTelefono.trim()) {
      Alert.alert('Datos requeridos', 'Complaza zona, teléfono y datos básicos del tutor.');
      return;
    }
    setSaving(true);
    try {
      const result = await usuariosApi.update(user.id, {
        direccion: { zona: zona.trim() },
        contactos: [{ tipo: 'Celular', contenido: telefono.trim(), principal: true }],
        apoderado: {
          nombre: tutorNombre.trim().split(' ')[0] ?? tutorNombre.trim(),
          apellidoPaterno: tutorNombre.trim().split(' ').slice(1).join(' ') || 'Tutor',
          celular: tutorTelefono.trim(),
        },
        parentesco: 'Tutor',
      } as any);
      const onboarding = (result as { onboarding?: { datosPersonalesActualizados?: boolean; contactoTutorActualizado?: boolean } }).onboarding;
      if (!onboarding?.datosPersonalesActualizados || !onboarding.contactoTutorActualizado) {
        throw new Error('No se pudo registrar el contacto del tutor. Intenta nuevamente o contacta a la administración.');
      }
      updateLocalUser({ debeCompletarPerfil: false, datosPersonalesActualizados: true, contactoTutorActualizado: true });
      Alert.alert('Perfil actualizado', 'Ya puede continuar usando la plataforma.');
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Intente nuevamente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/80 items-center justify-center p-4">
        <BentoCard className="w-full max-w-md p-6 bg-white rounded-3xl">
          <View className="items-center mb-4">
            <Ionicons name="person-circle-outline" size={42} color="#801529" />
            <Text className="text-xl font-bold text-gray-900 mt-2">Completa tu perfil</Text>
            <Text className="text-xs text-gray-500 text-center mt-1">Antes de continuar, actualiza tus datos y el contacto de tu tutor.</Text>
          </View>
          <View className="gap-3">
            <TextInput value={zona} onChangeText={setZona} placeholder="Zona / dirección" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3" />
            <TextInput value={telefono} onChangeText={(v) => setTelefono(v.replace(/[^0-9]/g, ''))} placeholder="Tu teléfono (sólo números)" keyboardType="numeric" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 font-mono" />
            <TextInput value={tutorNombre} onChangeText={setTutorNombre} placeholder="Nombre completo del tutor" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3" />
            <TextInput value={tutorTelefono} onChangeText={(v) => setTutorTelefono(v.replace(/[^0-9]/g, ''))} placeholder="Teléfono del tutor (sólo números)" keyboardType="numeric" className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 font-mono" />
          </View>
          <TouchableOpacity onPress={save} disabled={saving} className="bg-maroon rounded-xl py-3.5 items-center mt-4">
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Guardar y continuar</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => logout()} className="py-3 items-center">
            <Text className="text-xs text-gray-500 font-semibold">Cerrar sesión</Text>
          </TouchableOpacity>
        </BentoCard>
      </View>
    </Modal>
  );
}
