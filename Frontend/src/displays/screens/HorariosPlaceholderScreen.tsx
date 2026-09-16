import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../components/BentoCard';
import { StatusBadge } from '../components/StatusBadge';

interface HorariosPlaceholderScreenProps {
  rolName?: string;
}

export function HorariosPlaceholderScreen({ rolName = 'Usuario' }: HorariosPlaceholderScreenProps) {
  return (
    <View className="flex-1 p-4 max-w-4xl self-center w-full gap-4">
      <BentoCard className="p-6 items-center text-center">
        <View className="w-16 h-16 rounded-2xl bg-gold/15 items-center justify-center mb-4">
          <Ionicons name="time-outline" size={36} color="#801529" />
        </View>

        <StatusBadge label="En Desarrollo" variant="warning" />

        <Text className="text-2xl font-bold text-gray-900 mt-3 text-center">
          Módulo de Horarios
        </Text>

        <Text className="text-sm text-gray-500 mt-2 text-center max-w-md">
          El cronograma y distribución de períodos de clase se encuentra en fase de reserva e integración con la carga horaria institucional.
        </Text>

        <View className="mt-6 p-4 bg-gray-50 rounded-xl w-full max-w-md border border-gray-100 flex-row items-center gap-3">
          <Ionicons name="information-circle-outline" size={24} color="#801529" />
          <View className="flex-1">
            <Text className="text-xs font-semibold text-gray-800">
              Próximamente disponible
            </Text>
            <Text className="text-[11px] text-gray-500">
              Podrás consultar las aulas, bloques horarios semanales y asignaturas asignadas en tiempo real.
            </Text>
          </View>
        </View>
      </BentoCard>
    </View>
  );
}
