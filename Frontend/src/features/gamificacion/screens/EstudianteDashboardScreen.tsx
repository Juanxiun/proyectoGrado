import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
import {
  BentoCard,
  CargaDestacada,
  KpiCard,
  ModalRespuestaPregunta,
  SvgInsignia,
  SvgPodio,
  SvgRangoMedalla,
  StatusBadge,
  TarjetaEstado,
  UserAvatar,
} from '../../../shared/ui';
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

const coloresRango: Record<'D' | 'C' | 'B' | 'A' | 'S', string> = {
  D: '#9CA3AF',
  C: '#8B5E3C',
  B: '#2563EB',
  A: '#D4A017',
  S: '#DC2626',
};

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

  return <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <View className="flex-1 bg-black/60 justify-center p-4">
      <View className="max-h-[90%] rounded-3xl bg-white overflow-hidden">
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

function ListaDesafiosDiarios({ desafios, bonoOtorgado, insignias }: { desafios: DesafioDiarioGamificacion[]; bonoOtorgado: boolean; insignias: InsigniaEstudiante[] }) {
  const NOMBRE_DESAFIO: Record<string, string> = {
    resumen: 'Ver un tema (resumen)',
    actividad: 'Resolver una actividad',
    puntos: 'Sumar puntos',
    cartas: 'Repasar con cartas',
    esquema: 'Estudiar esquema',
  };

  return <View className="gap-2">
    {desafios.map((reto) => <View key={reto.codigo} className="flex-row items-center gap-2 rounded-xl bg-gray-50 p-3"><Ionicons name={reto.completado ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={reto.completado ? '#16A34A' : '#9CA3AF'} /><Text className="flex-1 text-xs text-gray-800">{NOMBRE_DESAFIO[reto.codigo] ?? reto.nombre}</Text></View>)}
    {bonoOtorgado ? <Text className="text-xs font-bold text-emerald-700">¡Bono semanal de hasta 20 puntos obtenido!</Text> : null}
  </View>;
}

export function EstudianteDashboardScreen({ onNavigate }: { onNavigate?: (route: string) => void }) {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenGamificacion | null>(null);
  const [rankings, setRankings] = useState<RankingParalelo[]>([]);

  // Valores animados
  const puntosAnimado = useRef(new Animated.Value(0)).current;
  const rachaScale = useRef(new Animated.Value(1)).current;
  const rachaRotate = useRef(new Animated.Value(0)).current;
  const rachaBrillo = useRef(new Animated.Value(0)).current;
  const rankingOpacity = useRef(new Animated.Value(0)).current;
  const rankingTranslateY = useRef(new Animated.Value(30)).current;

  // Control de primera carga para no disparar animación falsa de racha
  const esPrimeraCarga = useRef(true);
  // Racha previamente completada (para detectar activación nueva real)
  const rachaCompletadaAntes = useRef(false);

  // Modal de recompensas
  const [tiendaModalOpen, setTiendaModalOpen] = useState(false);
  const [recompensas, setRecompensas] = useState<RecompensaTienda[]>([]);
  const [comprando, setComprando] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilLoading, setPerfilLoading] = useState(false);
  const [perfil, setPerfil] = useState<PerfilAprendizajeEstudiante | null>(null);
  const [perfilError, setPerfilError] = useState<string | null>(null);

  // Modal de respuesta de pregunta fallada
  const [respuestaModalOpen, setRespuestaModalOpen] = useState(false);
  const [respuestaPregunta, setRespuestaPregunta] = useState<{
    pregunta: string;
    respuestaEstudiante: string;
    respuestaCorrecta: string;
    explicacion?: string;
  } | null>(null);

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

  // Animaciones: puntos, racha activada y entrada del ranking
  useEffect(() => {
    if (!resumen) return;

    const esPrimero = esPrimeraCarga.current;
    esPrimeraCarga.current = false;

    // 1. Animar contador de puntos de 0 al valor actual (siempre al cargar)
    Animated.timing(puntosAnimado, {
      toValue: resumen.puntosIndividuales,
      duration: 900,
      useNativeDriver: true,
    }).start();

    // 2. Detectar activación nueva de racha diaria (solo si NO es la primera carga)
    if (!esPrimero) {
      const acabadaDeActivar = resumen.racha?.completada && !rachaCompletadaAntes.current;
      rachaCompletadaAntes.current = resumen.racha?.completada ?? false;

      if (acabadaDeActivar) {
        // Pulso de escala + giro ligero + brillo en el medallón de fuego
        Animated.sequence([
          Animated.parallel([
            Animated.timing(rachaScale, { toValue: 1.25, duration: 300, useNativeDriver: true }),
            Animated.timing(rachaRotate, { toValue: 15, duration: 300, useNativeDriver: true }),
            Animated.timing(rachaBrillo, { toValue: 1, duration: 300, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(rachaScale, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(rachaRotate, { toValue: 0, duration: 400, useNativeDriver: true }),
            Animated.timing(rachaBrillo, { toValue: 0, duration: 600, useNativeDriver: true }),
          ]),
        ]).start();
      }
    } else {
      // Primera carga: sincronizar referencia sin animar
      rachaCompletadaAntes.current = resumen.racha?.completada ?? false;
    }

    // 3. Entrada animada del ranking (opacidad + deslizamiento)
    Animated.parallel([
      Animated.timing(rankingOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(rankingTranslateY, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [resumen, puntosAnimado, rachaScale, rachaRotate, rachaBrillo, rankingOpacity, rankingTranslateY]);

  const handleOpenTienda = async () => {
    setTiendaModalOpen(true);
    // Opciones por defecto si la API no responde
    setRecompensas([
      { id: 'recuperar-racha', nombre: 'Recuperar Racha Diaria', descripcion: 'Rescata tu racha consecutiva perdida', costoPuntosIndividuales: 50, tipo: 'salvar_racha' as const, stock: null, activa: true },
      { id: 'aumentar-puntos', nombre: 'Aumentar Puntos Obtenido', descripcion: 'Multiplica los puntos de tu próxima actividad', costoPuntosIndividuales: 30, tipo: 'pista_examen' as const, stock: null, activa: true },
    ]);
    try {
      const items = await gamificacionApi.getTienda();
      setRecompensas(items);
    } catch {
      Alert.alert('Tienda no disponible', 'Se usaron las opciones predeterminadas. Inténtalo de nuevo más tarde.');
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
      await fetchData();
    } catch (error) {
      Alert.alert('No se pudo canjear', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setComprando(false);
    }
  };

  const handleSalvarRacha = async () => {
    try {
      await gamificacionApi.salvarRacha();
      Alert.alert('¡Racha Salvada!', 'Tu racha consecutiva fue rescatada exitosamente (-50 pts).');
      await fetchData();
    } catch {
      Alert.alert('No se pudo salvar', 'Verifica que cuentes con 50 puntos individuales o un salvador de racha.');
    }
  };

  const racha = resumen?.racha;
  const puntosInd = resumen?.puntosIndividuales ?? 0;
  const puntosCurso = resumen?.puntosCurso ?? puntosInd;
  const rango = resumen?.rango ?? 'D';
  const nivel = resumen?.nivel ?? 0;
  const colorRango = coloresRango[rango];
  const hoyLaPaz = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/La_Paz' }).format(new Date());

  // --- "Qué aprendí hoy" como resumen narrativo ---
  const aprendizajeHoy = resumen?.aprendizajeHoy ?? [];
  const materiasHoy = [...new Set(aprendizajeHoy.map((a) => a.materiaNombre))];
  const promedioAciertoHoy =
    aprendizajeHoy.length > 0
      ? aprendizajeHoy.reduce((acc, a) => acc + (a.porcentajeAcierto ?? 0), 0) / aprendizajeHoy.length
      : 0;
  const totalTemasHoy = aprendizajeHoy.length;
  const resumenNarrativo = () => {
    if (totalTemasHoy === 0) {
      return 'Aún no has estudiado nada hoy. ¡Anímate a completar una actividad y descubre qué aprendiste!';
    }
    const materiaPrincipal = materiasHoy[0];
    let adjetivo = 'buen';
    if (promedioAciertoHoy >= 0.8) adjetivo = 'muy buen';
    else if (promedioAciertoHoy >= 0.6) adjetivo = 'buen';
    else adjetivo = 'básico';
    const temaList = materiasHoy.slice(0, 3).join(', ');
    const masTemas = materiasHoy.length > 3 ? ` y ${materiasHoy.length - 3} más` : '';
    return `Repasaste ${totalTemasHoy} tema${totalTemasHoy > 1 ? 's' : ''} de ${temaList}${masTemas} y demostraste un rendimiento ${adjetivo}.`;
  };

  // --- Ranking del paralelo del estudiante ---
  const rankingParalelo = rankings.find((r) => r.paralelo === (user?.paralelo === 'B' ? 'B' : 'A'))?.estudiantes ?? [];
  const estudianteLogueadoId = user?.estudianteId || user?.id;

  // Estudiantes mapeados para el podio SVG del ranking (top 3 del paralelo)
  const estudiantesPodio = rankingParalelo
    .slice(0, 3)
    .map((st, i) => ({
      nombre: st.nombre,
      apellidoPaterno: st.apellidoPaterno,
      puntosIndividuales: st.puntosIndividuales,
      posicion: i + 1,
      color: coloresRango[st.rango ?? 'D'],
      esLogueado: st.estudianteId === estudianteLogueadoId,
      avatarUrl: st.avatarUrl ?? undefined,
    }));

  // --- Insignias obtenidas vs catálogo ---
  const insigniasObtenidas = resumen?.insignias ?? [];
  const insigniaPorCodigo = (codigo: string) =>
    insigniasObtenidas.some((ins) => String(ins.metadata?.contentId ?? ins.id) === codigo);

  if (isMobile) return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
      {/* 0. ERROR / VACÍO */}
      {dashboardError ? <TouchableOpacity onPress={() => void fetchData()} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><Text className="text-xs font-bold text-rose-900">No se pudo cargar gamificación</Text><Text className="text-[10px] text-rose-800 mt-1">{dashboardError}</Text><Text className="text-[10px] font-bold text-rose-900 mt-2">Toca para volver a intentar</Text></TouchableOpacity> : null}

      {/* 1. HÉROE: saludo + RANGO grande y resaltado + foto */}
      <View className="rounded-3xl overflow-hidden bg-[#801F3F] shadow-sm">
        <View className="px-5 pt-5 pb-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Tu perfil estudiantil</Text>
            <Text className="text-white text-2xl font-black mt-0.5">¡Hola, {user?.nombre || 'Estudiante'}!</Text>
            <Text className="text-white/70 text-[10px] mt-1">Nivel {nivel} · Rango {rango} · {puntosCurso.toLocaleString('es-BO')} XP</Text>
          </View>
          <UserAvatar
            nombre={user?.nombre}
            apellidoPaterno={user?.apellidoPaterno}
            fotoUrl={user?.fotoUrl ?? undefined}
            className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30"
            textoClassName="text-white font-bold text-xl"
            bordered
          />
        </View>
        {/* Rango enorme y resaltado (SVG animado) */}
        <View className="px-5 pb-5 flex-row items-center gap-4">
          <SvgRangoMedalla
            rango={rango}
            nivel={nivel}
            colorRango={colorRango}
            tamano={130}
          />
          <View className="flex-1">
            <Text className="text-[#F3D9B7] text-[11px] font-bold uppercase tracking-wider">Rango actual</Text>
            <Text className="text-white text-lg font-black mt-0.5">Nivel {nivel} · {puntosCurso.toLocaleString('es-BO')} XP</Text>
            <Text className="text-white/70 text-[10px] mt-1">{resumen?.tag ?? '—'} · {resumen?.puntosSiguienteNivel ?? 100} XP para el siguiente nivel</Text>
          </View>
        </View>
      </View>

      {/* 2. RACHA DIARIA grande */}
      <View className="flex-row gap-3">
        <View className="flex-1 rounded-3xl bg-[#F3D9B7] p-4 items-center justify-center min-h-44">
          <Animated.View
            style={{
              transform: [
                { scale: rachaScale },
                { rotate: rachaRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '15deg'] }) },
              ],
            }}
            className="w-14 h-14 rounded-full bg-white/40 flex items-center justify-center mb-2"
          >
            <Ionicons name="flame" size={30} color={racha?.fecha === hoyLaPaz && racha?.completada ? '#EA580C' : '#9C5367'} />
          </Animated.View>
          <Text className="text-[#801F3F] text-3xl font-black mt-1">{loading ? '…' : racha?.rachaActual ?? 0}</Text>
          <Text className="text-[#9C5367] text-[9px] font-bold">DÍAS DE RACHA</Text>
          <Text className="text-[#9C5367] text-[9px] mt-0.5">Récord: {racha?.mejorRacha ?? 1} d</Text>
        </View>
        <View className="flex-1 rounded-3xl bg-white p-4 items-center justify-center min-h-44 border border-gray-200">
          <View className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <Ionicons name="diamond-outline" size={26} color="#D97706" />
          </View>
          <Text className="text-[#801F3F] text-3xl font-black mt-1"><Animated.Text>{puntosAnimado}</Animated.Text></Text>
          <Text className="text-gray-500 text-[9px] font-bold">PUNTOS ACADÉMICOS</Text>
          <Text className="text-gray-500 text-[9px] mt-0.5">Hoy: {resumen?.puntosHoy ?? 0}/{resumen?.limiteDiario ?? 20} pts</Text>
          <View className="mt-2 h-1.5 w-full rounded-full bg-amber-100 overflow-hidden"><View className="h-full bg-amber-500" style={{ width: `${Math.min(100, ((resumen?.puntosHoy ?? 0) / (resumen?.limiteDiario ?? 20)) * 100)}%` }}/></View>
        </View>
      </View>

      {/* 3. INSIGNIAS del estudiante */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-[#801F3F] font-bold text-sm">Tus insignias</Text>
          <Text className="text-[10px] text-gray-500 font-medium">{insigniasObtenidas.length} obtenidas</Text>
        </View>
        <View className="flex-row gap-2 px-1">
          {INSIGNIAS_CATALOGO.map((insignia) => (
            <SvgInsignia
              key={insignia.codigo}
              nombre={insignia.nombre}
              color={insignia.color}
              obtenida={insigniaPorCodigo(insignia.codigo)}
              tamano={56}
            />
          ))}
        </View>
      </View>

      {/* 4. QUÉ APRENDÍ HOY como resumen narrativo */}
      <BentoCard className="rounded-3xl p-5 border border-purple-100 bg-purple-50/40 gap-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-9 h-9 rounded-xl bg-purple-100 items-center justify-center">
              <Ionicons name="sparkles" size={18} color="#7C3AED" />
            </View>
            <Text className="text-base font-bold text-purple-950">¿Qué aprendí hoy?</Text>
          </View>
          <StatusBadge label="Resumen IA" variant="brand" />
        </View>
        <View className="rounded-2xl bg-white p-4 border border-purple-100 shadow-sm">
          <Text className="text-sm text-gray-800 leading-relaxed">{resumenNarrativo()}</Text>
          <Text className="text-[10px] text-gray-500 mt-3">
            {totalTemasHoy > 0 ? `Promedio de acierto hoy: ${Math.round(promedioAciertoHoy * 100)}% · ${totalTemasHoy} actividad${totalTemasHoy > 1 ? 'es' : ''} completada${totalTemasHoy > 1 ? 's' : ''}.` : 'Completa tu primera actividad para generar tu resumen.'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleOpenPerfil} className="self-start rounded-xl bg-[#801F3F] px-4 py-2 flex-row items-center gap-2"><Ionicons name="sparkles" size={15} color="white"/><Text className="text-xs font-bold text-white">Revisar mi forma de aprender</Text></TouchableOpacity>
      </BentoCard>

      {/* 5. ACCESOS RÁPIDOS (tienda + perfil) */}
      <View className="flex-row gap-3">
        <TouchableOpacity onPress={handleOpenTienda} className="flex-1 rounded-3xl bg-[#801F3F] items-center justify-center p-4">
          <Ionicons name="bag-handle-outline" size={30} color="#F3D9B7" /><Text className="text-[#F3D9B7] text-xs font-bold mt-2">Tienda de Recompensas</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOpenPerfil} className="flex-1 rounded-3xl bg-white border border-gray-200 p-4 justify-center">
          <View className="flex-row items-center justify-between"><Text className="text-gray-500 text-[10px] font-bold">Resumen de aprendizaje</Text><Ionicons name="locate-outline" size={17} color="#801F3F" /></View>
          <Text className="text-[#801F3F] text-xs font-bold mt-3">Revisa tu rendimiento</Text>
        </TouchableOpacity>
      </View>

      {/* 6. PROGRESO */}
      <View className="flex-row items-center justify-between px-1 mt-1"><Text className="text-[#801F3F] font-bold text-sm">Tu progreso</Text><StatusBadge label="Ciclo actual" variant="neutral" /></View>
      <View className="rounded-3xl bg-white border border-gray-200 p-4 gap-3"><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos individuales</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosInd.toLocaleString('es-BO')} XP</Text></View><View className="h-px bg-gray-100"/><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos del curso y paralelo</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosCurso.toLocaleString('es-BO')} XP</Text></View></View>

      {/* 7. RANKING COMO PODIO */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-[#801F3F] font-bold text-sm">Ranking de tu paralelo</Text>
        </View>
        <Animated.View style={{ opacity: rankingOpacity, transform: [{ translateY: rankingTranslateY }] }}>
          <SvgPodio estudiantes={estudiantesPodio} />
        </Animated.View>
      </View>

      {/* 8. DESAFÍOS DIARIOS */}
      <View className="rounded-3xl bg-white border border-gray-200 p-4 gap-2">
        <Text className="text-[#801F3F] font-bold text-sm">Desafíos diarios</Text>
        <ListaDesafiosDiarios desafios={resumen?.desafiosDiarios?.slice(0, 2) ?? []} bonoOtorgado={Boolean(resumen?.bonoDesafiosOtorgado)} insignias={resumen?.insignias ?? []} />
      </View>

      <InformeAprendizajeModal visible={perfilOpen} loading={perfilLoading} error={perfilError} perfil={perfil} onClose={() => setPerfilOpen(false)} onRetry={handleOpenPerfil} />
      <ModalRespuestaPregunta visible={respuestaModalOpen} {...(respuestaPregunta ?? { pregunta: '', respuestaEstudiante: '', respuestaCorrecta: '' })} onClose={() => setRespuestaModalOpen(false)} />
    </ScrollView>
  );

  return (
    <ScrollView className="flex-1" contentContainerClassName={isMobile ? 'gap-3 px-3 pt-2 pb-8' : 'gap-4 pb-12'}>
      {dashboardError ? <TouchableOpacity onPress={() => void fetchData()} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><Text className="text-xs font-bold text-rose-900">No se pudo cargar gamificación</Text><Text className="text-[10px] text-rose-800 mt-1">{dashboardError}</Text><Text className="text-[10px] font-bold text-rose-900 mt-2">Toca para volver a intentar</Text></TouchableOpacity> : null}
      {/* 1. HÉROE: rango grande y resaltado */}
      <View className="rounded-3xl overflow-hidden bg-[#801F3F] shadow-sm">
        <View className="px-5 pt-5 pb-4 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Tu perfil estudiantil</Text>
            <Text className="text-white text-2xl font-black mt-0.5">¡Hola, {user?.nombre || 'Estudiante'}!</Text>
            <Text className="text-white/70 text-[10px] mt-1">Nivel {nivel} · Rango {rango} · {puntosCurso.toLocaleString('es-BO')} XP</Text>
          </View>
          <UserAvatar
            nombre={user?.nombre}
            apellidoPaterno={user?.apellidoPaterno}
            fotoUrl={user?.fotoUrl ?? undefined}
            className="w-16 h-16 rounded-2xl bg-white/20 border border-white/30"
            textoClassName="text-white font-bold text-xl"
            bordered
          />
        </View>
        <View className="px-5 pb-5 flex-row items-center gap-4">
          <SvgRangoMedalla
            rango={rango}
            nivel={nivel}
            colorRango={colorRango}
            tamano={160}
          />
          <View className="flex-1">
            <Text className="text-[#F3D9B7] text-[11px] font-bold uppercase tracking-wider">Rango actual</Text>
            <Text className="text-white text-xl font-black mt-0.5">Nivel {nivel} · {puntosCurso.toLocaleString('es-BO')} XP</Text>
            <Text className="text-white/70 text-[10px] mt-1">{resumen?.tag ?? '—'} · {resumen?.puntosSiguienteNivel ?? 100} XP para el siguiente nivel</Text>
          </View>
        </View>
      </View>

      {/* 2. RACHA Y PUNTOS */}
      <View className="flex-row gap-3">
        <View className="flex-1 rounded-3xl bg-[#F3D9B7] p-4 items-center justify-center min-h-44">
          <Animated.View
            style={{
              transform: [
                { scale: rachaScale },
                { rotate: rachaRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '15deg'] }) },
              ],
            }}
            className="w-14 h-14 rounded-full bg-white/40 flex items-center justify-center mb-2"
          >
            <Ionicons name="flame" size={30} color={racha?.fecha === hoyLaPaz && racha?.completada ? '#EA580C' : '#9C5367'} />
          </Animated.View>
          <Text className="text-[#801F3F] text-3xl font-black mt-1">{loading ? '…' : racha?.rachaActual ?? 0}</Text>
          <Text className="text-[#9C5367] text-[9px] font-bold">DÍAS DE RACHA</Text>
          <Text className="text-[#9C5367] text-[9px] mt-0.5">Récord: {racha?.mejorRacha ?? 1} d</Text>
        </View>
        <View className="flex-1 rounded-3xl bg-white p-4 items-center justify-center min-h-44 border border-gray-200">
          <View className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
            <Ionicons name="diamond-outline" size={26} color="#D97706" />
          </View>
          <Text className="text-[#801F3F] text-3xl font-black mt-1"><Animated.Text>{puntosAnimado}</Animated.Text></Text>
          <Text className="text-gray-500 text-[9px] font-bold">PUNTOS ACADÉMICOS</Text>
          <Text className="text-gray-500 text-[9px] mt-0.5">Hoy: {resumen?.puntosHoy ?? 0}/{resumen?.limiteDiario ?? 20} pts</Text>
          <View className="mt-2 h-1.5 w-full rounded-full bg-amber-100 overflow-hidden"><View className="h-full bg-amber-500" style={{ width: `${Math.min(100, ((resumen?.puntosHoy ?? 0) / (resumen?.limiteDiario ?? 20)) * 100)}%` }}/></View>
        </View>
      </View>

      {/* 3. INSIGNIAS */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-[#801F3F] font-bold text-sm">Tus insignias</Text>
          <Text className="text-[10px] text-gray-500 font-medium">{insigniasObtenidas.length} obtenidas</Text>
        </View>
        <View className="flex-row gap-2 px-1">
          {INSIGNIAS_CATALOGO.map((insignia) => (
            <SvgInsignia
              key={insignia.codigo}
              nombre={insignia.nombre}
              color={insignia.color}
              obtenida={insigniaPorCodigo(insignia.codigo)}
              tamano={56}
            />
          ))}
        </View>
      </View>

      {/* 4. QUÉ APRENDÍ HOY (resumen narrativo) */}
      <BentoCard className="rounded-3xl p-5 border border-purple-100 bg-purple-50/40 gap-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-9 h-9 rounded-xl bg-purple-100 items-center justify-center">
              <Ionicons name="sparkles" size={18} color="#7C3AED" />
            </View>
            <Text className="text-base font-bold text-purple-950">¿Qué aprendí hoy?</Text>
          </View>
          <StatusBadge label="Resumen IA" variant="brand" />
        </View>
        <View className="rounded-2xl bg-white p-4 border border-purple-100 shadow-sm">
          <Text className="text-sm text-gray-800 leading-relaxed">{resumenNarrativo()}</Text>
          <Text className="text-[10px] text-gray-500 mt-3">
            {totalTemasHoy > 0 ? `Promedio de acierto hoy: ${Math.round(promedioAciertoHoy * 100)}% · ${totalTemasHoy} actividad${totalTemasHoy > 1 ? 'es' : ''} completada${totalTemasHoy > 1 ? 's' : ''}.` : 'Completa tu primera actividad para generar tu resumen.'}
          </Text>
        </View>
        <TouchableOpacity onPress={handleOpenPerfil} className="self-start rounded-xl bg-[#801F3F] px-4 py-2 flex-row items-center gap-2"><Ionicons name="sparkles" size={15} color="white"/><Text className="text-xs font-bold text-white">Revisar mi forma de aprender</Text></TouchableOpacity>
      </BentoCard>

      {/* 5. ACCESOS RÁPIDOS */}
      <View className="flex-row gap-3">
        <TouchableOpacity onPress={handleOpenTienda} className="flex-1 rounded-3xl bg-[#801F3F] items-center justify-center p-4">
          <Ionicons name="bag-handle-outline" size={30} color="#F3D9B7" /><Text className="text-[#F3D9B7] text-xs font-bold mt-2">Tienda de Recompensas</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleOpenPerfil} className="flex-1 rounded-3xl bg-white border border-gray-200 p-4 justify-center">
          <View className="flex-row items-center justify-between"><Text className="text-gray-500 text-[10px] font-bold">Resumen de aprendizaje</Text><Ionicons name="locate-outline" size={17} color="#801F3F" /></View>
          <Text className="text-[#801F3F] text-xs font-bold mt-3">Revisa tu rendimiento</Text>
        </TouchableOpacity>
      </View>

      {/* 6. PROGRESO */}
      <View className="flex-row items-center justify-between px-1 mt-1"><Text className="text-[#801F3F] font-bold text-sm">Tu progreso</Text><StatusBadge label="Ciclo actual" variant="neutral" /></View>
      <View className="rounded-3xl bg-white border border-gray-200 p-4 gap-3"><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos individuales</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosInd.toLocaleString('es-BO')} XP</Text></View><View className="h-px bg-gray-100"/><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos del curso y paralelo</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosCurso.toLocaleString('es-BO')} XP</Text></View></View>

      {/* 7. RANKING COMO PODIO */}
      <View className="gap-3">
        <View className="flex-row items-center justify-between px-1">
          <Text className="text-[#801F3F] font-bold text-sm">Ranking de tu paralelo</Text>
        </View>
        <Animated.View style={{ opacity: rankingOpacity, transform: [{ translateY: rankingTranslateY }] }}>
          <SvgPodio estudiantes={estudiantesPodio} />
        </Animated.View>
      </View>

      {/* 8. DESAFÍOS DIARIOS */}
      <View className="rounded-3xl bg-white border border-gray-200 p-4 gap-2">
        <Text className="text-[#801F3F] font-bold text-sm">Desafíos diarios</Text>
        <ListaDesafiosDiarios desafios={resumen?.desafiosDiarios?.slice(0, 2) ?? []} bonoOtorgado={Boolean(resumen?.bonoDesafiosOtorgado)} insignias={resumen?.insignias ?? []} />
      </View>

      {/* MODAL: TIENDA DE RECOMPENSAS */}
      <Modal visible={tiendaModalOpen} animationType="fade" transparent onRequestClose={() => setTiendaModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[85%]">
            <View className="bg-amber-600 p-5 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white text-base font-black">Tienda de Recompensas</Text>
                <Text className="text-white/80 text-xs">Tus Puntos: {puntosInd} pts</Text>
              </View>
              <TouchableOpacity onPress={() => setTiendaModalOpen(false)} className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4" contentContainerClassName="gap-3">
              {recompensas.length === 0 ? <Text className="py-8 text-center text-xs text-gray-500">La tienda no tiene artículos disponibles ahora.</Text> : null}
              {recompensas.map((rec) => (
                <View key={rec.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-xs font-bold text-gray-900">{rec.nombre}</Text>
                    <Text className="text-[11px] text-gray-500 mt-0.5">{rec.descripcion}</Text>
                    <Text className="text-xs font-black text-amber-700 mt-1">{rec.costoPuntosIndividuales} pts</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleComprarRecompensa(rec)} disabled={comprando || puntosInd < rec.costoPuntosIndividuales} className={`px-3 py-2 rounded-xl ${puntosInd >= rec.costoPuntosIndividuales ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-200'}`}>
                    <Text className={`text-xs font-bold ${puntosInd >= rec.costoPuntosIndividuales ? 'text-white' : 'text-gray-400'}`}>Canjear</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <InformeAprendizajeModal visible={perfilOpen} loading={perfilLoading} error={perfilError} perfil={perfil} onClose={() => setPerfilOpen(false)} onRetry={handleOpenPerfil} />
      <ModalRespuestaPregunta visible={respuestaModalOpen} {...(respuestaPregunta ?? { pregunta: '', respuestaEstudiante: '', respuestaCorrecta: '' })} onClose={() => setRespuestaModalOpen(false)} />
    </ScrollView>
  );
}
