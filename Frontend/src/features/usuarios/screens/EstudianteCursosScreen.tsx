import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { getFullName } from '../../../utils/validation';

export function EstudianteCursosScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [compañeros, setCompañeros] = useState<any[]>([]);

  const fullName = user ? getFullName(user.nombre, user.apellidoPaterno, user.apellidoMaterno) : 'Estudiante';
  const grado = user?.grado || '3';
  const paralelo = user?.paralelo || 'A';
  const nivel = user?.nivel || 'Secundaria';

  useEffect(() => {
    async function loadCompañeros() {
      try {
        setLoading(true);
        if (user?.cursoPeriodoId) {
          const res = await academicServicesApi.list('inscripciones', {
            cursoPeriodoId: user.cursoPeriodoId,
            limit: 100,
          });
          setCompañeros(res.data as any[]);
        } else {
          setCompañeros([]);
        }
      } catch (err) {
        console.error('Error cargando compañeros de curso:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCompañeros();
  }, [user?.cursoPeriodoId]);

  return (
    <View className="flex-1 gap-4">
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Mi Curso y Paralelo</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Ficha académica del estudiante y nómina de compañeros de sección.
            </Text>
          </View>
          <StatusBadge label="Matrícula Activa" variant="success" />
        </View>
      </BentoCard>

      {/* Tarjeta resumen del curso */}
      <BentoCard className="p-6 bg-cream border border-gold/20">
        <View className="flex-row items-center gap-4">
          <View className="w-16 h-16 rounded-2xl bg-maroon items-center justify-center shadow-md">
            <Ionicons name="school" size={32} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900">
              {grado}° &quot;{paralelo}&quot; de {nivel}
            </Text>
            <Text className="text-sm text-gray-600 mt-0.5">
              Estudiante: <Text className="font-semibold">{fullName}</Text>
            </Text>
            <Text className="text-xs text-gray-400 mt-1">
              Gestión Escolar Activa • Turno Mañana
            </Text>
          </View>
        </View>
      </BentoCard>

      {/* Compañeros de curso */}
      <BentoCard className="p-5">
        <Text className="text-lg font-bold text-gray-900 mb-3">
          Compañeros de Paralelo ({compañeros.length > 0 ? compañeros.length : 'En aula'})
        </Text>

        {loading ? (
          <View className="py-8 items-center justify-center">
            <ActivityIndicator size="small" color="#801529" />
            <Text className="text-xs text-gray-500 mt-2">Cargando lista de compañeros...</Text>
          </View>
        ) : compañeros.length === 0 ? (
          <View className="py-6 items-center">
            <Ionicons name="people-outline" size={36} color="#D1D5DB" />
            <Text className="text-sm text-gray-500 mt-2">
              Sección registrada correctamente en el sistema.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {compañeros.map((item: any, i: number) => {
              const st = item.estudiante || item;
              const isMe = String(st.usuarioId) === String(user?.id);
              return (
                <View
                  key={item.id || i}
                  className={`p-3 rounded-xl flex-row items-center justify-between ${
                    isMe ? 'bg-maroon/10 border border-maroon/30' : 'bg-gray-50'
                  }`}
                >
                  <View className="flex-row items-center gap-3">
                    <View className={`w-8 h-8 rounded-full items-center justify-center ${
                      isMe ? 'bg-maroon' : 'bg-gray-200'
                    }`}>
                      <Text className={`text-xs font-bold ${isMe ? 'text-white' : 'text-gray-700'}`}>
                        {st.apellidoPaterno?.charAt(0) || st.nombre?.charAt(0) || 'A'}
                      </Text>
                    </View>
                    <Text className={`text-sm ${isMe ? 'font-bold text-maroon' : 'font-medium text-gray-800'}`}>
                      {st.apellidoPaterno} {st.apellidoMaterno} {st.nombre} {isMe ? '(Tú)' : ''}
                    </Text>
                  </View>
                  <StatusBadge label="Inscrito" variant="success" />
                </View>
              );
            })}
          </View>
        )}
      </BentoCard>
    </View>
  );
}
