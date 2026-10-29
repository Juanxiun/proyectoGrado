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
import { StatusBadge, TarjetaEstado, UserAvatar } from '../../../shared/ui';
import { useResponsive } from '../../../utils/responsive';

export function EstudianteRendimientoScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [trimestre, setTrimestre] = useState<number>(1);
  const [panelData, setPanelData] = useState<PanelEstudiante | null>(null);

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
  const materiasEnRiesgo = materias.filter((m) => {
    const meta = RIESGO_META[m.nivelRiesgo];
    return m.nivelRiesgo === 'riesgo' || m.nivelRiesgo === 'riesgo_alto' || (m.promedio !== null && m.promedio < 60);
  }).length;
  const materiasFortaleza = materias.filter((m) => m.promedio !== null && m.promedio >= 80).length;
  const materiasEnRegla = materias.filter((m) => m.promedio !== null && m.promedio >= 60 && m.promedio < 80).length;

  // Promedio de comprensión (promedio general mapeado 0-100)
  const comprension = Math.max(0, Math.min(100, promedioGeneral ?? 0));
  // Tiempo de estudio estimado: índice de desempeño del período
  const tiempoEstudio = periodoActual?.indiceDesempeno ?? 0;

  // Recomendación personalizada
  const recomendacionMejora = materiasEnRiesgo > 0
    ? `Refuerza ${materiasEnRiesgo} materia${materiasEnRiesgo > 1 ? 's' : ''} en riesgo: dedica tiempo extra a sus tareas y pide apoyo a tu docente.`
    : 'No tienes materias en riesgo. ¡Sigue así y mantén el ritmo!';
  const recomendacionSeguir = materiasFortaleza > 0
    ? `Sigue destacándote en ${materiasFortaleza} materia${materiasFortaleza > 1 ? 's' : ''} con notas altas; continúa aplicando tu método de estudio actual.`
    : 'Sigue practicando de forma constante para subir tu promedio.';
  const recomendacionReforzar = materiasEnRegla > 0
    ? `Reforza ${materiasEnRegla} materia${materiasEnRegla > 1 ? 's' : ''} con rendimiento intermedio para convertirlas en fortalezas.`
    : 'Cada materia es una oportunidad de mejorar; enfócate en una a la vez.';

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

  if (loading) {
    return (
      <View className="py-16 items-center justify-center">
        <ActivityIndicator size="large" color="#801529" />
        <Text className="text-xs text-gray-500 font-medium mt-3">Consultando tu desempeño académico…</Text>
      </View>
    );
  }

  if (!periodoActual) {
    return (
      <View className="py-16 items-center justify-center">
        <Ionicons name="folder-open-outline" size={40} color="#9CA3AF" />
        <Text className="text-base font-bold text-gray-700 mt-2">
          No hay registros de desempeño para este trimestre
        </Text>
        <Text className="text-xs text-gray-400 mt-1">
          Los profesores aún no han publicado las calificaciones.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      {/* Cabecera: avatar + nombre + promedio grande */}
      <BentoCard className="p-5">
        <View className="flex-row items-start justify-between gap-4">
          <UserAvatar
            nombre={panelData?.nombre}
            apellidoPaterno={panelData?.apellidoPaterno}
            fotoUrl={undefined}
            className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30"
            textoClassName="text-white font-bold text-2xl"
            bordered
          />
          <View className="flex-1">
            <Text className="text-2xl font-black text-gray-900">
              Mi Desempeño Académico
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              {panelData?.cursoParalelo} · {periodoActual.nombre} {periodoActual.anio}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-3xl font-black text-[#801529]">
              {promedioGeneral !== null ? promedioGeneral.toFixed(1) : '—'}
            </Text>
            <Text className="text-[10px] text-gray-500 font-bold mt-0.5">Promedio / 100</Text>
          </View>
        </View>
        <StatusBadge label={RIESGO_META[periodoActual.nivelRiesgo].label} variant={RIESGO_META[periodoActual.nivelRiesgo].variant} />
      </BentoCard>

      {/* Selector de trimestre */}
      <View className="px-1">
        <View className="flex-row bg-gray-100 p-1 rounded-xl">
          {[1, 2, 3].map((t) => (
            <TouchableOpacity key={t} onPress={() => setTrimestre(t)} className={`px-3 py-1.5 rounded-lg ${trimestre === t ? 'bg-maroon' : 'bg-transparent'}`}>
              <Text className={`text-xs font-bold ${trimestre === t ? 'text-white' : 'text-gray-600'}`}>{t}° Trimestre</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tarjetas de estado roja/verde/azul */}
      <View className="flex-row flex-wrap gap-3 px-1">
        {/* Roja: lo que está fallando */}
        <TarjetaEstado
          variante="peligro"
          titulo="Lo que estás fallando"
          valor={materiasEnRiesgo.toString()}
          subtitulo="Materias que necesitan refuerzo urgente"
          porcentaje={materias.length > 0 ? Math.round((materiasEnRiesgo / materias.length) * 100) : 0}
          iconoColor="#DC2626"
        />
        {/* Verde: fortalezas */}
        <TarjetaEstado
          variante="exito"
          titulo="Tus fortalezas"
          valor={materiasFortaleza.toString()}
          subtitulo="Materias con rendimiento destacado"
          porcentaje={materias.length > 0 ? Math.round((materiasFortaleza / materias.length) * 100) : 0}
          iconoColor="#16A34A"
        />
        {/* Azul: tiempo de estudio y comprensión */}
        <TarjetaEstado
          variante="info"
          titulo="Tiempo de estudio"
          valor={tiempoEstudio !== null ? tiempoEstudio.toFixed(0) : '—'}
          subtitulo="Índice de desempeño del período"
          porcentaje={tiempoEstudio !== null ? Math.round(tiempoEstudio) : 0}
          iconoColor="#2563EB"
        />
        <TarjetaEstado
          variante="info"
          titulo="Tasa de comprensión"
          valor={comprension.toString()}
          subtitulo="Promedio general de acierto"
          porcentaje={comprension}
          iconoColor="#2563EB"
        />
      </View>

      {/* Gráfico de barras por materia */}
      {materias.length > 0 && (
        <BentoCard className="p-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Rendimiento por materia</Text>
            <Text className="text-xs text-gray-500">Promedio ponderado de tareas calificadas</Text>
          </View>
          <View className="gap-3">
            {materias.map((m) => {
              const score = m.promedio ?? 0;
              const meta = RIESGO_META[m.nivelRiesgo] || { label: 'Normal', variant: 'info' };
              return (
                <View key={m.materiaId} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-sm font-semibold text-gray-900">{m.materia}</Text>
                    <StatusBadge label={meta.label} variant={meta.variant} />
                  </View>
                  <View className="flex-row items-baseline justify-between mb-2">
                    <Text className={`text-2xl font-black ${getScoreColor(score)}`}>{score.toFixed(1)}</Text>
                    <Text className="text-xs text-gray-400 font-medium ml-1">/ 100</Text>
                  </View>
                  <View className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                    <View className={`h-full rounded-full ${getProgressBarColor(score)}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
                  </View>
                  <Text className="text-[10px] text-gray-500 mt-1">
                    {m.tareasCalificadas} de {m.tareasPublicadas} tareas · asistencia {m.asistencia?.tasa !== null ? `${m.asistencia.tasa}%` : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        </BentoCard>
      )}

      {/* Recomendación personalizada final */}
      <BentoCard className="p-5 rounded-3xl bg-amber-50 border border-amber-100 shadow-sm">
        <View className="flex-row items-start gap-3 mb-4">
          <View className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Ionicons name="bulb" size={20} color="#D97706" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-amber-900">Recomendación personalizada</Text>
            <Text className="text-xs text-gray-600 mt-1">Basada en tu desempeño de este trimestre</Text>
          </View>
        </View>
        <View className="gap-3">
          <View className="flex-row items-start gap-2">
            <Text className="text-[10px] font-bold text-red-600">En qué mejorar:</Text>
            <Text className="text-sm text-gray-800 leading-relaxed">{recomendacionMejora}</Text>
          </View>
          <View className="flex-row items-start gap-2">
            <Text className="text-[10px] font-bold text-emerald-600">Qué seguir estudiando:</Text>
            <Text className="text-sm text-gray-800 leading-relaxed">{recomendacionSeguir}</Text>
          </View>
          <View className="flex-row items-start gap-2">
            <Text className="text-[10px] font-bold text-blue-600">Dónde reforzar:</Text>
            <Text className="text-sm text-gray-800 leading-relaxed">{recomendacionReforzar}</Text>
          </View>
        </View>
      </BentoCard>

      {materias.length === 0 && (
        <BentoCard className="p-8 items-center text-center">
          <Ionicons name="folder-open-outline" size={40} color="#9CA3AF" />
          <Text className="text-base font-bold text-gray-700 mt-2">
            No hay notas computadas para este trimestre
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            Los profesores aún no han publicado las calificaciones para el {trimestre}° Trimestre.
          </Text>
        </BentoCard>
      )}
    </ScrollView>
  );
}
