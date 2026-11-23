import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  type InfoEstudianteGamificacion,
  type RecompensaTienda,
  type ResumenGamificacion,
} from '../../../api/gamificacion.api';
import { aprendizajeApi, type PerfilAprendizajeEstudiante } from '../../../api/aprendizaje.api';
import {
  BentoCard,
  SvgInsignia,
  SvgRangoMedalla,
  StatusBadge,
  UserAvatar,
} from '../../../shared/ui';
import { MarkdownContent } from '../../../shared/ui/MarkdownContent';
import { useResponsive } from '../../../utils/responsive';
import { ApiClientError } from '../../../api/client';

const INSIGNIAS_CATALOGO = [
  {
    codigo: 'speedrun',
    nombre: 'Speedrun',
    descripcion: 'Completar actividades en tiempo récord con alta precisión.',
    icono: 'flash' as const,
    color: '#F59E0B',
  },
  {
    codigo: 'nuevo_aprendizaje',
    nombre: 'Primer tema',
    descripcion: 'Explorar y repasar contenido didáctico nuevo de la semana.',
    icono: 'planet' as const,
    color: '#3B82F6',
  },
  {
    codigo: 'repaso_masivo',
    nombre: 'Gran Repaso',
    descripcion: 'Superar la marca límite de aprendizaje diario.',
    icono: 'rocket' as const,
    color: '#8B5CF6',
  },
  {
    codigo: 'reincorporacion',
    nombre: 'De regreso',
    descripcion: 'Reincorporarse al estudio tras un período inactivo.',
    icono: 'refresh' as const,
    color: '#10B981',
  },
];

const RANGOS_LISTA = [
  { id: 'D' as const, nombre: 'Explorador', desde: 0, color: '#64748B' },
  { id: 'C' as const, nombre: 'Aprendiz', desde: 1000, color: '#B87333' },
  { id: 'B' as const, nombre: 'Avanzado', desde: 2000, color: '#2563EB' },
  { id: 'A' as const, nombre: 'Experto', desde: 4500, color: '#D97706' },
  { id: 'S' as const, nombre: 'Maestro', desde: 6000, color: '#DC2626' },
];

const coloresRango: Record<'D' | 'C' | 'B' | 'A' | 'S', string> = {
  D: '#64748B',
  C: '#B87333',
  B: '#2563EB',
  A: '#D97706',
  S: '#DC2626',
};

const nombresRango: Record<'D' | 'C' | 'B' | 'A' | 'S', string> = {
  D: 'Explorador',
  C: 'Aprendiz',
  B: 'Avanzado',
  A: 'Experto',
  S: 'Maestro',
};

const ETIQUETAS_FORMATO: Record<string, string> = {
  graficos_esquemas: 'Gráficos y esquemas',
  cartas: 'Cartas de microlearning',
  resumenes_directos: 'Resúmenes directos',
  ejercicios_practicos: 'Ejercicios prácticos',
};

