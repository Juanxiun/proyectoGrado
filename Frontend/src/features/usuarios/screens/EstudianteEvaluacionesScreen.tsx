import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';

interface EvaluacionEstudiante {
  id: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  ponderacion: number;
  fechaPublicacion?: string;
  fechaLimite?: string;
  estado: string;
  materiaNombre?: string;
}

export function EstudianteEvaluacionesScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionEstudiante[]>([]);

  useEffect(() => {
    async function loadExamenes() {
      try {
        setLoading(true);
        // Traer encargos y filtrar por evaluaciones/exámenes
        const res = await academicServicesApi.list('encargos', { limit: 150 });
        const all = res.data as any[];

        const exams = all
          .filter((e) => ['examen', 'evaluacion', 'parcial'].includes(String(e.tipo).toLowerCase()))
          .map((e) => ({
            id: String(e.id),
            tipo: e.tipo,
            titulo: e.titulo,
            descripcion: e.descripcion,
            ponderacion: Number(e.ponderacion) || 0,
            fechaPublicacion: e.fechaPublicacion,
            fechaLimite: e.fechaLimite,
            estado: e.estado || 'publicado',
            materiaNombre: e.asignacion?.materiaNombre || 'Asignatura',
          }));

        setEvaluaciones(exams);
      } catch (err) {
        console.error('Error cargando cronograma de exámenes:', err);
      } finally {
        setLoading(false);
      }
    }

    loadExamenes();
  }, [user?.id]);

  return (
    <View className="flex-1 gap-4">
      {/* Cabecera Informativa de Solo Lectura */}
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Cronograma de Evaluaciones</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Consulta la programación de exámenes parciales, trimestrales y pruebas institucionales.
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-xl">
            <Ionicons name="eye-outline" size={16} color="#6B7280" />
            <Text className="text-xs font-semibold text-gray-600">Modo Solo Lectura</Text>
          </View>
        </View>
      </BentoCard>

      {/* Listado de Evaluaciones */}
      {loading ? (
        <View className="py-12 items-center justify-center">
          <ActivityIndicator size="large" color="#801529" />
          <Text className="text-xs text-gray-500 mt-2 font-medium">
            Consultando calendario oficial de exámenes...
          </Text>
        </View>
      ) : evaluaciones.length === 0 ? (
        <BentoCard className="p-8 items-center text-center">
          <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
          <Text className="text-base font-bold text-gray-700 mt-2">
            No hay exámenes programados por ahora
          </Text>
          <Text className="text-xs text-gray-400 mt-1 max-w-sm">
            Tus docentes publicarán las fechas y ponderaciones oficiales cuando inicie el período de evaluaciones.
          </Text>
        </BentoCard>
      ) : (
        <View className="gap-3">
          {evaluaciones.map((ev) => {
            const isFinished = ev.fechaLimite && new Date() > new Date(ev.fechaLimite);
            return (
              <BentoCard key={ev.id} className="p-5">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="newspaper-outline" size={20} color="#801529" />
                      <Text className="text-base font-bold text-gray-900">{ev.titulo}</Text>
                      <StatusBadge
                        label={isFinished ? 'Concluido' : 'Programado'}
                        variant={isFinished ? 'neutral' : 'warning'}
                      />
                    </View>
                    <Text className="text-xs text-maroon font-semibold mt-1">
                      {ev.materiaNombre} • {ev.tipo.toUpperCase()}
                    </Text>
                    {ev.descripcion ? (
                      <Text className="text-xs text-gray-600 mt-1.5">{ev.descripcion}</Text>
                    ) : null}
                  </View>

                  <View className="bg-gold/20 px-3 py-1 rounded-lg">
                    <Text className="text-xs font-bold text-amber-900">{ev.ponderacion}% Nota</Text>
                  </View>
                </View>

                {/* Parámetros temporales en modo sólo lectura */}
                <View className="flex-row flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text className="text-xs text-gray-500">
                      Fecha Inicio: {ev.fechaPublicacion?.replace('T', ' ').slice(0, 16) || 'Por definir'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="time-outline" size={14} color="#DC2626" />
                    <Text className="text-xs font-semibold text-red-600">
                      Fecha Límite: {ev.fechaLimite?.replace('T', ' ').slice(0, 16) || 'Por definir'}
                    </Text>
                  </View>
                </View>
              </BentoCard>
            );
          })}
        </View>
      )}
    </View>
  );
}
