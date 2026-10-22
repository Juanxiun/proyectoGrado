import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import {
  gamificacionApi,
  type DesafioDiarioGamificacion,
  type InfoEstudianteGamificacion,
  type InsigniaEstudiante,
  type RankingParalelo,
  type RecompensaTienda,
  type ResumenGamificacion,
} from '../../../api/gamificacion.api';
import { aprendizajeApi, type PerfilAprendizajeEstudiante } from '../../../api/aprendizaje.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { KpiCard } from '../../../displays/components/KpiCard';
import { useResponsive } from '../../../utils/responsive';
import { ApiClientError } from '../../../api/client';

// Insignias del sistema gamificado
const INSIGNIAS_CATALOGO = [
  {
    codigo: 'speedrun',
    nombre: 'Speedrun',
    descripcion: 'Completar actividades en tiempo récord con alta precisión.',
    icono: 'flash' as const,
    color: '#F59E0B',
  },
  {
    codigo: 'aprendiendo_nuevas_cosas',
    nombre: 'Nuevos Horizontes',
    descripcion: 'Explorar y repasar contenido didáctico nuevo de la semana.',
    icono: 'planet' as const,
    color: '#3B82F6',
  },
  {
    codigo: 'repaso_masivo',
    nombre: 'Repaso Masivo',
    descripcion: 'Superar la marca límite de aprendizaje diario.',
    icono: 'rocket' as const,
    color: '#8B5CF6',
  },
  {
    codigo: 'volver_donde_empece',
    nombre: 'Volver Donde Empecé',
    descripcion: 'Reincorporarse al estudio tras un período inactivo.',
    icono: 'refresh' as const,
    color: '#10B981',
  },
];


