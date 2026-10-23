import React from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../components/BentoCard';
import { useAuth } from '../../context/AuthContext';

interface Props {
  role?: string;
}

export function MobileAccessRestrictedScreen({ role = 'Usuario' }: Props) {
  const { logout, user } = useAuth();

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();

  return (
    <View className="flex-1 bg-gray-100 justify-center items-center p-6">
      <BentoCard className="max-w-md w-full p-8 items-center bg-white shadow-xl rounded-3xl border border-gray-200">
        <View className="w-20 h-20 rounded-3xl bg-maroon/10 items-center justify-center mb-6 border border-maroon/20">
          <Ionicons name="desktop-outline" size={42} color="#801529" />
        </View>

        <View className="bg-amber-100 px-3 py-1 rounded-full mb-3 border border-amber-300">
          <Text className="text-amber-800 text-xs font-bold uppercase tracking-wider">
            Plataforma Web Exclusiva
          </Text>
        </View>

        <Text className="text-2xl font-black text-gray-900 text-center mb-2">
          Acceso de Escritorio Requerido
        </Text>

        <Text className="text-sm text-gray-600 text-center leading-relaxed mb-6">
          Hola, <Text className="font-bold text-gray-900">{user?.nombre ?? roleLabel}</Text>. La interfaz móvil está optimizada y destinada <Text className="font-bold text-maroon">únicamente para el rol Estudiante</Text>.
        </Text>

        <View className="w-full bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6 gap-2.5">
          <View className="flex-row items-center gap-2.5">
            <Ionicons name="shield-checkmark" size={18} color="#801529" />
            <Text className="text-xs font-semibold text-gray-700">Rol detectado: {roleLabel}</Text>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Ionicons name="laptop-outline" size={18} color="#801529" />
            <Text className="text-xs font-semibold text-gray-700">Usa una computadora o pantalla de escritorio</Text>
          </View>
          <View className="flex-row items-center gap-2.5">
            <Ionicons name="school-outline" size={18} color="#801529" />
            <Text className="text-xs font-semibold text-gray-700">Gestión escolar y control institucional</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => logout()}
          className="w-full bg-maroon py-3.5 rounded-xl items-center justify-center shadow-sm"
        >
          <Text className="text-white font-bold text-sm">Cerrar Sesión</Text>
        </TouchableOpacity>
      </BentoCard>
    </View>
  );
}
