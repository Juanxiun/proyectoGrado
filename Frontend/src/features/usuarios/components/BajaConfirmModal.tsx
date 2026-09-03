import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFullName } from '../../../utils/validation';
import type { Usuario } from '../../../types';

interface BajaConfirmModalProps {
  user: Usuario | null;
  visible: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (user: Usuario) => void;
}

function expectedName(user: Usuario): string {
  const apPat = user.apellidoPaterno || (user as { apellido_paterno?: string }).apellido_paterno || '';
  return getFullName(user.nombre, apPat).replace(/\s+/g, ' ').trim();
}

export function BajaConfirmModal({
  user,
  visible,
  loading = false,
  onCancel,
  onConfirm,
}: BajaConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const expected = useMemo(() => (user ? expectedName(user) : ''), [user]);
  const matches = typed.trim() === expected && expected.length > 0;

  if (!user) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/50 items-center justify-center px-4">
        <View className="bg-white rounded-2xl p-5 w-full max-w-md">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="warning" size={22} color="#DC2626" />
            <Text className="text-lg font-bold text-gray-900">Confirmar baja de usuario</Text>
          </View>
          <Text className="text-sm text-gray-600 mb-3">
            Esta acción dejará inactivo a{' '}
            <Text className="font-bold text-maroon">{expected}</Text>. Para continuar, escriba
            exactamente su nombre y apellido.
          </Text>
          <Text className="text-xs text-gray-500 mb-1">Escriba: {expected}</Text>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="words"
            placeholder={expected}
            className="bg-gray-100 rounded-xl px-3 py-3 text-sm border border-gray-200 mb-4"
          />
          <View className="flex-row justify-end gap-2">
            <TouchableOpacity onPress={() => { setTyped(''); onCancel(); }} className="px-4 py-2.5 rounded-xl bg-gray-100">
              <Text className="text-gray-700 font-semibold text-sm">Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!matches || loading}
              onPress={() => onConfirm(user)}
              className={`px-4 py-2.5 rounded-xl flex-row items-center gap-2 ${
                matches && !loading ? 'bg-red-600' : 'bg-gray-300'
              }`}
            >
              {loading ? <ActivityIndicator color="#fff" size="small" /> : null}
              <Text className="text-white font-bold text-sm">Confirmar baja</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