function InformeAprendizajeModal({
  visible,
  loading,
  error,
  perfil,
  onClose,
  onRetry,
}: {
  visible: boolean;
  loading: boolean;
  error: string | null;
  perfil: PerfilAprendizajeEstudiante | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  const etiquetasFormato: Record<string, string> = {
    graficos_esquemas: 'Gráficos y esquemas',
    cartas: 'Cartas de microlearning',
    resumenes_directos: 'Resúmenes directos',
    ejercicios_practicos: 'Ejercicios prácticos',
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View className="flex-1 bg-black/60 justify-center p-4">
      <View className="max-h-[88%] rounded-3xl bg-white overflow-hidden">
        <View className="bg-[#801F3F] p-5 flex-row items-center justify-between">
          <View className="flex-1"><Text className="text-white text-lg font-black">Tu forma de aprender</Text><Text className="text-white/80 text-xs mt-1">Evaluación de Mistral basada en tu historial</Text></View>
          <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-white/15 items-center justify-center"><Ionicons name="close" size={20} color="white"/></TouchableOpacity>
        </View>
        <ScrollView contentContainerClassName="p-4 gap-3">
          {loading ? <View className="items-center py-10"><ActivityIndicator size="large" color="#801F3F"/><Text className="text-sm text-gray-600 mt-3">Mistral está analizando tu ritmo y tus actividades...</Text></View> : null}
          {!loading && error ? <View className="rounded-2xl bg-rose-50 p-4 gap-3"><Text className="text-sm text-rose-900">{error}</Text><TouchableOpacity onPress={onRetry} className="self-start rounded-xl bg-[#801F3F] px-4 py-2"><Text className="text-xs font-bold text-white">Volver a intentar</Text></TouchableOpacity></View> : null}
          {!loading && !error && perfil ? <>
            <View className="rounded-2xl bg-violet-50 p-4"><Text className="text-xs font-bold text-violet-900">RITMO DE APRENDIZAJE</Text><Text className="text-sm leading-6 text-gray-800 mt-1">{perfil.learning_rhythm}</Text></View>
            <View className="rounded-2xl bg-emerald-50 p-4"><Text className="text-xs font-bold text-emerald-900">FORTALEZAS</Text>{perfil.strengths.length ? perfil.strengths.map((item, i) => <Text key={`${item}-${i}`} className="text-sm text-gray-800 mt-1">• {item}</Text>) : <Text className="text-sm text-gray-600 mt-1">Todavía se necesita más historial.</Text>}</View>
            <View className="rounded-2xl bg-amber-50 p-4"><Text className="text-xs font-bold text-amber-900">CÓMO APRENDES MEJOR</Text><Text className="text-sm text-gray-800 mt-1">Enfoque: {perfil.learning_orientation.replaceAll('_', ' ')}</Text><Text className="text-sm text-gray-800 mt-1">Formatos: {perfil.preferred_formats.map((item) => etiquetasFormato[item] || item).join(', ') || 'Aún no hay una preferencia clara'}</Text></View>
            <View className="rounded-2xl bg-sky-50 p-4"><Text className="text-xs font-bold text-sky-900">INVESTIGACIÓN E INDAGACIÓN</Text><Text className="text-sm text-gray-800 mt-1">Temas explorados a profundidad: {perfil.investigated_topics_count}</Text>{perfil.deep_inquiry_topics.map((item, i) => <Text key={`${item}-${i}`} className="text-sm text-gray-700 mt-1">• {item}</Text>)}</View>
            <View className="rounded-2xl bg-gray-50 p-4"><Text className="text-xs font-bold text-gray-800">POSIBLES ÁREAS DE INTERÉS</Text><Text className="text-[10px] text-gray-500 mt-1">Son ideas exploratorias, no una decisión vocacional.</Text>{perfil.possible_ambitions.map((item, i) => <Text key={`${item}-${i}`} className="text-sm text-gray-800 mt-1">• {item}</Text>)}</View>
            <View className="rounded-2xl border border-[#E3C8D1] p-4"><Text className="text-xs font-bold text-[#801F3F]">ASÍ PERSONALIZAREMOS TU CONTENIDO</Text><Text className="text-sm leading-6 text-gray-800 mt-1">{perfil.personalization_recommendation}</Text><Text className="text-[10px] text-gray-500 mt-2">Evidencia: {perfil.evidence_activity_count} actividades y {perfil.completed_summaries} resúmenes · Confianza {perfil.confidence}</Text></View>
          </> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

// desafio -> lista diaria reutilizable
function ListaDesafiosDiarios({ desafios, bonoOtorgado, insignias }: { desafios: DesafioDiarioGamificacion[]; bonoOtorgado: boolean; insignias: InsigniaEstudiante[] }) {
  return <View className="gap-2">
    {desafios.map((reto) => <View key={reto.codigo} className="flex-row items-center gap-2 rounded-xl bg-gray-50 p-3"><Ionicons name={reto.completado ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={reto.completado ? '#16A34A' : '#9CA3AF'} /><Text className="flex-1 text-xs text-gray-800">{reto.nombre}</Text></View>)}
    {bonoOtorgado ? <Text className="text-xs font-bold text-emerald-700">¡Bono diario de 10 puntos obtenido!</Text> : null}
    {insignias.filter((insignia) => Boolean(insignia.metadata?.contentId)).map((insignia) => <View key={insignia.id} className="rounded-xl bg-amber-50 p-3"><Text className="text-xs font-bold text-amber-900">Insignia de tema completado</Text><Text className="text-[10px] text-amber-800">Tema: {String(insignia.metadata?.titulo ?? insignia.metadata?.contentId)}</Text></View>)}
  </View>;
}

export function EstudianteDashboardScreen({ onNavigate }: { onNavigate?: (route: string) => void }) {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenGamificacion | null>(null);
  const [rankings, setRankings] = useState<RankingParalelo[]>([]);
  const [selectedParalelo, setSelectedParalelo] = useState<'A' | 'B'>(user?.paralelo === 'B' ? 'B' : 'A');

  // Modal de recompensas
  const [tiendaModalOpen, setTiendaModalOpen] = useState(false);
  const [recompensas, setRecompensas] = useState<RecompensaTienda[]>([]);
  const [comprando, setComprando] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilLoading, setPerfilLoading] = useState(false);
  const [perfil, setPerfil] = useState<PerfilAprendizajeEstudiante | null>(null);
  const [perfilError, setPerfilError] = useState<string | null>(null);

  const cursoPeriodoId = user?.cursoPeriodoId || '1';

  const fetchData = async () => {
    try {
      setLoading(true);
      if (user?.id && user?.cursoPeriodoId) {
        try {
          let perfilExistente: InfoEstudianteGamificacion | null = null;
          try {
            perfilExistente = await gamificacionApi.getInfoEstudiante();
          } catch (error) {
            if (!(error instanceof ApiClientError && error.status === 404)) throw error;
          }
          if (!perfilExistente) await gamificacionApi.registrarPerfil({
              estudianteId: user.estudianteId || user.id,
              cursoPeriodoId: user.cursoPeriodoId,
              paralelo: user.paralelo === 'B' ? 'B' : 'A',
              nombre: user.nombre,
              apellidoPaterno: user.apellidoPaterno,
              avatarUrl: user.fotoUrl,
            });
        } catch (error) {
          console.warn('No se pudo sincronizar el perfil de gamificacion:', error);
        }
      }
      const [resumenData, rankingData] = await Promise.allSettled([
        gamificacionApi.getResumen(),
        gamificacionApi.getRanking(cursoPeriodoId),
      ]);

      if (resumenData.status === 'fulfilled') {
        setResumen(resumenData.value);
        setDashboardError(null);
      } else {
        setResumen(null);
        setDashboardError(resumenData.reason instanceof Error ? resumenData.reason.message : 'No se pudo cargar el resumen de gamificación.');
      }

      if (rankingData.status === 'fulfilled') {
        setRankings(rankingData.value);
      } else {
        setRankings([]);
      }
    } catch (e) {
      setDashboardError(e instanceof Error ? e.message : 'No se pudo conectar con gamificación.');
      console.error('Error cargando gamificacion:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cursoPeriodoId]);

  useEffect(() => {
    setSelectedParalelo(user?.paralelo === 'B' ? 'B' : 'A');
  }, [user?.paralelo]);

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout>;
    const programarActualizacion = () => {
      const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/La_Paz',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      }).formatToParts(new Date());
      const obtener = (tipo: string) => Number(partes.find((parte) => parte.type === tipo)?.value);
      const siguienteMedianocheUtc = Date.UTC(obtener('year'), obtener('month') - 1, obtener('day') + 1, 4);
      temporizador = setTimeout(() => {
        void fetchData();
        programarActualizacion();
      }, Math.max(1000, siguienteMedianocheUtc - Date.now() + 1000));
    };
    programarActualizacion();
    return () => clearTimeout(temporizador);
  }, [cursoPeriodoId]);

  const handleOpenTienda = async () => {
    try {
      setTiendaModalOpen(true);
      const items = await gamificacionApi.getTienda();
      setRecompensas(items.filter((item) => ['puntos dobles', 'recuperar racha'].includes(item.nombre.trim().toLocaleLowerCase('es'))));
    } catch {
      setRecompensas([]);
      Alert.alert('Tienda no disponible', 'No se pudieron cargar las recompensas. Inténtalo de nuevo.');
    }
  };

  const handleOpenPerfil = async () => {
    setPerfilOpen(true);
    setPerfilLoading(true);
    setPerfilError(null);
    try {
      const evidencia = await gamificacionApi.getEvidenciaAprendizaje();
      setPerfil(await aprendizajeApi.evaluarPerfilAprendizaje(evidencia));
    } catch (error) {
      setPerfilError(error instanceof Error ? error.message : 'No se pudo generar el informe. Inténtalo de nuevo.');
    } finally {
      setPerfilLoading(false);
    }
  };

  const handleComprarRecompensa = async (recompensa: RecompensaTienda) => {
    if ((resumen?.puntosIndividuales ?? 0) < recompensa.costoPuntosIndividuales) {
      Alert.alert('Puntos Insuficientes', `Necesitas ${recompensa.costoPuntosIndividuales} puntos individuales.`);
      return;
    }

    try {
      setComprando(true);
      await gamificacionApi.canjearRecompensa(recompensa.id);
      Alert.alert('¡Canje Exitoso!', `Has adquirido "${recompensa.nombre}".`);
      fetchData();
    } catch (error) {
      Alert.alert('No se pudo canjear', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setComprando(false);
    }
  };

  const handleSalvarRacha = async () => {
    try {
      await gamificacionApi.salvarRacha();
      Alert.alert('¡Racha Salvada!', 'Tu racha consecutiva fue rescatada exitosamente (-100 pts).');
      fetchData();
    } catch {
      Alert.alert('No se pudo salvar', 'Verifica que cuentes con 100 puntos individuales.');
    }
  };

  const racha = resumen?.racha;
  const puntosInd = resumen?.puntosIndividuales ?? 0;
  const puntosGlob = resumen?.puntosGlobales ?? 0;
  const hoyLaPaz = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/La_Paz' }).format(new Date());

  const currentRankingList = rankings.find((r) => r.paralelo === selectedParalelo)?.estudiantes ?? [];

  if (isMobile) return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
      <View className="rounded-2xl overflow-hidden bg-[#801F3F] shadow-sm">
        <View className="flex-row items-center min-h-28">
          <View className="flex-1 p-4">
            <Text className="self-start bg-[#F3D9B7] text-[#801F3F] text-[9px] font-extrabold px-2.5 py-1 rounded-full">PERFIL ESTUDIANTIL</Text>
            <Text className="text-white text-2xl font-black mt-2">¡Hola, {user?.nombre || 'Estudiante'}!</Text>
            <Text className="text-white/80 text-xs mt-1">Nivel {user?.grado || '—'} · {puntosInd.toLocaleString('es-BO')} XP</Text>
          </View>
          <View className="w-24 h-24 mr-4 rounded-full bg-white/10 items-center justify-center"><Ionicons name="school" size={46} color="#F3D9B7" /></View>
        </View>
        <View className="px-4 pb-4 pt-1"><Text className="text-white/80 text-[9px] font-bold">PUNTOS ACUMULADOS · {puntosGlob.toLocaleString('es-BO')} XP DE CURSO</Text></View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-[#F3D9B7] p-4 items-center justify-center min-h-28">
          <Ionicons name="flame" size={31} color={racha?.fecha === hoyLaPaz && racha?.completada ? '#EA580C' : '#9CA3AF'} />
          <Text className="text-[#801F3F] text-2xl font-black mt-1">{loading ? '…' : racha?.rachaActual ?? 0}</Text>
          <Text className="text-[#9C5367] text-[9px] font-bold">DÍAS DE RACHA</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-white p-4 items-center justify-center min-h-28 border border-gray-200">
          <Ionicons name="star" size={30} color="#D69A16" />
          <Text className="text-[#801F3F] text-2xl font-black mt-1">{puntosInd.toLocaleString('es-BO')}</Text>
          <Text className="text-gray-500 text-[9px] font-bold">PUNTOS ACADÉMICOS</Text>
          <Text className="text-gray-500 text-[9px] mt-1">Hoy: {resumen?.puntosHoy ?? 0}/{resumen?.limiteDiario ?? 30} pts</Text>
          <View className="mt-2 h-1.5 w-full rounded-full bg-amber-100 overflow-hidden"><View className="h-full bg-amber-500" style={{ width: `${Math.min(100, (puntosInd / 1500) * 100)}%` }}/></View>
        </View>
      </View>

      {dashboardError ? <TouchableOpacity onPress={() => void fetchData()} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><Text className="text-xs font-bold text-rose-900">No se pudo cargar gamificación</Text><Text className="text-[10px] text-rose-800 mt-1">{dashboardError}</Text><Text className="text-[10px] font-bold text-rose-900 mt-2">Toca para volver a intentar</Text></TouchableOpacity> : null}

      <View className="rounded-2xl bg-white border border-gray-200 p-4 gap-2">
        <Text className="text-[#801F3F] text-sm font-bold">Lo que estudiaste hoy</Text>
        {resumen?.aprendizajeHoy?.length ? resumen.aprendizajeHoy.map((item, index) => <View key={`${item.titulo}-${index}`} className="rounded-xl bg-[#F8F7F6] p-3"><Text className="text-xs font-bold text-gray-900">{item.materiaNombre}: {item.titulo}</Text><Text className="text-[10px] text-gray-600 mt-1">{item.aciertos}/{item.total} aciertos · {Math.round(item.porcentajeAcierto * 100)}%</Text><Text className="text-[10px] text-gray-600 mt-1">{item.feedback || (item.porcentajeAcierto > 0.8 ? 'Buen dominio; explica el concepto con tus palabras.' : 'Repasa este tema y vuelve a practicar para reforzarlo.')}</Text></View>) : <Text className="text-xs text-gray-500">Aún no registras actividades hoy.</Text>}
        {resumen?.investigarSiguiente ? <Text className="text-xs text-[#801F3F] mt-1">Para investigar: {resumen.investigarSiguiente}</Text> : null}
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity onPress={handleOpenTienda} className="w-[30%] min-h-28 rounded-2xl bg-[#801F3F] items-center justify-center">
          <Ionicons name="bag-handle-outline" size={28} color="#F3D9B7" /><Text className="text-[#F3D9B7] text-[10px] font-bold mt-2">TIENDA</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOpenPerfil} className="flex-1 rounded-2xl bg-white border border-gray-200 p-4 justify-center">
          <View className="flex-row items-center justify-between"><Text className="text-gray-500 text-[10px] font-bold">RESUMEN DE APRENDIZAJE</Text><Ionicons name="locate-outline" size={17} color="#801F3F" /></View>
          <Text className="text-[#801F3F] text-xs font-bold mt-3">Revisa tu rendimiento</Text>
          <Text className="text-gray-500 text-[10px] mt-1">Mistral analiza tu ritmo, fortalezas y formatos que te ayudan a aprender.</Text>
          <View className="mt-3 border border-[#E3C8D1] bg-[#F8F7F6] rounded-lg p-2 flex-row justify-center items-center gap-2"><Text className="text-[#801F3F] text-[9px] font-extrabold">VER REPORTES</Text><Ionicons name="arrow-forward" size={13} color="#801F3F" /></View>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between px-1 mt-1"><Text className="text-[#801F3F] font-bold text-sm">Tu progreso</Text><StatusBadge label="Ciclo actual" variant="neutral" /></View>
      <View className="rounded-2xl bg-white border border-gray-200 p-4 gap-3"><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos individuales</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosInd.toLocaleString('es-BO')} XP</Text></View><View className="h-px bg-gray-100"/><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos del curso</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosGlob.toLocaleString('es-BO')} XP</Text></View></View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-white border border-gray-200 p-3">
          <View className="flex-row items-center gap-2 mb-3"><Ionicons name="ribbon-outline" size={16} color="#D69A16" /><Text className="text-[#801F3F] text-[10px] font-bold">RANKING SEMANAL</Text></View>
          {rankings.length ? currentRankingList.slice(0, 3).map((st, index) => <View key={st.estudianteId} className="flex-row items-center gap-2 mb-3"><View className={`w-6 h-6 rounded-full items-center justify-center ${index === 0 ? 'bg-[#F3D9B7]' : 'bg-gray-100'}`}><Text className="text-[9px] font-bold text-[#801F3F]">{index + 1}</Text></View><View className="flex-1"><Text className="text-gray-800 text-[10px] font-bold" numberOfLines={1}>{st.nombre} {st.apellidoPaterno}</Text><Text className="text-gray-500 text-[9px]">{st.puntosIndividuales.toLocaleString('es-BO')} XP</Text></View></View>) : <Text className="text-gray-500 text-[10px] py-4 text-center">{loading ? 'Cargando ranking…' : 'Aún no hay estudiantes para mostrar en este paralelo.'}</Text>}
          <TouchableOpacity onPress={() => onNavigate?.('Materias')} className="items-center pt-1"><Text className="text-[#801F3F] text-[9px] font-bold">VER MATERIAS</Text></TouchableOpacity>
        </View>
      </View>

      <View className="rounded-2xl bg-white border border-gray-200 p-4 gap-2">
        <Text className="text-[#801F3F] font-bold text-sm">Desafíos diarios</Text>
        <ListaDesafiosDiarios desafios={resumen?.desafiosDiarios ?? []} bonoOtorgado={Boolean(resumen?.bonoDesafiosOtorgado)} insignias={resumen?.insignias ?? []} />
      </View>
      <InformeAprendizajeModal visible={perfilOpen} loading={perfilLoading} error={perfilError} perfil={perfil} onClose={() => setPerfilOpen(false)} onRetry={handleOpenPerfil} />
    </ScrollView>
  );

  return (
    <ScrollView className="flex-1" contentContainerClassName={isMobile ? 'gap-3 px-3 pt-2 pb-8' : 'gap-4 pb-12'}>
      {dashboardError ? <TouchableOpacity onPress={() => void fetchData()} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><Text className="text-xs font-bold text-rose-900">No se pudo cargar gamificación</Text><Text className="text-[10px] text-rose-800 mt-1">{dashboardError}</Text><Text className="text-[10px] font-bold text-rose-900 mt-2">Toca para volver a intentar</Text></TouchableOpacity> : null}
      {/* 1. HERO BANNER BENTO: RACHA DIARIA Y ACCIÓN PRINCIPAL */}
      <BentoCard className={`${isMobile ? 'p-4 rounded-[28px]' : 'p-6'} bg-maroon border-none shadow-xl overflow-hidden relative`}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center gap-2 mb-1.5">
              <View className="bg-amber-400 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                <Ionicons name="flame" size={14} color={racha?.completada ? '#78350F' : '#9CA3AF'} />
                <Text className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                  {racha?.completada ? 'Racha Diaria Activa' : 'Activa tu racha hoy'}
                </Text>
              </View>
              <Text className="text-white/70 text-xs">Meta: más del 80%</Text>
            </View>

            <Text className="text-white text-2xl font-black">
              ¡Hola, {user?.nombre || 'Estudiante'}!
            </Text>
            <Text className="text-white/80 text-xs mt-1 leading-relaxed">
              Completa una actividad diaria con más del 80% de aciertos para mantener tu racha.
            </Text>
          </View>

          {/* Medallón de Racha */}
          <View className="items-center bg-white/10 px-4 py-3 rounded-2xl border border-white/20">
            <Text className="text-3xl font-black text-amber-300">
              🔥 {racha?.rachaActual ?? 0}
            </Text>
            <Text className="text-[10px] text-white/90 font-bold uppercase tracking-wider mt-0.5">
              Días Racha
            </Text>
            <Text className="text-[9px] text-white/60">
              Récord: {racha?.mejorRacha ?? 1} d
            </Text>
          </View>
        </View>

        {/* Fila de Acciones y Estado de Racha */}
        <View className="mt-5 pt-4 border-t border-white/15 flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            {racha?.completada ? (
              <View className="flex-row items-center gap-1.5 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-400/30">
                <Ionicons name="checkmark-circle" size={16} color="#34D399" />
                <Text className="text-xs font-bold text-emerald-200">
                  Racha de hoy asegurada ({((racha.porcentajeAcierto ?? 1) * 100).toFixed(0)}%)
                </Text>
              </View>
            ) : racha?.totalPreguntas ? (
              <TouchableOpacity
                onPress={handleSalvarRacha}
                className="flex-row items-center gap-1.5 bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl shadow-sm"
              >
                <Ionicons name="shield-outline" size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">
                  Salvar Racha (100 pts)
                </Text>
              </TouchableOpacity>
            ) : <Text className="text-white/80 text-xs">Completa una actividad para activar tu racha de hoy.</Text>}
          </View>

          {/* Botón Principal: Iniciar Actividad */}
          <TouchableOpacity
            onPress={() => onNavigate?.('Materias')}
            className="bg-white hover:bg-gray-100 px-4 py-2 rounded-xl flex-row items-center gap-2 shadow-md"
          >
            <Ionicons name="play-circle" size={18} color="#801529" />
            <Text className="text-maroon font-black text-xs">
              Aprender un tema
            </Text>
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* 2. SISTEMA DE PUNTOS Y TIENDA (BENTO ROW) */}
      <View className="flex-row flex-wrap gap-3">
        {/* Puntos Individuales */}
        <BentoCard className="flex-1 min-w-[240px] p-4.5 border border-amber-200/60 bg-amber-50/40 justify-between">
          <View>
            <View className="flex-row items-center justify-between">
              <View className="w-10 h-10 rounded-xl bg-amber-500/10 items-center justify-center">
                <Ionicons name="diamond-outline" size={22} color="#D97706" />
              </View>
              <StatusBadge label="Puntos Propios" variant="warning" />
            </View>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-3">
              Puntos Individuales
            </Text>
            <Text className="text-3xl font-black text-amber-700 mt-1">
              {puntosInd} <Text className="text-sm font-semibold text-amber-600">pts</Text>
            </Text>
            <Text className="text-xs text-amber-800 mt-1">Ganados hoy: {resumen?.puntosHoy ?? 0}/{resumen?.limiteDiario ?? 30} pts</Text>
            <Text className="text-[11px] text-gray-500 mt-1 leading-snug">
              +5 por acierto rápido y de calidad · +4 por lectura de resúmenes.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenTienda}
            className="mt-4 bg-amber-600 hover:bg-amber-700 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-1.5 shadow-sm"
          >
            <Ionicons name="bag-handle-outline" size={15} color="#FFFFFF" />
            <Text className="text-white text-xs font-bold">
              Tienda de Recompensas
            </Text>
          </TouchableOpacity>
        </BentoCard>

        {/* Puntos Globales / Nivel de Curso (Paralelo A y B) */}
        <BentoCard className="flex-1 min-w-[240px] p-4.5 border border-indigo-200/60 bg-indigo-50/40 justify-between">
          <View>
            <View className="flex-row items-center justify-between">
              <View className="w-10 h-10 rounded-xl bg-indigo-500/10 items-center justify-center">
                <Ionicons name="people-outline" size={22} color="#4F46E5" />
              </View>
              <StatusBadge label="Competencia Curso" variant="info" />
            </View>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-3">
              Puntos Globales de Curso
            </Text>
            <Text className="text-3xl font-black text-indigo-700 mt-1">
              {puntosGlob} <Text className="text-sm font-semibold text-indigo-600">pts</Text>
            </Text>
            <Text className="text-[11px] text-gray-500 mt-1 leading-snug">
              Ganancia diaria de 3 a 5 pts. Desbloquea recompensas grupales de paralelo.
            </Text>
          </View>

          {/* Barra de Progreso del Premio Grupal */}
          <View className="mt-4 bg-white/80 p-2.5 rounded-xl border border-indigo-100 gap-1.5">
            <View className="flex-row items-center justify-between text-[11px]">
              <Text className="text-[11px] font-bold text-indigo-900">Premio de Curso</Text>
              <Text className="text-[11px] font-bold text-indigo-700">{puntosGlob} / 25 pts</Text>
            </View>
            <View className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
              <View
                className="h-full bg-indigo-600 rounded-full"
                style={{ width: `${Math.min(100, (puntosGlob / 25) * 100)}%` }}
              />
            </View>
          </View>
        </BentoCard>
      </View>

      {/* 3. META "CUÁNTO APRENDÍ EN UN DÍA" & INCENTIVO ADAPTATIVO */}
      <BentoCard className="p-5 border border-purple-100 bg-purple-50/30 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
              <Ionicons name="sparkles" size={17} color="#7C3AED" />
            </View>
            <Text className="text-base font-bold text-purple-950">
              ¿Cuánto Aprendí en un Día? (Microlearning)
            </Text>
          </View>
          <StatusBadge label="Adaptativo IA" variant="brand" />
        </View>

        <Text className="text-xs text-purple-900 leading-relaxed">
          Hoy estudiaste {resumen?.aprendizajeHoy?.length ?? 0} actividades y ganaste {resumen?.puntosHoy ?? 0} de {resumen?.limiteDiario ?? 30} puntos diarios.
        </Text>
        <TouchableOpacity onPress={handleOpenPerfil} className="self-start rounded-xl bg-[#801F3F] px-4 py-2 flex-row items-center gap-2"><Ionicons name="sparkles" size={15} color="white"/><Text className="text-xs font-bold text-white">Revisar mi forma de aprender</Text></TouchableOpacity>
        {resumen?.aprendizajeHoy?.length ? resumen.aprendizajeHoy.slice(0, 3).map((item, index) => <View key={`${item.titulo}-${index}`} className="rounded-xl bg-white p-3 border border-purple-100"><Text className="text-xs font-bold text-purple-950">{item.materiaNombre}: {item.titulo}</Text><Text className="text-[11px] text-gray-600 mt-1">{item.feedback || (item.porcentajeAcierto > 0.8 ? 'Buen dominio; explica el concepto con tus palabras.' : 'Vuelve a repasar y practicar este tema.')}</Text></View>) : <Text className="text-xs text-gray-500">Aún no hay actividades registradas hoy.</Text>}

        {/* Tarjeta de Sugerencia Adaptativa LLM */}
        <View className="bg-white p-3.5 rounded-2xl border border-purple-200/80 flex-row items-start gap-3 shadow-sm">
          <View className="w-8 h-8 rounded-xl bg-purple-100 items-center justify-center shrink-0">
            <Ionicons name="bulb" size={18} color="#7C3AED" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-purple-950">
              Desafío Adaptativo Recomendado
            </Text>
            <Text className="text-xs text-gray-600 mt-0.5 leading-snug">
              {resumen?.investigarSiguiente ?? 'Completa una actividad o un resumen para recibir una sugerencia de investigación.'}
            </Text>
          </View>
        </View>
      </BentoCard>

      {/* 4. TABLA DE CLASIFICACIÓN / RANKING DE PARALELOS (A vs B) */}
      <BentoCard className="p-5 gap-4">
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <View>
            <Text className="text-lg font-black text-gray-900">
              Tabla de Clasificación de Paralelos
            </Text>
            <Text className="text-xs text-gray-500">
              Puntos ganados esta semana por estudiantes de cada paralelo.
            </Text>
          </View>

          {/* Selector Paralelo A vs B */}
          <View className="flex-row bg-gray-100 p-1 rounded-xl">
            {(['A', 'B'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setSelectedParalelo(p)}
                className={`px-3 py-1.5 rounded-lg ${
                  selectedParalelo === p ? 'bg-maroon' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedParalelo === p ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  Paralelo {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Podio / Lista de Estudiantes */}
        <View className="gap-2.5">
          {currentRankingList.map((st, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;

            return (
              <View
                key={st.estudianteId}
                className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${
                  isFirst
                    ? 'bg-amber-50/80 border-amber-300'
                    : isSecond
                    ? 'bg-gray-50 border-gray-200'
                    : isThird
                    ? 'bg-orange-50/50 border-orange-200'
                    : 'bg-white border-gray-100'
                }`}
              >
                <View className="flex-row items-center gap-3">
                  {/* Número de posición con insignia */}
                  <View
                    className={`w-7 h-7 rounded-full items-center justify-center ${
                      isFirst
                        ? 'bg-amber-400'
                        : isSecond
                        ? 'bg-gray-300'
                        : isThird
                        ? 'bg-amber-600'
                        : 'bg-gray-100'
                    }`}
                  >
                    <Text className={`text-xs font-black ${isFirst || isThird ? 'text-white' : 'text-gray-700'}`}>
                      {index + 1}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-xs font-bold text-gray-900">
                      {st.nombre} {st.apellidoPaterno}
                    </Text>
                    <Text className="text-[10px] text-gray-500 font-medium">
                      🔥 {st.rachaActual}d racha · {st.promedioRendimiento}% rendimiento
                    </Text>
                  </View>
                </View>

                {/* Puntos y Medalla */}
                <View className="flex-row items-center gap-2">
                  <View className="items-end">
                    <Text className="text-xs font-black text-maroon">
                      {st.puntosIndividuales} pts
                    </Text>
                    <Text className="text-[9px] text-gray-400 font-medium">
                      {st.insigniasCount} insignias
                    </Text>
                  </View>

                  {isFirst && <Ionicons name="ribbon" size={20} color="#D97706" />}
                </View>
              </View>
            );
          })}
        </View>
      </BentoCard>

      <BentoCard className="p-5 gap-3">
        <Text className="text-lg font-black text-gray-900">Desafíos diarios</Text>
        <Text className="text-xs text-gray-500">Completa los retos para ganar hasta 20 puntos diarios y 10 puntos extra.</Text>
        <ListaDesafiosDiarios desafios={resumen?.desafiosDiarios ?? []} bonoOtorgado={Boolean(resumen?.bonoDesafiosOtorgado)} insignias={resumen?.insignias ?? []} />
      </BentoCard>

      {/* MODAL: TIENDA DE RECOMPENSAS */}
      <Modal visible={tiendaModalOpen} animationType="slide" transparent onRequestClose={() => setTiendaModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[85%]">
            <View className="bg-amber-600 p-5 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white text-base font-black">Tienda de Recompensas</Text>
                <Text className="text-white/80 text-xs">Tus Puntos: {puntosInd} pts</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTiendaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4" contentContainerClassName="gap-3">
              {recompensas.length === 0 ? <Text className="py-8 text-center text-xs text-gray-500">La tienda no tiene artículos disponibles ahora.</Text> : null}
              {recompensas.map((rec) => (
                <View
                  key={rec.id}
                  className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-xs font-bold text-gray-900">{rec.nombre}</Text>
                    <Text className="text-[11px] text-gray-500 mt-0.5">{rec.descripcion}</Text>
                    <Text className="text-xs font-black text-amber-700 mt-1">
                      {rec.costoPuntosIndividuales} pts
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleComprarRecompensa(rec)}
                    disabled={comprando || puntosInd < rec.costoPuntosIndividuales}
                    className={`px-3 py-2 rounded-xl ${
                      puntosInd >= rec.costoPuntosIndividuales
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        puntosInd >= rec.costoPuntosIndividuales ? 'text-white' : 'text-gray-400'
                      }`}
                    >
                      Canjear
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <InformeAprendizajeModal visible={perfilOpen} loading={perfilLoading} error={perfilError} perfil={perfil} onClose={() => setPerfilOpen(false)} onRetry={handleOpenPerfil} />

    </ScrollView>
  );
}
