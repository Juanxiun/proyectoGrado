import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import {
  seguimientoApi,
  type DesempenoMateria,
  type PanelEstudiante,
  RIESGO_META,
} from '../../../api/seguimiento.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { KpiCard } from '../../../displays/components/KpiCard';
import { useResponsive } from '../../../utils/responsive';

export function EstudianteRendimientoScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [trimestre, setTrimestre] = useState<number>(1);
  const [panelData, setPanelData] = useState<PanelEstudiante | null>(null);
  const [selectedMateria, setSelectedMateria] = useState<DesempenoMateria | null>(null);

  const estudianteId = user?.estudianteId || user?.id || '1';
  const periodoId = user?.periodoId || '1';

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await seguimientoApi.panelEstudiante({
          estudianteId,
          periodoId,
          trimestre,
        });
        setPanelData(data);
      } catch (err) {
        console.error('Error al cargar rendimiento academico:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [estudianteId, periodoId, trimestre]);

  const periodoActual = panelData?.periodos?.[0];
  const materias = periodoActual?.materias || [];

  const promedioGeneral = periodoActual?.promedio ?? panelData?.indiceGeneral ?? 0;
  const materiasEnRiesgo = materias.filter((m) => m.nivelRiesgo === 'riesgo' || m.nivelRiesgo === 'riesgo_alto').length;
  const materiasEnRegla = materias.filter((m) => m.nivelRiesgo === 'sin_riesgo').length;

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 51) return 'text-amber-600';
    return 'text-red-600';
  };

  const getProgressBarColor = (score: number | null) => {
    if (score === null) return 'bg-gray-300';
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 51) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      {/* Cabecera Principal */}
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <View>
            <Text className="text-2xl font-black text-gray-900">
              Calificaciones y Rendimiento
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              Desglose detallado de notas, cumplimiento y evaluaciones por asignatura.
            </Text>
          </View>

          {/* Selector de Trimestre */}
          <View className="flex-row bg-gray-100 p-1 rounded-xl">
            {[1, 2, 3].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTrimestre(t)}
                className={`px-3 py-1.5 rounded-lg ${
                  trimestre === t ? 'bg-maroon' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    trimestre === t ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {t}° Trimestre
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BentoCard>

      {/* Tarjetas de Métricas Globales */}
      <View className="flex-row flex-wrap gap-3">
        <KpiCard
          label="Promedio General"
          value={promedioGeneral ? `${promedioGeneral.toFixed(1)}/100` : 'S/N'}
          icon="ribbon-outline"
          iconColor="#801529"
          trend={promedioGeneral >= 70 ? 'Rendimiento Óptimo' : 'Requiere Refuerzo'}
          trendUp={promedioGeneral >= 70}
        />
        <KpiCard
          label="Materias en Regla"
          value={`${materiasEnRegla}`}
          icon="checkmark-done-circle-outline"
          iconColor="#10B981"
          trend="Aprobadas"
          trendUp={true}
        />
        <KpiCard
          label="Materias en Riesgo"
          value={`${materiasEnRiesgo}`}
          icon="alert-circle-outline"
          iconColor="#EF4444"
          trend={materiasEnRiesgo === 0 ? 'Sin alertas' : 'Atención'}
          trendUp={materiasEnRiesgo === 0}
        />
      </View>

      {/* Lista de Materias y Calificaciones */}
      {loading ? (
        <View className="py-16 items-center justify-center">
          <ActivityIndicator size="large" color="#801529" />
          <Text className="text-xs text-gray-500 font-medium mt-3">
            Consultando registros académicos oficiales...
          </Text>
        </View>
      ) : materias.length === 0 ? (
        <BentoCard className="p-8 items-center text-center">
          <Ionicons name="folder-open-outline" size={40} color="#9CA3AF" />
          <Text className="text-base font-bold text-gray-700 mt-2">
            No hay notas computadas para este trimestre
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            Los profesores aún no han publicado las calificaciones para el {trimestre}° Trimestre.
          </Text>
        </BentoCard>
      ) : (
        <View className="gap-3">
          <Text className="text-sm font-bold text-gray-800 ml-1">
            Rendimiento Desglosado por Asignatura ({materias.length})
          </Text>

          <View className={`gap-3 ${isMobile ? '' : 'grid grid-cols-2'}`}>
            {materias.map((m) => {
              const score = m.promedio;
              const meta = RIESGO_META[m.nivelRiesgo] || { label: 'Normal', variant: 'info' };

              return (
                <BentoCard
                  key={m.materiaId}
                  className="p-4 border border-gray-100 hover:border-maroon/20 transition-all gap-3"
                >
                  {/* Fila Cabecera Materia */}
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
                        {m.materia}
                      </Text>
                      <Text className="text-xs text-gray-500 font-medium capitalize">
                        {m.tipoMateria} · {m.cursoParalelo}
                      </Text>
                    </View>
                    <StatusBadge label={meta.label} variant={meta.variant} />
                  </View>

                  {/* Indicador de Nota Grande y Barra de Progreso */}
                  <View className="bg-gray-50 p-3.5 rounded-2xl gap-2">
                    <View className="flex-row items-baseline justify-between">
                      <Text className="text-xs text-gray-500 font-medium">Nota Acumulada:</Text>
                      <View className="flex-row items-baseline">
                        <Text className={`text-2xl font-black ${getScoreColor(score)}`}>
                          {score !== null ? score.toFixed(1) : '—'}
                        </Text>
                        <Text className="text-xs text-gray-400 font-medium ml-1">/ 100</Text>
                      </View>
                    </View>

                    {/* Barra de Progreso Visual */}
                    <View className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <View
                        className={`h-full rounded-full ${getProgressBarColor(score)}`}
                        style={{ width: `${Math.min(100, Math.max(0, score ?? 0))}%` }}
                      />
                    </View>
                  </View>

                  {/* Detalle de Tareas y Asistencia */}
                  <View className="flex-row items-center justify-between pt-1 border-t border-gray-100 text-xs">
                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="checkbox-outline" size={15} color="#4B5563" />
                      <Text className="text-xs text-gray-600 font-medium">
                        Tareas: {m.tareasCalificadas} / {m.tareasPublicadas}
                      </Text>
                    </View>

                    <View className="flex-row items-center gap-1.5">
                      <Ionicons name="pie-chart-outline" size={15} color="#801529" />
                      <Text className="text-xs text-gray-600 font-medium">
                        Índice: {m.indiceDesempeno ? `${m.indiceDesempeno.toFixed(0)}%` : '—'}
                      </Text>
                    </View>
                  </View>
                </BentoCard>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