const NOMBRE_DESAFIO: Record<string, string> = {
  resumen: 'Completar tema o resumen',
  actividad: 'Resolver una actividad',
  puntos: 'Sumar puntos',
  cartas: 'Repasar con cartas',
  esquema: 'Estudiar esquema',
  indagacion: 'Ver pregunta de indagación',
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
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="w-full max-w-lg max-h-[90%] rounded-3xl bg-white overflow-hidden shadow-2xl">
          <View className="bg-[#801F3F] px-5 py-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 pr-2">
              <View className="h-10 w-10 rounded-2xl bg-white/15 items-center justify-center">
                <Ionicons name="analytics-outline" size={22} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-base font-black">Cómo vas en tu aprendizaje</Text>
                <Text className="text-white/80 text-[11px] mt-0.5">Análisis de tus resultados, tiempos y repasos</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-white/15 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerClassName="p-4 gap-3.5" showsVerticalScrollIndicator={false}>
            {loading ? (
              <View className="items-center py-12 gap-3">
                <ActivityIndicator size="large" color="#801F3F" />
                <Text className="text-sm font-semibold text-gray-700 text-center">
                  Analizando tus resultados, tiempos y repasos...
                </Text>
              </View>
            ) : null}

            {!loading && error ? (
              <View className="rounded-2xl border border-rose-200 bg-rose-50 p-4 gap-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="alert-circle" size={18} color="#BE123C" />
                  <Text className="text-sm font-bold text-rose-900 flex-1">{error}</Text>
                </View>
                <TouchableOpacity onPress={onRetry} className="self-start rounded-xl bg-[#801F3F] px-4 py-2">
                  <Text className="text-xs font-bold text-white">Volver a intentar</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!loading && !error && perfil ? (
              <>
                {/* Indicadores rápidos */}
                <View className="flex-row gap-2">
                  <View className="flex-1 rounded-2xl bg-slate-50 border border-slate-200 p-3 items-center">
                    <Text className="text-lg font-black text-[#801F3F]">{perfil.completed_topics ?? 0}</Text>
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Temas</Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-slate-50 border border-slate-200 p-3 items-center">
                    <Text className="text-lg font-black text-indigo-700">{perfil.evidence_activity_count}</Text>
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Retos</Text>
                  </View>
                  <View className="flex-1 rounded-2xl bg-slate-50 border border-slate-200 p-3 items-center">
                    <Text className="text-lg font-black text-emerald-700">{perfil.completed_summaries}</Text>
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Resúmenes</Text>
                  </View>
                </View>

                {/* Ritmo de aprendizaje */}
                <View className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="speedometer-outline" size={16} color="#6D28D9" />
                    <Text className="text-[11px] font-black uppercase tracking-wider text-violet-900">
                      Ritmo de aprendizaje
                    </Text>
                  </View>
                  <MarkdownContent texto={perfil.learning_rhythm} baseFontSize={13} textColor="#1F2937" />
                </View>

                {/* Fortalezas */}
                <View className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="ribbon-outline" size={16} color="#047857" />
                    <Text className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                      Tus fortalezas
                    </Text>
                  </View>
                  {perfil.strengths.length ? (
                    <View className="gap-1.5">
                      {perfil.strengths.map((item, i) => (
                        <View key={`${item}-${i}`} className="flex-row items-start gap-2 rounded-xl bg-white/80 px-3 py-2 border border-emerald-100">
                          <Ionicons name="checkmark-circle" size={15} color="#059669" style={{ marginTop: 1 }} />
                          <Text className="flex-1 text-xs leading-5 text-gray-800">{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text className="text-xs leading-5 text-gray-600">
                      Sigue practicando; tus próximos intentos ayudarán a reconocer tus avances.
                    </Text>
                  )}
                </View>

                {/* Cómo aprendes mejor */}
                <View className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="bulb-outline" size={16} color="#B45309" />
                    <Text className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                      Cómo aprendes mejor
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-800">
                    <Text className="font-bold">Enfoque: </Text>
                    {perfil.learning_orientation.replaceAll('_', ' ')}
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5 pt-0.5">
                    {perfil.preferred_formats.length ? (
                      perfil.preferred_formats.map((fmt) => (
                        <View key={fmt} className="rounded-full bg-white border border-amber-200 px-2.5 py-1">
                          <Text className="text-[11px] font-bold text-amber-900">
                            {ETIQUETAS_FORMATO[fmt] || fmt.replaceAll('_', ' ')}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-xs text-gray-600">Aún no hay una preferencia clara</Text>
                    )}
                  </View>
                </View>

                {/* Investigación e indagación */}
                <View className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="compass-outline" size={16} color="#0369A1" />
                    <Text className="text-[11px] font-black uppercase tracking-wider text-sky-900">
                      Investigación e indagación
                    </Text>
                  </View>
                  <Text className="text-xs font-semibold text-sky-950">
                    {perfil.investigations_count ?? 0} consultas · {perfil.investigated_topics_count} temas explorados
                  </Text>
                  {perfil.deep_inquiry_topics.length ? (
                    <View className="flex-row flex-wrap gap-1.5 pt-1">
                      {perfil.deep_inquiry_topics.map((item, i) => (
                        <View key={`${item}-${i}`} className="rounded-lg bg-white border border-sky-200 px-2.5 py-1">
                          <Text className="text-[11px] text-sky-900">{item}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Posibles áreas de interés */}
                {perfil.possible_ambitions.length > 0 ? (
                  <View className="rounded-2xl border border-gray-200 bg-gray-50 p-4 gap-1.5">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="sparkles-outline" size={16} color="#4B5563" />
                      <Text className="text-[11px] font-black uppercase tracking-wider text-gray-800">
                        Posibles áreas de interés
                      </Text>
                    </View>
                    <Text className="text-[10px] text-gray-500">Ideas exploratorias basadas en tus consultas.</Text>
                    <View className="flex-row flex-wrap gap-1.5 pt-1">
                      {perfil.possible_ambitions.map((item, i) => (
                        <View key={`${item}-${i}`} className="rounded-full bg-white border border-gray-200 px-2.5 py-1">
                          <Text className="text-[11px] font-semibold text-gray-800">{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Recomendación personalizada */}
                <View className="rounded-2xl border-2 border-[#E3C8D1] bg-rose-50/40 p-4 gap-1.5">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="trail-sign-outline" size={16} color="#801F3F" />
                    <Text className="text-[11px] font-black uppercase tracking-wider text-[#801F3F]">
                      Así personalizaremos tu contenido
                    </Text>
                  </View>
                  <MarkdownContent texto={perfil.personalization_recommendation} baseFontSize={13} textColor="#1F2937" />
                  <Text className="text-[10px] text-gray-500 pt-1">
                    Nivel de confianza del análisis: {perfil.confidence}
                  </Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function EstudianteDashboardScreen(_props: { onNavigate?: (route: string) => void }) {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenGamificacion | null>(null);

  const rachaScale = useRef(new Animated.Value(1)).current;
  const rachaRotate = useRef(new Animated.Value(0)).current;
  const esPrimeraCarga = useRef(true);
  const rachaCompletadaAntes = useRef(false);

  const [tiendaModalOpen, setTiendaModalOpen] = useState(false);
  const [rangosModalOpen, setRangosModalOpen] = useState(false);
  const [recompensas, setRecompensas] = useState<RecompensaTienda[]>([]);
  const [comprando, setComprando] = useState(false);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [perfilLoading, setPerfilLoading] = useState(false);
  const [perfilAutoLoading, setPerfilAutoLoading] = useState(false);
  const [perfil, setPerfil] = useState<PerfilAprendizajeEstudiante | null>(null);
  const [perfilError, setPerfilError] = useState<string | null>(null);
  const perfilAutoCargaRef = useRef<Promise<void> | null>(null);

  const cursoPeriodoId = user?.cursoPeriodoId || '1';

  const actualizarPreviaAprendizaje = async () => {
    if (perfilAutoCargaRef.current) return perfilAutoCargaRef.current;
    const carga = (async () => {
      setPerfilAutoLoading(true);
      try {
        const evidencia = await gamificacionApi.getEvidenciaAprendizaje();
        if (evidencia.resumenesCompletados < 1 || evidencia.totalActividades < 1) {
          setPerfil(null);
          return;
        }
        const resultado = await aprendizajeApi.evaluarPerfilAprendizaje(evidencia);
        setPerfil(resultado.ready === false ? null : resultado);
      } catch (error) {
        console.warn('No se pudo preparar la vista previa de aprendizaje:', error);
      } finally {
        setPerfilAutoLoading(false);
      }
    })();
    perfilAutoCargaRef.current = carga;
    try {
      await carga;
    } finally {
      perfilAutoCargaRef.current = null;
    }
  };

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
          if (!perfilExistente) {
            await gamificacionApi.registrarPerfil({
              estudianteId: user.estudianteId || user.id,
              cursoPeriodoId: user.cursoPeriodoId,
              paralelo: user.paralelo === 'B' ? 'B' : 'A',
              nombre: user.nombre,
              apellidoPaterno: user.apellidoPaterno,
              avatarUrl: user.fotoUrl,
            });
          }
        } catch (error) {
          console.warn('No se pudo sincronizar el perfil de gamificacion:', error);
        }
      }
      const [resumenData] = await Promise.allSettled([gamificacionApi.getResumen()]);

      if (resumenData.status === 'fulfilled') {
        setResumen(resumenData.value);
        setDashboardError(null);
        void actualizarPreviaAprendizaje();
      } else {
        setResumen(null);
        setDashboardError(
          resumenData.reason instanceof Error
            ? resumenData.reason.message
            : 'No se pudo cargar el resumen de gamificación.',
        );
      }
    } catch (e) {
      setDashboardError(e instanceof Error ? e.message : 'No se pudo conectar con gamificación.');
      console.error('Error cargando gamificacion:', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [cursoPeriodoId]),
  );

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

  useEffect(() => {
    if (!resumen) return;
    const esPrimero = esPrimeraCarga.current;
    esPrimeraCarga.current = false;

    if (!esPrimero) {
      const acabadaDeActivar = resumen.racha?.completada && !rachaCompletadaAntes.current;
      rachaCompletadaAntes.current = resumen.racha?.completada ?? false;
      if (acabadaDeActivar) {
        Animated.sequence([
          Animated.parallel([
            Animated.timing(rachaScale, { toValue: 1.2, duration: 280, useNativeDriver: true }),
            Animated.timing(rachaRotate, { toValue: 1, duration: 280, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(rachaScale, { toValue: 1, duration: 360, useNativeDriver: true }),
            Animated.timing(rachaRotate, { toValue: 0, duration: 360, useNativeDriver: true }),
          ]),
        ]).start();
      }
    } else {
      rachaCompletadaAntes.current = resumen.racha?.completada ?? false;
    }
  }, [resumen, rachaScale, rachaRotate]);

  const handleOpenTienda = async () => {
    setTiendaModalOpen(true);
    setRecompensas([]);
    try {
      const items = await gamificacionApi.getTienda();
      setRecompensas(items);
    } catch {
      Alert.alert('Tienda no disponible', 'No se pudo cargar el catálogo. Comprueba tu conexión e inténtalo de nuevo.');
    }
  };

  const handleOpenPerfil = async () => {
    setPerfilLoading(true);
    setPerfilError(null);
    try {
      const evidencia = await gamificacionApi.getEvidenciaAprendizaje();
      if (evidencia.resumenesCompletados < 1 || evidencia.totalActividades < 1) {
        Alert.alert(
          'Aún no hay análisis',
          `Se registraron ${evidencia.resumenesCompletados} resúmenes o temas completados y ${evidencia.totalActividades} evaluaciones. Completa ambos y vuelve a abrir esta pantalla para preparar tu informe.`,
        );
        return;
      }
      setPerfilOpen(true);
      const resultado = await aprendizajeApi.evaluarPerfilAprendizaje(evidencia);
      if (resultado.ready === false) {
        setPerfil(null);
        Alert.alert('Aún no hay análisis', resultado.message || 'Completa un resumen y una actividad para ver tu avance.');
        setPerfilOpen(false);
        return;
      }
      setPerfil(resultado);
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

  const racha = resumen?.racha;
  const puntosInd = resumen?.puntosIndividuales ?? 0;
  const puntosCurso = resumen?.puntosCurso ?? puntosInd;
  const rango = resumen?.rango ?? 'D';
  const nivel = resumen?.nivel ?? 0;
  const colorRango = coloresRango[rango];
  const nombreRango = nombresRango[rango];
  const puntosFaltantes = resumen?.puntosSiguienteNivel ?? 100;
  const progresoNivel = Math.min(100, Math.max(8, Math.round(((100 - Math.min(100, puntosFaltantes)) / 100) * 100)));
  const hoyLaPaz = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/La_Paz' }).format(new Date());

  const aprendizajeHoy = resumen?.aprendizajeHoy ?? [];
  const materiasHoy = [...new Set(aprendizajeHoy.map((a) => a.materiaNombre))];
  const temasHoy = [...new Set(aprendizajeHoy.map((a) => a.titulo).filter(Boolean))];
  const evaluacionesHoy = aprendizajeHoy.filter((actividad) => actividad.tipo === 'actividad');
  const promedioAciertoHoy =
    evaluacionesHoy.length > 0
      ? evaluacionesHoy.reduce((acc, a) => acc + (a.porcentajeAcierto ?? 0), 0) / evaluacionesHoy.length
      : 0;
  const totalTemasHoy = aprendizajeHoy.length;

  const resumenNarrativo = () => {
    if (totalTemasHoy === 0) {
      return 'Aún no hay actividad de estudio registrada para hoy. Cuando completes un resumen o una evaluación, aparecerá aquí.';
    }
    const adjetivo = promedioAciertoHoy >= 0.8 ? 'muy buen' : promedioAciertoHoy >= 0.6 ? 'buen' : 'básico';
    const temaList = temasHoy.slice(0, 3).join(', ');
    const masTemas = temasHoy.length > 3 ? ` y ${temasHoy.length - 3} más` : '';
    const materiaList = materiasHoy.slice(0, 3).join(', ');
    const rendimiento = evaluacionesHoy.length ? ` Tu evaluación reflejó un rendimiento ${adjetivo}.` : '';
    return `Hoy estudiaste ${temaList}${masTemas}${materiaList ? ` en ${materiaList}` : ''}.${rendimiento}`;
  };

  const insigniasObtenidas = resumen?.insignias ?? [];
  const insigniaPorCodigo = (codigo: string) => insigniasObtenidas.some((ins) => ins.codigo === codigo);
  const desafiosDiarios = resumen?.desafiosDiarios?.slice(0, 3) ?? [];

  return (
    <ScrollView className="flex-1" contentContainerClassName={isMobile ? 'gap-3.5 pb-8' : 'gap-4 pb-12'}>
      {dashboardError ? (
        <TouchableOpacity onPress={() => void fetchData()} className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle" size={16} color="#9F1239" />
            <Text className="text-xs font-bold text-rose-900">No se pudo cargar gamificación</Text>
          </View>
          <Text className="text-[11px] text-rose-800 mt-1">{dashboardError}</Text>
          <Text className="text-[11px] font-bold text-rose-900 mt-1.5">Toca para volver a intentar</Text>
        </TouchableOpacity>
      ) : null}

      {/* Tarjeta principal de perfil y rango */}
      <View className="rounded-3xl overflow-hidden bg-[#801F3F] shadow-md">
        <View className="px-5 pt-5 pb-3 flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-white/75 text-[10px] font-bold uppercase tracking-widest">
              Tu perfil estudiantil
            </Text>
            <Text className="text-white text-2xl font-black mt-0.5" numberOfLines={1}>
              ¡Hola, {user?.nombre || 'Estudiante'}!
            </Text>
          </View>
          <UserAvatar
            nombre={user?.nombre}
            apellidoPaterno={user?.apellidoPaterno}
            fotoUrl={user?.fotoUrl ?? undefined}
            className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30"
            textoClassName="text-white font-bold text-lg"
            bordered
          />
        </View>

        <View className="mx-4 mb-4 rounded-2xl bg-black/15 border border-white/15 p-4 flex-row items-center gap-4">
          <TouchableOpacity activeOpacity={0.85} onPress={() => setRangosModalOpen(true)}>
            <SvgRangoMedalla
              rango={rango}
              nivel={nivel}
              colorRango={colorRango}
              tamano={isMobile ? 104 : 118}
            />
          </TouchableOpacity>

          <View className="flex-1 gap-1.5">
            <View className="flex-row items-center gap-2 flex-wrap">
              <View className="rounded-full bg-white/15 px-2.5 py-0.5">
                <Text className="text-[#F3D9B7] text-[10px] font-black uppercase tracking-wider">
                  Rango {rango} · {nombreRango}
                </Text>
              </View>
            </View>
            <Text className="text-white text-xl font-black">
              Nivel {nivel} · {puntosCurso.toLocaleString('es-BO')} XP
            </Text>
            <View className="h-2 w-full rounded-full bg-white/20 overflow-hidden">
              <View className="h-full rounded-full bg-[#F3D9B7]" style={{ width: `${progresoNivel}%` }} />
            </View>
            <View className="flex-row items-center justify-between pt-0.5">
              <Text className="text-white/80 text-[11px] flex-1" numberOfLines={1}>
                Faltan {puntosFaltantes} XP para subir
              </Text>
              <TouchableOpacity
                onPress={() => setRangosModalOpen(true)}
                className="flex-row items-center gap-1 rounded-lg bg-white/15 px-2 py-1"
              >
                <Text className="text-[10px] font-bold text-white">Rangos</Text>
                <Ionicons name="chevron-forward" size={11} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Racha y Puntos */}
      <View className="flex-row gap-3">
        <View className="flex-1 rounded-3xl bg-[#F3D9B7] p-4 items-center justify-center min-h-40 border border-amber-200/60">
          <Animated.View
            style={{
              transform: [
                { scale: rachaScale },
                { rotate: rachaRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '12deg'] }) },
              ],
            }}
            className="w-13 h-13 rounded-2xl bg-white/50 items-center justify-center mb-2 p-2.5"
          >
            <Ionicons
              name="flame"
              size={28}
              color={racha?.fecha === hoyLaPaz && racha?.completada ? '#EA580C' : '#9C5367'}
            />
          </Animated.View>
          <Text className="text-[#801F3F] text-3xl font-black">{loading ? '…' : racha?.rachaActual ?? 0}</Text>
          <Text className="text-[#9C5367] text-[10px] font-extrabold tracking-wider">DÍAS DE RACHA</Text>
          <Text className="text-[#9C5367] text-[11px] font-semibold mt-0.5">Récord: {racha?.mejorRacha ?? 1} d</Text>
        </View>

        <View className="flex-1 rounded-3xl bg-white p-4 items-center justify-center min-h-40 border border-gray-200">
          <View className="w-12 h-12 rounded-2xl bg-amber-100 items-center justify-center mb-2">
            <Ionicons name="diamond-outline" size={25} color="#D97706" />
          </View>
          <Text className="text-[#801F3F] text-3xl font-black">
            {loading ? '…' : puntosInd.toLocaleString('es-BO')}
          </Text>
          <Text className="text-gray-500 text-[10px] font-extrabold tracking-wider">PUNTOS ACADÉMICOS</Text>
          <Text className="text-gray-500 text-[10px] mt-0.5">
            Hoy: {resumen?.puntosHoy ?? 0}/{resumen?.limiteDiario ?? 20} pts
          </Text>
          <View className="mt-2 h-1.5 w-full rounded-full bg-amber-100 overflow-hidden">
            <View
              className="h-full rounded-full bg-amber-500"
              style={{
                width: `${Math.min(100, ((resumen?.puntosHoy ?? 0) / (resumen?.limiteDiario ?? 20)) * 100)}%`,
              }}
            />
          </View>
        </View>
      </View>

      {/* Insignias */}
      <View className="rounded-3xl bg-white border border-gray-200 p-4 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-xl bg-amber-100 items-center justify-center">
              <Ionicons name="medal-outline" size={17} color="#B45309" />
            </View>
            <View>
              <Text className="text-[#801F3F] font-extrabold text-sm">Tus insignias</Text>
              <Text className="text-[10px] text-gray-500">Toca una insignia para ver cómo obtenerla</Text>
            </View>
          </View>
          <View className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1">
            <Text className="text-[10px] font-bold text-amber-800">
              {insigniasObtenidas.length} / {INSIGNIAS_CATALOGO.length}
            </Text>
          </View>
        </View>

        {isMobile ? (
          <View className="gap-2.5">
            <View className="flex-row gap-2.5">
              {INSIGNIAS_CATALOGO.slice(0, 2).map((insignia) => (
                <SvgInsignia
                  key={insignia.codigo}
                  nombre={insignia.nombre}
                  icono={insignia.icono}
                  color={insignia.color}
                  criterio={insignia.descripcion}
                  obtenida={insigniaPorCodigo(insignia.codigo)}
                  tamano={64}
                />
              ))}
            </View>
            <View className="flex-row gap-2.5">
              {INSIGNIAS_CATALOGO.slice(2, 4).map((insignia) => (
                <SvgInsignia
                  key={insignia.codigo}
                  nombre={insignia.nombre}
                  icono={insignia.icono}
                  color={insignia.color}
                  criterio={insignia.descripcion}
                  obtenida={insigniaPorCodigo(insignia.codigo)}
                  tamano={64}
                />
              ))}
            </View>
          </View>
        ) : (
          <View className="flex-row gap-3">
            {INSIGNIAS_CATALOGO.map((insignia) => (
              <SvgInsignia
                key={insignia.codigo}
                nombre={insignia.nombre}
                icono={insignia.icono}
                color={insignia.color}
                criterio={insignia.descripcion}
                obtenida={insigniaPorCodigo(insignia.codigo)}
                tamano={68}
              />
            ))}
          </View>
        )}
      </View>

      {/* Desafíos diarios */}
      <View className="rounded-3xl bg-white border border-gray-200 p-4 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-8 w-8 rounded-xl bg-emerald-100 items-center justify-center">
              <Ionicons name="checkmark-done-outline" size={17} color="#047857" />
            </View>
            <Text className="text-[#801F3F] font-extrabold text-sm">Desafíos diarios</Text>
          </View>
          <Text className="text-[10px] text-gray-500 font-semibold">Gana hasta 20 pts hoy</Text>
        </View>

        <View className="flex-row gap-2">
          {desafiosDiarios.map((reto) => (
            <View
              key={reto.codigo}
              className={`flex-1 p-3 rounded-2xl border items-center gap-1.5 ${
                reto.completado ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50/70 border-gray-200'
              }`}
            >
              <Ionicons
                name={reto.completado ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={reto.completado ? '#16A34A' : '#9CA3AF'}
              />
              <Text className="text-[10px] font-bold text-center leading-tight text-gray-700">
                {NOMBRE_DESAFIO[reto.codigo] ?? reto.nombre}
              </Text>
              {reto.completado ? (
                <View className="flex-row items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5">
                  <Ionicons name="checkmark" size={10} color="#047857" />
                  <Text className="text-[9px] font-bold text-emerald-700">Listo</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {resumen?.bonoDesafiosOtorgado ? (
          <View className="flex-row items-center justify-center gap-1.5 rounded-xl bg-emerald-50 py-2 px-3">
            <Ionicons name="star" size={14} color="#047857" />
            <Text className="text-[11px] font-bold text-emerald-800">
              ¡Bono semanal de hasta 20 puntos obtenido!
            </Text>
          </View>
        ) : null}
      </View>

      {/* Cómo vas en tu aprendizaje */}
      <BentoCard className="rounded-3xl p-5 border border-purple-200/80 bg-white gap-4">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-2.5 flex-1">
            <View className="w-10 h-10 rounded-2xl bg-purple-100 items-center justify-center">
              <Ionicons name="sparkles" size={20} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-gray-900">Cómo vas en tu aprendizaje</Text>
              <Text className="text-[11px] text-gray-500">Resumen diario y análisis personalizado</Text>
            </View>
          </View>
          <StatusBadge label="Resumen IA" variant="brand" />
        </View>

        <View className="rounded-2xl bg-purple-50/60 p-4 border border-purple-100">
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Ionicons name="today-outline" size={14} color="#6D28D9" />
            <Text className="text-[10px] font-black uppercase tracking-wider text-purple-900">
              Actividad de hoy
            </Text>
          </View>
          <Text className="text-sm text-gray-800 leading-relaxed">{resumenNarrativo()}</Text>
          <Text className="text-[11px] text-gray-500 mt-2.5">
            {totalTemasHoy > 0
              ? `${evaluacionesHoy.length ? `Promedio de evaluación: ${Math.round(promedioAciertoHoy * 100)}% · ` : ''}${totalTemasHoy} actividad${totalTemasHoy > 1 ? 'es' : ''} registrada${totalTemasHoy > 1 ? 's' : ''}.`
              : 'Completa tu primera actividad para generar tu resumen.'}
          </Text>
        </View>

        {perfil ? (
          <View className="rounded-2xl bg-slate-50 p-4 border border-slate-200 gap-2.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-black uppercase tracking-wider text-violet-900">
                Vista previa de tu informe
              </Text>
              <View className="rounded-full bg-violet-100 px-2 py-0.5">
                <Text className="text-[10px] font-bold text-violet-800">{perfil.completed_topics ?? 0} temas</Text>
              </View>
            </View>
            <View className="gap-1.5">
              <Text className="text-xs text-gray-800 leading-5">
                <Text className="font-bold text-gray-900">Tu ritmo: </Text>
                {perfil.learning_rhythm}
              </Text>
              <Text className="text-xs text-gray-800 leading-5">
                <Text className="font-bold text-gray-900">Aprendes mejor con: </Text>
                {perfil.preferred_formats.map((f) => ETIQUETAS_FORMATO[f] || f.replaceAll('_', ' ')).join(', ') ||
                  perfil.learning_orientation.replaceAll('_', ' ')}
              </Text>
              <Text className="text-xs text-gray-800 leading-5">
                <Text className="font-bold text-gray-900">Siguiente recomendación: </Text>
                {perfil.personalization_recommendation}
              </Text>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center gap-2 rounded-2xl bg-gray-50 px-3.5 py-3 border border-gray-200">
            <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
            <Text className="flex-1 text-[11px] text-gray-600">
              {perfilAutoLoading
                ? 'Preparando tu análisis de ritmo, estilo y recomendaciones…'
                : 'Completa un resumen y una actividad para desbloquear tu informe detallado.'}
            </Text>
          </View>
        )}

        <View className="flex-row gap-2.5">
          <TouchableOpacity
            onPress={handleOpenPerfil}
            className="flex-1 rounded-2xl bg-[#801F3F] px-4 py-3 flex-row items-center justify-center gap-2 shadow-sm"
          >
            <Ionicons name="analytics-outline" size={16} color="#FFFFFF" />
            <Text className="text-xs font-extrabold text-white">Ver informe completo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleOpenTienda}
            className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex-row items-center justify-center gap-1.5"
          >
            <Ionicons name="bag-handle-outline" size={16} color="#B45309" />
            <Text className="text-xs font-extrabold text-amber-900">Tienda</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* Modal Tienda */}
      <Modal visible={tiendaModalOpen} animationType="fade" transparent onRequestClose={() => setTiendaModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[85%]">
            <View className="bg-amber-600 p-5 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white text-base font-black">Tienda de Recompensas</Text>
                <Text className="text-white/85 text-xs">Tus puntos disponibles: {puntosInd} pts</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTiendaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4" contentContainerClassName="gap-3">
              {recompensas.length === 0 ? (
                <Text className="py-8 text-center text-xs text-gray-500">
                  La tienda no tiene artículos disponibles ahora.
                </Text>
              ) : null}
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
                    onPress={() => void handleComprarRecompensa(rec)}
                    disabled={comprando || puntosInd < rec.costoPuntosIndividuales}
                    className={`px-3.5 py-2 rounded-xl ${
                      puntosInd >= rec.costoPuntosIndividuales ? 'bg-amber-600' : 'bg-gray-200'
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

      {/* Modal Rangos */}
      <Modal visible={rangosModalOpen} transparent animationType="fade" onRequestClose={() => setRangosModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="w-full max-w-md rounded-3xl bg-white p-5 gap-2.5 shadow-2xl">
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield-checkmark-outline" size={20} color="#801F3F" />
                <Text className="text-lg font-black text-gray-900">Rangos y experiencia</Text>
              </View>
              <TouchableOpacity onPress={() => setRangosModalOpen(false)}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {RANGOS_LISTA.map((item) => {
              const actual = rango === item.id;
              return (
                <View
                  key={item.id}
                  className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                    actual ? 'border-[#801F3F] bg-rose-50/70' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <View
                    style={{ backgroundColor: item.color }}
                    className="h-10 w-10 rounded-xl items-center justify-center"
                  >
                    <Text className="text-base font-black text-white">{item.id}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-extrabold text-sm text-gray-900">
                      {item.nombre}
                      {actual ? ' (Tu rango actual)' : ''}
                    </Text>
                    <Text className="text-xs text-gray-600">
                      {item.desde === 0 ? 'Rango inicial' : `Alcanza ${item.desde.toLocaleString('es-BO')} XP para subir`}
                    </Text>
                  </View>
                  {actual ? <Ionicons name="checkmark-circle" size={20} color="#801F3F" /> : null}
                </View>
              );
            })}
            <TouchableOpacity onPress={() => setRangosModalOpen(false)} className="mt-2 rounded-xl bg-[#801F3F] p-3">
              <Text className="text-center font-bold text-white">Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <InformeAprendizajeModal
        visible={perfilOpen}
        loading={perfilLoading}
        error={perfilError}
        perfil={perfil}
        onClose={() => setPerfilOpen(false)}
        onRetry={handleOpenPerfil}
      />
    </ScrollView>
  );
}
