import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ConfirmDeleteModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  itemName?: string;
  warningNote?: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  visible,
  title = 'Confirmar eliminación',
  message,
  itemName,
  warningNote,
  loading = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/50 items-center justify-center p-4">
        <View className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
          {/* Header Icon + Title */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 items-center justify-center">
              <Ionicons name="trash-outline" size={24} color="#DC2626" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">{title}</Text>
              <Text className="text-xs text-gray-400">Acción irreversible</Text>
            </View>
          </View>

          {/* Description / Item Name */}
          <View className="mb-5">
            {itemName ? (
              <View className="p-3 bg-red-50/50 rounded-2xl border border-red-100/70 mb-2">
                <Text className="text-xs font-semibold text-gray-500 mb-0.5">Elemento a eliminar:</Text>
                <Text className="text-sm font-bold text-gray-900" numberOfLines={3}>
                  {itemName}
                </Text>
              </View>
            ) : null}

            <Text className="text-sm text-gray-600 leading-relaxed">
              {message ?? '¿Está seguro de que desea eliminar este registro de la base de datos?'}
            </Text>

            {warningNote ? (
              <View className="mt-3 flex-row items-center gap-1.5 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                <Ionicons name="warning-outline" size={16} color="#B45309" />
                <Text className="text-xs text-amber-800 flex-1">{warningNote}</Text>
              </View>
            ) : null}
          </View>

          {/* Buttons */}
          <View className="flex-row items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200"
            >
              <Text className="text-sm font-bold text-gray-700">Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              className={`px-5 py-3 rounded-xl flex-row items-center gap-2 ${
                loading ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'
              } shadow-sm`}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="trash" size={16} color="#ffffff" />
              )}
              <Text className="text-sm font-bold text-white">
                {loading ? 'Eliminando...' : 'Eliminar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
