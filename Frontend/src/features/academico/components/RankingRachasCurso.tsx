import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { gamificacionApi, type RankingParalelo } from '../../../api/gamificacion.api';

const COLORES_PODIO = ['#D97706', '#64748B', '#B45309'];

export function RankingRachasCurso({ cursoPeriodoId }: { cursoPeriodoId: string }) {
  const [ranking, setRanking] = useState<RankingParalelo[] | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    gamificacionApi.getRanking(cursoPeriodoId)
      .then((data) => { if (vigente) setRanking(data); })
      .catch(() => { if (vigente) setRanking(null); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cursoPeriodoId]);

  if (cargando) return <View className="items-center py-6"><ActivityIndicator color="#801529" /></View>;
  if (!ranking) return <Text className="text-sm text-gray-500">El ranking de actividades no está disponible.</Text>;
  const estudiantes = ranking.flatMap((item) => item.estudiantes)
    .sort((a, b) => b.puntosIndividuales - a.puntosIndividuales || b.rachaActual - a.rachaActual || b.promedioRendimiento - a.promedioRendimiento)
    .slice(0, 10);

  return (
    <View className="gap-2">
      <Text className="text-xs text-gray-500">Top 10 por puntos conseguidos; se muestran también la racha diaria y los aciertos.</Text>
      {estudiantes.length === 0 ? <Text className="text-sm text-gray-500 py-3">Aún no hay estudiantes participando en gamificación.</Text> : estudiantes.map((item, indice) => (
        <View key={item.estudianteId} className="flex-row items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
          <View className="w-8 items-center justify-center">
            {indice < 3 ? (
              <Ionicons name="medal" size={20} color={COLORES_PODIO[indice]} />
            ) : (
              <Text className="text-sm font-black text-maroon">{indice + 1}°</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-800">{item.nombre} {item.apellidoPaterno}</Text>
            <Text className="text-[11px] text-gray-500">Racha {item.rachaActual} días · {Math.round(item.promedioRendimiento * 100)}% de acierto</Text>
          </View>
          <Text className="text-xs font-bold text-amber-700">{item.puntosIndividuales} pts</Text>
        </View>
      ))}
    </View>
  );
}
