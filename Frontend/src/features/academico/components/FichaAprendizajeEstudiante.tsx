import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { aprendizajeApi, type PerfilAprendizajeEstudiante } from '../../../api/aprendizaje.api';
import { authApi, type SesionesUsuarioDetalle } from '../../../api/auth.api';

function formatosPreferidos(perfil: PerfilAprendizajeEstudiante): string[] {
  const nombres: Record<PerfilAprendizajeEstudiante['preferred_formats'][number], string> = {
    graficos_esquemas: 'Gráficos y esquemas',
    cartas: 'Cartas explicativas',
    resumenes_directos: 'Resúmenes directos',
    ejercicios_practicos: 'Ejercicios prácticos',
  };
  return (perfil.preferred_formats ?? []).map((formato) => nombres[formato]).filter(Boolean);
}

export function FichaAprendizajeEstudiante({ usuarioId, modoDocente = false }: { usuarioId: string; modoDocente?: boolean }) {
  const [perfil, setPerfil] = useState<PerfilAprendizajeEstudiante | null>(null);
  const [sesiones, setSesiones] = useState<SesionesUsuarioDetalle | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.allSettled([
      aprendizajeApi.perfilEstudiante(usuarioId),
      authApi.sesionesUsuarioDetalle(usuarioId),
    ]).then(([resultadoPerfil, resultadoSesiones]) => {
      if (!vigente) return;
      setPerfil(resultadoPerfil.status === 'fulfilled' ? resultadoPerfil.value : null);
      setSesiones(resultadoSesiones.status === 'fulfilled' ? resultadoSesiones.value : null);
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [usuarioId]);

  const sesionesRegistradas = [...(sesiones?.activeSessions ?? []), ...(sesiones?.historySessions ?? [])]
    .filter((sesion, index, todas) => !sesion.sessionId || todas.findIndex((item) => item.sessionId === sesion.sessionId) === index);
  const evaluacion = sesionesRegistradas.some((sesion) => sesion.posibleTrampa) || (sesiones?.cheatAlerts?.length ?? 0) > 0
    ? { probabilidad: 78, nivel: 'Alta', detalle: 'Se detectaron accesos que ameritan revisar si otra persona pudo realizar alguna actividad.' }
    : sesionesRegistradas.length > 1
    ? { probabilidad: 35, nivel: 'Media', detalle: 'Hay accesos desde más de una sesión. Esto por sí solo no confirma que otra persona haya realizado actividades.' }
    : { probabilidad: 10, nivel: 'Baja', detalle: 'No hay señales suficientes para considerar probable que otra persona haya realizado actividades.' };
  const orientacion = perfil?.learning_orientation === 'teorico'
    ? 'Aprendes mejor con explicaciones y conceptos.'
    : perfil?.learning_orientation === 'practico'
    ? 'Aprendes mejor practicando y resolviendo ejercicios.'
    : perfil?.learning_orientation === 'equilibrado'
    ? 'Aprendes combinando explicaciones y práctica.'
    : 'Todavía falta evidencia para reconocer qué forma te ayuda más.';
  const formatos = perfil ? formatosPreferidos(perfil) : [];

  return (
    <View className="gap-3">
      <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <Text className="text-sm font-bold text-amber-950">Accesos y dispositivos</Text>
        {cargando ? <ActivityIndicator className="my-4" color="#B45309" /> : sesiones ? <>
          <Text className="mt-1 text-xs text-amber-900">Estado actual: {sesiones.activeSessions?.length === 1 ? 'una sesión activa' : `${sesiones.activeSessions?.length ?? 0} sesiones activas`} · accesos anteriores: {sesiones.historySessions?.length ?? 0}</Text>
          <View className="mt-3 rounded-xl border border-amber-100 bg-white p-3">
            <View className="flex-row items-center justify-between"><Text className="text-xs font-bold text-gray-800">Probabilidad estimada de ayuda externa</Text><Text className="text-sm font-extrabold text-amber-800">{evaluacion.probabilidad}% · {evaluacion.nivel}</Text></View>
            <Text className="mt-2 text-xs leading-5 text-gray-700">{evaluacion.detalle}</Text>
            <Text className="mt-2 text-[10px] leading-4 text-gray-500">Es una estimación orientativa basada en patrones de acceso; no demuestra quién completó una actividad. Revise el caso conversando con el estudiante.</Text>
          </View>
        </> : <Text className="mt-2 text-xs leading-5 text-gray-600">No se pudo obtener la información de acceso.</Text>}
        {!cargando ? <Text className="mt-3 text-xs leading-5 text-gray-700">El estudiante aún no inició sesión en otro dispositivo.</Text> : null}
      </View>

      <View className="gap-3">
        <Text className="px-1 text-base font-bold text-gray-900">Resumen de aprendizaje</Text>
        {cargando ? <View className="items-center rounded-2xl border border-violet-100 bg-violet-50 py-6"><ActivityIndicator color="#7C3AED" /></View> : perfil ? <>
          <View className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><Text className="text-[10px] font-bold uppercase text-blue-800">Ritmo de aprendizaje</Text><Text className="mt-1 text-sm leading-5 text-gray-800">{perfil.learning_rhythm || perfil.message || 'Aún no hay suficiente evidencia.'}</Text></View>
          <View className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><Text className="text-[10px] font-bold uppercase text-emerald-800">Fortalezas</Text>{perfil.strengths?.length ? perfil.strengths.map((item, index) => <Text key={`${item}-${index}`} className="mt-1 text-xs leading-5 text-gray-700">• {item}</Text>) : <Text className="mt-1 text-xs text-gray-600">Aún no se han identificado fortalezas con la evidencia disponible.</Text>}</View>
          <View className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><Text className="text-[10px] font-bold uppercase text-violet-800">Cómo aprende mejor</Text><Text className="mt-1 text-xs leading-5 text-gray-700">{orientacion}</Text>{formatos.length ? <Text className="mt-1 text-xs text-gray-600">Formatos que le ayudan: {formatos.join(', ')}.</Text> : null}</View>
          <View className="rounded-2xl border border-orange-100 bg-orange-50 p-4"><Text className="text-[10px] font-bold uppercase text-orange-800">Investigación e indagación</Text><Text className="mt-1 text-xs leading-5 text-gray-700">{perfil.investigations_count ?? 0} investigaciones · {perfil.investigated_topics_count} temas explorados</Text>{perfil.deep_inquiry_topics?.length ? <Text className="mt-1 text-xs leading-5 text-gray-600">Temas: {perfil.deep_inquiry_topics.join(', ')}</Text> : <Text className="mt-1 text-xs text-gray-500">Aún no hay temas de indagación registrados.</Text>}</View>
          {perfil.possible_ambitions?.length ? <View className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><Text className="text-[10px] font-bold uppercase text-indigo-800">Intereses que pueden motivarle</Text>{perfil.possible_ambitions.map((item, index) => <Text key={`${item}-${index}`} className="mt-1 text-xs leading-5 text-gray-700">• {item}</Text>)}</View> : null}
          {perfil.personalization_recommendation ? <View className="rounded-2xl border border-gray-200 bg-white p-4"><Text className="text-[10px] font-bold uppercase text-gray-600">Sugerencia de aprendizaje</Text><Text className="mt-1 text-xs leading-5 text-gray-700">{perfil.personalization_recommendation}</Text></View> : null}
          {modoDocente ? <View className="rounded-2xl border border-teal-100 bg-teal-50 p-4"><Text className="text-xs font-bold text-teal-950">Cómo puede apoyar el maestro</Text><Text className="mt-1 text-xs leading-5 text-teal-900">{perfil.learning_orientation === 'teorico'
            ? 'Use esquemas y explicaciones breves; pida al estudiante que explique el concepto con sus propias palabras y compruebe su comprensión con una pregunta corta.'
            : perfil.learning_orientation === 'practico'
            ? 'Modele un ejercicio, resuelva el primero junto al estudiante y después proponga una práctica breve con retroalimentación inmediata.'
            : perfil.learning_orientation === 'equilibrado'
            ? 'Combine una explicación visual breve con un ejemplo resuelto y una actividad práctica. Revise cuál formato le ayuda más en cada tema.'
            : 'Converse con el estudiante, observe cómo resuelve una actividad y pruebe dos formatos de explicación antes de decidir un apoyo.'}</Text>{perfil.confidence === 'baja' || perfil.learning_orientation === 'evidencia_insuficiente' ? <Text className="mt-2 text-[10px] leading-4 text-teal-800">El perfil tiene poca evidencia; confirme estas ideas conversando con el estudiante y observando su trabajo.</Text> : null}</View> : null}
          <Text className="px-1 text-[10px] text-gray-500">Evidencia: {perfil.evidence_activity_count} actividades, {perfil.completed_summaries} resúmenes y {perfil.completed_topics ?? 0} temas completados · confianza {perfil.confidence}</Text>
        </> : <View className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><Text className="text-xs leading-5 text-gray-600">Aún no hay evidencia suficiente para preparar un resumen de aprendizaje.</Text>{modoDocente ? <Text className="mt-2 text-xs leading-5 text-teal-900">Apoyo inicial: converse con el estudiante, observe cómo resuelve una actividad y acuerde una práctica breve para revisar juntos.</Text> : null}</View>}
      </View>
    </View>
  );
}
