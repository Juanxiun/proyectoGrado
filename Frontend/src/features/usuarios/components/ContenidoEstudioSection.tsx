import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, PanResponder, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { academicServicesApi, type TemaMalla } from '../../../api/academicServices.api';
import { ApiClientError } from '../../../api/client';
import { aprendizajeApi, type ActividadAprendizaje, type ContenidoAprendizaje, type ExplicacionSeccion, type FormatoResumen, type ResumenAprendizaje, type ResultadoReto, type RetoAprendizaje } from '../../../api/aprendizaje.api';
import { gamificacionApi, type PreguntaActividad, type RespuestaActividad } from '../../../api/gamificacion.api';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { DocumentWebView } from './DocumentWebView';
import { PdfPaginasViewer } from './PdfPaginasViewer';
import { ResumenInteractivo } from './ResumenInteractivo';
import { EjemploCanvas } from './EjemploCanvas';
import { BarraProgresoTema } from '../../../shared/ui/BarraProgresoTema';
import { API_BASE_URL } from '../../../constants/config';

interface MaterialItem {
  id: string;
  titulo: string;
  detalle?: string;
  archivoUrl: string;
  nombreArchivo?: string;
  tamanioBytes?: number;
  tipoMime?: string;
  fechaSubida?: string;
  temaId?: string | null;
  estadoProcesamiento?: string;
  tipoMaterial?: 'estudio' | 'actividad' | null;
}

interface ContenidoEstudioSectionProps {
  asignacionId: string;
  nivel?: 'primaria' | 'secundaria';
  grado?: string;
  materiaId?: string;
  materiaNombre: string;
}

const FORMATOS: Array<{ id: FormatoResumen; label: string; detail: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'CARTAS_EXPLICATIVAS', label: 'Cartas', detail: 'Ideas clave en tarjetas', icon: 'albums-outline' },
  { id: 'ESQUEMA_GEMMA', label: 'Esquema', detail: 'Diagrama interactivo', icon: 'share-social-outline' },
];

const MENSAJES_CARGA_RETO = [
  'Empezando con la actividad',
  'Validando preguntas',
  'Viendo tu conocimiento actual',
  'Preparando retos a tu medida',
];

interface ZonaActividad {
  x: number;
  y: number;
  width: number;
  height: number;
}

function PiezaArrastrable({ texto, destino, alSoltar, alTocar }: { texto: string; destino: React.MutableRefObject<ZonaActividad>; alSoltar: () => void; alTocar?: () => void }) {
  const posicion = useRef(new Animated.ValueXY()).current;
  const arrastrando = useRef(false);
  const gesto = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, estado) => Math.abs(estado.dx) + Math.abs(estado.dy) > 4,
      onPanResponderGrant: () => {
        arrastrando.current = false;
      },
      onPanResponderMove: (_, estado) => {
        if (Math.abs(estado.dx) + Math.abs(estado.dy) > 6) {
          arrastrando.current = true;
        }
        posicion.setValue({ x: estado.dx, y: estado.dy });
      },
      onPanResponderRelease: (_, estado) => {
        const dist = Math.abs(estado.dx) + Math.abs(estado.dy);
        if (!arrastrando.current || dist < 10) {
          alTocar?.();
          Animated.spring(posicion, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          return;
        }
        const area = destino.current;
        const margen = 65;
        const dentro =
          area.width > 0 && area.height > 0
            ? estado.moveX >= area.x - margen &&
              estado.moveX <= area.x + area.width + margen &&
              estado.moveY >= area.y - margen &&
              estado.moveY <= area.y + area.height + margen
            : estado.dy > 30;
        if (dentro) {
          alSoltar();
        }
        Animated.spring(posicion, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
      onPanResponderTerminate: () => Animated.spring(posicion, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start(),
    })
  ).current;

  return (
    <Animated.View {...gesto.panHandlers} style={{ transform: posicion.getTranslateTransform(), zIndex: 10 }}>
      <TouchableOpacity activeOpacity={0.8} onPress={alTocar} className="flex-row items-center gap-2 rounded-2xl border-2 border-indigo-200 bg-white px-3.5 py-3 shadow-sm">
        <Ionicons name="reorder-two-outline" size={18} color="#6366F1" />
        <Text className="text-sm font-bold text-gray-800">{texto}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function LectorArchivo({ material }: { material: MaterialItem }) {
  const nombreArchivo = material.nombreArchivo || material.archivoUrl.split('?')[0].split('/').pop() || '';
  const extension = nombreArchivo.split('.').pop()?.toLowerCase();
  const esImagen = material.tipoMime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '');
  const esPdf = material.tipoMime?.toLowerCase() === 'application/pdf' || extension === 'pdf';
  const url = normalizarUrlMovil(material.archivoUrl);
  // material -> PDF se lee por paginas dentro de la app, sin descargar el archivo
  if (esPdf && !esImagen) return <PdfPaginasViewer materialId={material.id} titulo={material.titulo}/>;
  return <DocumentWebView uri={url} title={material.titulo} mimeType={material.tipoMime} isPdf={esPdf} preferNativePdf={Platform.OS !== 'web'} fileName={nombreArchivo}/>;
}

function normalizarUrlMovil(rawUrl: string): string {
  if (Platform.OS !== 'android') return rawUrl;
  try {
    const media = new URL(rawUrl);
    if (!['localhost', '127.0.0.1', 'host.docker.internal'].includes(media.hostname)) return rawUrl;
    const apiHost = new URL(API_BASE_URL).hostname;
    media.hostname = apiHost === 'localhost' || apiHost === '127.0.0.1' ? '10.0.2.2' : apiHost;
    return media.toString();
  } catch {
    return rawUrl;
  }
}

type ParteRuta = NonNullable<ContenidoAprendizaje['learning_sections']>[number];
type CartaRuta = { titulo: string; explicacion: string; ejemplo: string; svg?: string; indagacion?: string; esEsquema?: boolean };

// ruta -> cinco cartas de microlearning y una carta final con el mapa de conexiones
function crearCartasRuta(parte: ParteRuta): CartaRuta[] {
  const unidades = parte.microlearning || [];
  const cartas: CartaRuta[] = unidades.slice(0, 5).map((unidad, indice) => ({
    titulo: unidad.title || parte.conceptos[indice] || `Idea clave ${indice + 1}`,
    explicacion: unidad.explanation || parte.resumen,
    ejemplo: unidad.examples_blackboard?.find((ejemplo) => ejemplo && ejemplo.trim()) || parte.resumen,
    indagacion: unidad.inquiry_question,
  }));
  while (cartas.length < 5) {
    const idx = cartas.length;
    const concepto = parte.conceptos[idx] || `Concepto clave ${idx + 1}`;
    cartas.push({
      titulo: concepto,
      explicacion: `Idea esencial sobre ${concepto} abordada en ${parte.titulo}.`,
      ejemplo: `Enunciado: aplica ${concepto} con un caso sencillo.\nPaso 1: Identifica los datos.\nPaso 2: Usa la regla del tema.\nResultado: el valor pedido.`,
      indagacion: parte.preguntas_indagacion?.[idx],
    });
  }
  const esquema = parte.carta_6_esquema;
  const detalleNodos = (esquema?.nodes || []).slice(0, 4).map((nodo) => nodo.detail || nodo.label).filter(Boolean).join(' ');
  cartas.push({
    titulo: esquema?.titulo || `Conexiones de ${parte.titulo}`,
    explicacion: detalleNodos || `Este esquema muestra cómo se relacionan las ideas de ${parte.titulo}.`,
    ejemplo: (esquema?.nodes || []).map((nodo) => nodo.mini_example).find((item) => item && item.trim()) || '',
    svg: esquema?.svg_inline || parte.svg_inline,
    esEsquema: true,
  });
  return cartas;
}

// feedback -> esperar la retroalimentacion de Mistral sin bloquear la pantalla
async function esperarRetroalimentacion(materialId: string, quizId: string, alRecibir: (feedback: NonNullable<ResultadoReto['learning_feedback']>) => void, intentos = 45, esperaMs = 3000) {
  for (let intento = 0; intento < intentos; intento += 1) {
    await new Promise((resolve) => setTimeout(resolve, esperaMs));
    try {
      const feedback = await aprendizajeApi.retroalimentacionReto(materialId, quizId);
      if (feedback && !feedback.pending) {
        alRecibir(feedback);
        return;
      }
    } catch {
      // todavia no esta lista, se reintenta
    }
  }
}

export function ContenidoEstudioSection({ asignacionId, nivel, grado, materiaId, materiaNombre }: ContenidoEstudioSectionProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [materiales, setMateriales] = useState<MaterialItem[]>([]);
  const [tema, setTema] = useState<MaterialItem | null>(null);
  const [contenido, setContenido] = useState<ContenidoAprendizaje | null>(null);
  const [parteRutaSeleccionada, setParteRutaSeleccionada] = useState(0);
  const [rutaIniciada, setRutaIniciada] = useState(false);
  const [cartaRutaSeleccionada, setCartaRutaSeleccionada] = useState(0);
  const [contenidoLoading, setContenidoLoading] = useState(false);
  const [contenidoError, setContenidoError] = useState(false);
  const [contenidoErrorDetalle, setContenidoErrorDetalle] = useState('');
  const [resumen, setResumen] = useState<ResumenAprendizaje | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [pantallaResumen, setPantallaResumen] = useState(false);
  const [reto, setReto] = useState<RetoAprendizaje | null>(null);
  const [seccionRetoActual, setSeccionRetoActual] = useState<string | undefined>();
  const [retoLoading, setRetoLoading] = useState(false);
  const [mensajeCargaReto, setMensajeCargaReto] = useState(0);
  const mensajeOpacity = useRef(new Animated.Value(1)).current;
  const mensajeOffset = useRef(new Animated.Value(0)).current;
  const cargaMovimiento = useRef(new Animated.Value(0)).current;
  const cargaPulso = useRef(new Animated.Value(0)).current;
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<string | null>(null);
  const [parejaSeleccionada, setParejaSeleccionada] = useState<string | null>(null);
  const [parejas, setParejas] = useState<Record<string, string>>({});
  const [resultadoParejas, setResultadoParejas] = useState<Record<string, { correct: boolean; expected?: string; explanation?: string }>>({});
  const [textoLibre, setTextoLibre] = useState('');
  const [posicion, setPosicion] = useState(0);
  const [resultadoReto, setResultadoReto] = useState<{ puntos: number; correctas: number; total: number; answers: ResultadoReto['answers']; feedback?: ResultadoReto['learning_feedback'] } | null>(null);
  const [retoSubmitting, setRetoSubmitting] = useState(false);
  const [explicacion, setExplicacion] = useState<ExplicacionSeccion | null>(null);
  const [seccionExplicada, setSeccionExplicada] = useState<string | null>(null);
  const [explicacionLoading, setExplicacionLoading] = useState<string | null>(null);
  const [modalExplicacionVisible, setModalExplicacionVisible] = useState(false);
  const [puntosEnReto, setPuntosEnReto] = useState(0);
  const inicioRetoRef = useRef(0);
  const feedbackVivoRef = useRef(true);
  const zonaActividadRef = useRef<ZonaActividad>({ x: 0, y: 0, width: 0, height: 0 });
  const zonaVisualRef = useRef<any>(null);
  const [temaRutaAbierto, setTemaRutaAbierto] = useState<number | null>(null);

  // Indagación LLM: respuesta del profesor virtual a preguntas de investigación
  const [indagacionRespuesta, setIndagacionRespuesta] = useState<string | null>(null);
  const [indagacionCargando, setIndagacionCargando] = useState(false);
  const [preguntaIndagacionActiva, setPreguntaIndagacionActiva] = useState<string | null>(null);

  const consultarIndagacionLLM = async (pregunta: string, temaId: string) => {
    setIndagacionCargando(true);
    setPreguntaIndagacionActiva(pregunta);
    setIndagacionRespuesta(null);
    try {
      const explicacion = await aprendizajeApi.explicarSeccion(temaId, {
        title: 'Pregunta de investigación',
        explanation: pregunta,
        example: '',
        format: 'preguntas',
      });
      setIndagacionRespuesta(explicacion.explanation || explicacion.title);
    } catch {
      setIndagacionRespuesta('No pude obtener respuesta ahora. Intenta de nuevo en un momento.');
    } finally {
      setIndagacionCargando(false);
    }
  };

  // Progreso por tema: clave = numero del tema, valor = { porcentaje, completado, puntos }
  const [progresoTemas, setProgresoTemas] = useState<Record<string, { porcentaje: number; completado: boolean; puntos: number }>>({});

  const progresoDeTema = (numero: number) => progresoTemas[String(numero)] ?? { porcentaje: 0, completado: false, puntos: 0 };

  const marcarTemaCompletado = (numeroTema: number, puntos: number = 10) => {
    setProgresoTemas((prev) => ({
      ...prev,
      [String(numeroTema)]: { porcentaje: 100, completado: true, puntos },
    }));
    if (user?.estudianteId || user?.id) {
      void gamificacionApi.registrarProgresoEstudio({
        contentId: tema?.id || '',
        titulo: `Tema ${numeroTema}`,
        materiaNombre,
        completo: true,
        investigacion: false,
      }).catch(() => {
        // gamificacion -> no bloquear la UI si falla el registro de puntos
      });
    }
  };

  const avanzarProgresoTema = (numeroTema: number, incremento: number = 20) => {
    const actual = progresoDeTema(numeroTema);
    if (actual.completado) return;
    const nuevo = Math.min(100, actual.porcentaje + incremento);
    setProgresoTemas((prev) => ({
      ...prev,
      [String(numeroTema)]: { ...prev[String(numeroTema)], porcentaje: nuevo },
    }));
  };

  useEffect(() => {
    setParteRutaSeleccionada(0);
    setCartaRutaSeleccionada(0);
    setTemaRutaAbierto(null);
    setRutaIniciada(false);
  }, [tema?.id]);

  useEffect(() => () => {
    feedbackVivoRef.current = false;
  }, []);

  useEffect(() => {
    if (!retoLoading) {
      setMensajeCargaReto(0);
      mensajeOpacity.setValue(1);
      mensajeOffset.setValue(0);
      return;
    }

    let activo = true;
    let temporizador: ReturnType<typeof setTimeout>;
    const movimiento = Animated.loop(Animated.timing(cargaMovimiento, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }));
    const pulso = Animated.loop(Animated.sequence([
      Animated.timing(cargaPulso, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(cargaPulso, { toValue: 0, duration: 650, useNativeDriver: true }),
    ]));
    movimiento.start();
    pulso.start();

    const cambiarMensaje = () => {
      Animated.parallel([
        Animated.timing(mensajeOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(mensajeOffset, { toValue: -8, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!activo || !finished) return;
        setMensajeCargaReto((actual) => (actual + 1) % MENSAJES_CARGA_RETO.length);
        mensajeOffset.setValue(8);
        Animated.parallel([
          Animated.timing(mensajeOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(mensajeOffset, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
        temporizador = setTimeout(cambiarMensaje, 1900);
      });
    };
    temporizador = setTimeout(cambiarMensaje, 1900);

    return () => {
      activo = false;
      clearTimeout(temporizador);
      movimiento.stop();
      pulso.stop();
      mensajeOpacity.stopAnimation();
      mensajeOffset.stopAnimation();
      cargaMovimiento.setValue(0);
      cargaPulso.setValue(0);
    };
  }, [retoLoading, cargaMovimiento, cargaPulso, mensajeOpacity, mensajeOffset]);

  const fetchMateriales = async () => {
    try {
      setLoading(true);
      const res = await academicServicesApi.list('materiales', { asignacionId, activo: 'true', limit: 100 });
      setMateriales(res.data as unknown as MaterialItem[]);
    } catch (err) {
      console.error('Error al cargar contenido de estudio:', err);
    } finally {
      setLoading(false);
    }
  };

  const [malla, setMalla] = useState<TemaMalla[]>([]);
  const [mallaLoading, setMallaLoading] = useState(false);

  const fetchMalla = async () => {
    if (!materiaId || !nivel || !grado) {
      setMalla([]);
      return;
    }
    try {
      setMallaLoading(true);
      const res = await academicServicesApi.getMallaMateria(nivel, grado, materiaId);
      setMalla(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Error al cargar malla curricular:', err);
      setMalla([]);
    } finally {
      setMallaLoading(false);
    }
  };

  useEffect(() => {
    void fetchMateriales();
    void fetchMalla();
    const unsub = connectUsersWebSocket(() => { void fetchMateriales(); });
    return () => { if (unsub) unsub(); };
  }, [asignacionId, nivel, grado, materiaId]);

  const abrirTema = async (material: MaterialItem) => {
    setTema(material);
    setContenido(null);
    setRutaIniciada(false);
    setTemaRutaAbierto(null);
    setContenidoError(false);
    setContenidoErrorDetalle('');
    setResumen(null);
    setExplicacion(null);
    setSeccionExplicada(null);
    setPantallaResumen(false);
    setReto(null);
    setResultadoReto(null);
    setPosicion(0);
    if (material.tipoMaterial === 'actividad') {
      setContenidoLoading(false);
      return;
    }
    setContenidoLoading(true);
    try {
      setContenido(await aprendizajeApi.contenido(material.id));
    } catch (error) {
      setContenido(null);
      const detalle = error instanceof ApiClientError ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.';
      const esperandoRag = error instanceof ApiClientError && error.status === 404 && /material.*proces/i.test(detalle);
      setContenidoError(!esperandoRag);
      setContenidoErrorDetalle(detalle);
    } finally {
      setContenidoLoading(false);
    }
  };

  const generarResumen = async (formato: FormatoResumen) => {
    if (!tema) return;
    setResumenLoading(true);
    setResumen(null);
    try {
      setResumen(await aprendizajeApi.resumen(tema.id, formato));
      setPantallaResumen(true);
    } catch (error) {
      const detalle = error instanceof ApiClientError ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.';
      Alert.alert('No se pudo generar el resumen', detalle);
    } finally {
      setResumenLoading(false);
    }
  };

  const actualizarContenido = async () => {
    if (!tema || contenidoLoading) return;
    setContenidoLoading(true);
    setContenidoError(false);
    setContenidoErrorDetalle('');
    try {
      setContenido(await aprendizajeApi.contenido(tema.id));
    } catch (error) {
      setContenido(null);
      const detalle = error instanceof ApiClientError ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.';
      const esperandoRag = error instanceof ApiClientError && error.status === 404 && /material.*proces/i.test(detalle);
      setContenidoError(!esperandoRag);
      setContenidoErrorDetalle(detalle);
    } finally {
      setContenidoLoading(false);
    }
  };

  const explicarMejor = async (section: { title: string; explanation: string; example?: string }, format: ExplicacionSeccion['format']) => {
    if (!tema) return;
    const key = `${section.title}-${format}`;
    setModalExplicacionVisible(true);
    setExplicacionLoading(key);
    try {
      setExplicacion(await aprendizajeApi.explicarSeccion(tema.id, { ...section, format }));
      setSeccionExplicada(section.title);
      if (format === 'preguntas') {
        await gamificacionApi.registrarProgresoEstudio({ contentId: tema.id, titulo: section.title, materiaNombre, investigacion: true });
      }
    } catch {
      Alert.alert('No se pudo generar la explicación', 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setExplicacionLoading(null);
    }
  };

  const iniciarReto = async (sectionId?: string) => {
    if (!tema) return;
    setSeccionRetoActual(sectionId);
    setRetoLoading(true);
    setRespuestas({});
    setParejas({});
    setResultadoParejas({});
    setPuntosEnReto(0);
    setPosicion(0);
    setResultadoReto(null);
    try {
      setReto(await aprendizajeApi.reto(tema.id, 5, sectionId));
      inicioRetoRef.current = Date.now();
    } catch (error) {
      const detalle = error instanceof ApiClientError ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.';
      Alert.alert('No se pudo preparar el reto', detalle);
    } finally {
      setRetoLoading(false);
    }
  };

  const actividadActual = reto?.activities[posicion];
  const totalActividades = reto?.activities.length ?? 0;
  const partesRuta: ParteRuta[] = contenido?.learning_sections?.length ? contenido.learning_sections : contenido ? [{
    numero: 1,
    titulo: contenido.title,
    texto_plano: contenido.summary,
    resumen: contenido.summary,
    conceptos: contenido.key_concepts || [],
    microlearning: contenido.microlearning_units || [],
    checkpoint: contenido.summary,
    svg_inline: '',
  }] : [];
  const parteRutaActual = partesRuta[parteRutaSeleccionada];
  const cartasRutaActual = parteRutaActual ? crearCartasRuta(parteRutaActual) : [];
  const cartaRutaActual = cartasRutaActual[cartaRutaSeleccionada];
  const responderSeleccion = (activity: ActividadAprendizaje, answer: string) => {
    setRespuestas((previous) => ({ ...previous, [activity.activity_id]: answer }));
    setOpcionSeleccionada(answer);
  };

  const seleccionarConcepto = (left: string) => {
    setParejaSeleccionada(left);
  };

  const asignarConcepto = async (right: string) => {
    if (!parejaSeleccionada || !tema || !reto || !actividadActual || actividadActual.tipo !== 'CONECTAR_FRASES') return;
    try {
      const resultado = await aprendizajeApi.validarEmparejamiento(tema.id, reto.quiz_id, actividadActual.activity_id, parejaSeleccionada, right);
      setParejas((previous) => ({ ...previous, [parejaSeleccionada]: right }));
      setResultadoParejas((previous) => ({ ...previous, [parejaSeleccionada]: { correct: resultado.correct, expected: resultado.expected, explanation: resultado.feedback?.explanation } }));
    } catch (error) {
      const detalle = error instanceof ApiClientError ? error.message : 'No se pudo validar esta relacion. Intenta de nuevo.';
      Alert.alert('No se pudo validar la conexion', detalle);
      return;
    }
    setParejaSeleccionada(null);
  };

  const respuestaActual = actividadActual ? (respuestas[actividadActual.activity_id] ?? '') : '';
  const puedeContinuar = !actividadActual ? false : actividadActual.tipo === 'CONECTAR_FRASES'
    ? Object.keys(parejas).length === (actividadActual.left_items?.length ?? 0)
    : actividadActual.tipo === 'DRAG_AND_DROP'
    ? respuestaActual.split(';').filter(Boolean).length === (actividadActual.items?.length ?? 0)
    : Boolean(respuestaActual || textoLibre.trim());

  const avanzarReto = async () => {
    if (!actividadActual || !reto) return;
    const respuestaActualPregunta = actividadActual.tipo === 'COMPLETAR' ? (respuestaActual || textoLibre.trim()) : '';
    if (actividadActual.tipo === 'CONECTAR_FRASES') {
      const answer = Object.entries(parejas).map(([left, right]) => `${left} => ${right}`).join(';');
      setRespuestas((previous) => ({ ...previous, [actividadActual.activity_id]: answer }));
    }
    if (posicion + 1 < totalActividades) {
      const respuestaParaComprobar = actividadActual.tipo === 'CONECTAR_FRASES'
        ? Object.entries(parejas).map(([left, right]) => `${left} => ${right}`).join(';')
        : actividadActual.tipo === 'COMPLETAR' ? respuestaActualPregunta : respuestaActual;
      setRespuestas((previous) => ({ ...previous, [actividadActual.activity_id]: respuestaParaComprobar }));
      try {
        const comprobacion = await aprendizajeApi.comprobarActividad(tema!.id, reto.quiz_id, actividadActual.activity_id, respuestaParaComprobar);
        if (comprobacion.correct) setPuntosEnReto((actual) => actual + 1);
      } catch {
        Alert.alert('No se pudo comprobar la respuesta', 'Puedes continuar; se revisará al terminar el reto.');
      }
      setPosicion((previous) => previous + 1);
      setOpcionSeleccionada(null);
      setTextoLibre('');
      setParejas({});
      setResultadoParejas({});
      setParejaSeleccionada(null);
      return;
    }

    const respuestasFinales = { ...respuestas };
    if (actividadActual.tipo === 'CONECTAR_FRASES') {
      respuestasFinales[actividadActual.activity_id] = Object.entries(parejas).map(([left, right]) => `${left} => ${right}`).join(';');
    }
    if (actividadActual.tipo === 'COMPLETAR') respuestasFinales[actividadActual.activity_id] = respuestaActualPregunta || respuestasFinales[actividadActual.activity_id];
    const answers = reto.activities.map((activity) => ({ activity_id: activity.activity_id, response: respuestasFinales[activity.activity_id] || '' }));
    if (answers.some((answer) => !answer.response.trim())) {
      Alert.alert('Falta una respuesta', 'Completa todas las actividades antes de enviar el reto.');
      return;
    }
    setRetoSubmitting(true);
    try {
      const resultado = await aprendizajeApi.completarReto(tema!.id, reto.quiz_id, answers, Date.now() - inicioRetoRef.current);
      const puntos = resultado.correct;
      setPuntosEnReto(puntos);
      try {
        const preguntas: PreguntaActividad[] = reto.activities.map((activity, index) => ({
          id: activity.activity_id,
          texto: activity.question || activity.front || activity.statement || `Actividad ${index + 1}`,
          tipo: activity.tipo === 'CONECTAR_FRASES' ? 'conectar' : activity.tipo === 'DRAG_AND_DROP' ? 'drag_drop' : 'seleccion_multiple',
          opciones: activity.options,
          respuestaCorrecta: '',
          explicacion: activity.learning_objective,
          puntosBase: 5,
          orden: index + 1,
        }));
        const respuestasGamificacion: RespuestaActividad[] = resultado.answers.map((answer, index) => ({
          preguntaId: answer.activity_id,
          respuesta: answers[index]?.response ?? '',
          correcta: answer.correct,
          tiempoMs: Math.round((Date.now() - inicioRetoRef.current) / Math.max(1, totalActividades)),
          feedback: resultado.learning_feedback?.feedback,
        }));
        const reward = await gamificacionApi.completarActividad({
          estudianteId: user?.estudianteId || user?.id || '',
          cursoPeriodoId: user?.cursoPeriodoId || '1',
          paralelo: user?.paralelo === 'B' ? 'B' : 'A',
          materiaId: materiaId || asignacionId,
          materiaNombre,
          tipo: 'cuestionario',
          titulo: `Reto: ${contenido?.title || tema?.titulo || materiaNombre}`,
          preguntas,
          respuestas: respuestasGamificacion,
          tiempoTotalMs: Date.now() - inicioRetoRef.current,
          fechaInicio: new Date(inicioRetoRef.current).toISOString(),
          fechaFin: new Date().toISOString(),
        });
        void reward;
      } catch (error) {
        console.error('No se pudo registrar puntos de gamificacion:', error);
      }
      setResultadoReto({ puntos, correctas: resultado.correct, total: resultado.total, answers: resultado.answers, feedback: resultado.learning_feedback });
      if (parteRutaActual) {
        marcarTemaCompletado(parteRutaActual.numero, puntos * 5);
      }
      // feedback -> Mistral llega en segundo plano, no bloquea la pantalla de resultados
      if (resultado.learning_feedback?.pending) {
        void esperarRetroalimentacion(tema!.id, reto.quiz_id, (retroalimentacion) => {
          if (!feedbackVivoRef.current) return;
          setResultadoReto((previo) => (previo ? { ...previo, feedback: retroalimentacion } : previo));
        });
      }
      return;
    } catch (error) {
      console.error('No se pudo registrar el resultado del reto:', error);
      const detalle = error instanceof ApiClientError ? error.message : 'Intenta enviar tus respuestas otra vez.';
      Alert.alert('No se pudo guardar el resultado', detalle);
    } finally {
      setRetoSubmitting(false);
    }
  };

  const renderReto = (activity: ActividadAprendizaje) => {
    const choose = (answer: string) => responderSeleccion(activity, answer);
    if (activity.tipo === 'SELECCION_MULTIPLE') return <View className="gap-2">{activity.options?.map((option) => <TouchableOpacity key={option} onPress={() => choose(option)} className={`p-4 rounded-2xl border ${respuestaActual === option ? 'border-maroon bg-maroon/10' : 'border-gray-200 bg-white'}`}><Text className="text-sm font-semibold text-gray-800">{option}</Text></TouchableOpacity>)}</View>;

    if (activity.tipo === 'DRAG_AND_DROP') {
      const itemsColocados = respuestaActual ? respuestaActual.split(';').filter(Boolean) : [];
      const itemsDisponibles: string[] = [];
      const colocadosCopia = [...itemsColocados];
      for (const item of (activity.items || [])) {
        const idx = colocadosCopia.indexOf(item);
        if (idx >= 0) {
          colocadosCopia.splice(idx, 1);
        } else {
          itemsDisponibles.push(item);
        }
      }

      const moverPaso = (idx: number, direccion: -1 | 1) => {
        const nuevoDestino = idx + direccion;
        if (nuevoDestino < 0 || nuevoDestino >= itemsColocados.length) return;
        const copia = [...itemsColocados];
        const [removido] = copia.splice(idx, 1);
        copia.splice(nuevoDestino, 0, removido);
        choose(copia.join(';'));
      };

      const quitarPaso = (idx: number) => {
        const copia = itemsColocados.filter((_, i) => i !== idx);
        choose(copia.join(';'));
      };

      const agregarPaso = (item: string) => {
        choose([...itemsColocados, item].join(';'));
      };

      return (
        <View className="gap-4">
          <Text className="text-xs text-gray-600 font-medium">
            Toca o arrastra cada paso en el orden correcto para resolver el procedimiento.
          </Text>

          {itemsDisponibles.length > 0 ? (
            <View className="gap-2">
              <Text className="text-xs font-bold text-indigo-900">
                Pasos disponibles (toca o arrastra para colocar):
              </Text>
              <View className="flex-row flex-wrap gap-2.5">
                {itemsDisponibles.map((item, index) => (
                  <PiezaArrastrable
                    key={`${item}-${index}`}
                    texto={item}
                    destino={zonaActividadRef}
                    alSoltar={() => agregarPaso(item)}
                    alTocar={() => agregarPaso(item)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View className="flex-row items-center gap-2 rounded-2xl bg-emerald-50 p-3 border border-emerald-200">
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text className="text-xs font-bold text-emerald-800">
                ¡Colocaste todos los pasos! Revisa el orden abajo.
              </Text>
            </View>
          )}

          <View
            ref={zonaVisualRef}
            onLayout={() => {
              if (zonaVisualRef.current) {
                (zonaVisualRef.current as any).measureInWindow((x: number, y: number, width: number, height: number) => {
                  if (width > 0 && height > 0) {
                    zonaActividadRef.current = { x, y, width, height };
                  }
                });
              }
            }}
            className={`min-h-[110px] rounded-2xl border-2 p-3 gap-2 ${
              itemsColocados.length > 0
                ? 'border-indigo-300 bg-indigo-50/60'
                : 'border-dashed border-indigo-300 bg-indigo-50/30 items-center justify-center'
            }`}
          >
            <View className="flex-row items-center justify-between pb-1">
              <Text className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                Tu orden ({itemsColocados.length} de {activity.items?.length || 0})
              </Text>
              {itemsColocados.length > 0 ? (
                <TouchableOpacity onPress={() => choose('')}>
                  <Text className="text-xs font-bold text-rose-700">Reiniciar</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {itemsColocados.length === 0 ? (
              <View className="items-center py-4 gap-1">
                <Ionicons name="layers-outline" size={26} color="#818CF8" />
                <Text className="text-xs font-bold text-indigo-700 text-center">
                  Toca o arrastra los pasos aquí
                </Text>
                <Text className="text-[11px] text-gray-500 text-center">
                  Iremos armando tu procedimiento paso a paso
                </Text>
              </View>
            ) : (
              itemsColocados.map((item, index) => (
                <View
                  key={`${item}-${index}`}
                  className="flex-row items-center justify-between rounded-xl border border-indigo-200 bg-white p-3 shadow-sm"
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => quitarPaso(index)}
                    className="flex-row items-center gap-2.5 flex-1 pr-2"
                  >
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-[#801F3F]">
                      <Text className="text-xs font-black text-white">{index + 1}</Text>
                    </View>
                    <Text className="text-sm font-semibold text-gray-900 flex-1">{item}</Text>
                  </TouchableOpacity>

                  <View className="flex-row items-center gap-1">
                    {index > 0 ? (
                      <TouchableOpacity
                        onPress={() => moverPaso(index, -1)}
                        className="h-8 w-8 items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200"
                      >
                        <Ionicons name="arrow-up" size={16} color="#374151" />
                      </TouchableOpacity>
                    ) : null}
                    {index < itemsColocados.length - 1 ? (
                      <TouchableOpacity
                        onPress={() => moverPaso(index, 1)}
                        className="h-8 w-8 items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200"
                      >
                        <Ionicons name="arrow-down" size={16} color="#374151" />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      onPress={() => quitarPaso(index)}
                      className="h-8 w-8 items-center justify-center rounded-lg bg-rose-50 active:bg-rose-100 ml-0.5"
                    >
                      <Ionicons name="close" size={16} color="#BE123C" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      );
    }

    if (activity.tipo === 'CONECTAR_FRASES') return <View className="gap-3"><Text className="text-xs text-gray-500">Toca un concepto y luego su pareja. Cada conexion se valida al instante.</Text><View className="flex-row gap-2"><View className="flex-1 gap-2">{activity.left_items?.map((left) => <TouchableOpacity key={left} onPress={() => seleccionarConcepto(left)} className={`p-3 rounded-xl ${parejaSeleccionada === left ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={parejaSeleccionada === left ? 'text-white text-xs font-bold' : 'text-gray-800 text-xs font-semibold'}>{left}</Text></TouchableOpacity>)}</View><View className="flex-1 gap-2">{activity.right_items?.map((right) => <TouchableOpacity key={right} onPress={() => void asignarConcepto(right)} className="p-3 rounded-xl bg-sky-50"><Text className="text-sky-900 text-xs font-semibold">{right}</Text></TouchableOpacity>)}</View></View>{Object.entries(parejas).map(([left, right]) => { const evaluacion = resultadoParejas[left]; return <View key={left} className={`rounded-xl p-3 ${evaluacion?.correct ? 'bg-emerald-50' : 'bg-rose-50'}`}><Text className="text-xs font-semibold text-gray-800">{left} → {right}</Text><Text className={`text-xs font-bold mt-1 ${evaluacion?.correct ? 'text-emerald-800' : 'text-rose-800'}`}>{evaluacion?.correct ? 'Relacion correcta' : `Vuelve a intentarlo. Relacion correcta: ${evaluacion?.expected || ''}`}</Text>{evaluacion?.explanation ? <Text className="text-xs text-gray-700 mt-1">{evaluacion.explanation}</Text> : null}</View>; })}</View>;

    // COMPLETAR -> seleccion grafica con opciones en fichas y hueco visual interactivo
    const pregunta = activity.question || '';
    const partes = pregunta.split(/_{3,}|\[___+\]/);
    const tieneHueco = partes.length > 1;
    const opcionesDisponibles: string[] =
      activity.options && activity.options.length > 0
        ? activity.options
        : (reto?.activities.flatMap((a) => a.options || []).filter((o, i, arr) => arr.indexOf(o) === i).slice(0, 4) || []);

    return (
      <View className="gap-4">
        <BentoCard className="p-4 bg-indigo-50/70 border border-indigo-100">
          <Text className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">
            Completa la respuesta
          </Text>
          {tieneHueco ? (
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="text-base font-semibold text-gray-800">{partes[0]}</Text>
              {respuestaActual ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => choose('')}
                  className="flex-row items-center gap-1.5 rounded-xl bg-[#801F3F] px-3.5 py-1.5 shadow-sm"
                >
                  <Text className="text-sm font-bold text-white">{respuestaActual}</Text>
                  <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <View className="rounded-xl border-2 border-dashed border-indigo-400 bg-white/90 px-3 py-1.5">
                  <Text className="text-xs font-bold text-indigo-600">Toca una opción</Text>
                </View>
              )}
              <Text className="text-base font-semibold text-gray-800">{partes.slice(1).join('_____')}</Text>
            </View>
          ) : (
            <View className="gap-3">
              <Text className="text-base font-semibold text-gray-800">{pregunta}</Text>
              <View className="flex-row items-center gap-2 pt-1">
                <Text className="text-xs font-bold text-gray-600">Tu respuesta:</Text>
                {respuestaActual ? (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => choose('')}
                    className="flex-row items-center gap-1.5 rounded-xl bg-[#801F3F] px-3.5 py-1.5 shadow-sm"
                  >
                    <Text className="text-sm font-bold text-white">{respuestaActual}</Text>
                    <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                ) : (
                  <View className="rounded-xl border-2 border-dashed border-indigo-400 bg-white px-3 py-1.5">
                    <Text className="text-xs font-bold text-indigo-600">Toca una opción de abajo</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </BentoCard>

        {opcionesDisponibles.length > 0 ? (
          <View className="gap-2">
            <Text className="text-xs font-bold text-gray-600">
              Opciones (toca para colocar o quitar):
            </Text>
            <View className="flex-row flex-wrap gap-2.5">
              {opcionesDisponibles.map((opcion) => {
                const estaSeleccionada = respuestaActual === opcion;
                return (
                  <TouchableOpacity
                    key={opcion}
                    activeOpacity={0.8}
                    onPress={() => choose(estaSeleccionada ? '' : opcion)}
                    className={`flex-row items-center gap-2 rounded-2xl border-2 px-4 py-3 shadow-sm ${
                      estaSeleccionada
                        ? 'border-[#801F3F] bg-rose-50'
                        : 'border-indigo-200 bg-white active:scale-95'
                    }`}
                  >
                    <Ionicons
                      name={estaSeleccionada ? 'checkmark-circle' : 'add-circle-outline'}
                      size={18}
                      color={estaSeleccionada ? '#801F3F' : '#6366F1'}
                    />
                    <Text
                      className={`text-sm font-bold ${
                        estaSeleccionada ? 'text-[#801F3F]' : 'text-gray-800'
                      }`}
                    >
                      {opcion}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View className="gap-2">
            <TextInput
              value={respuestaActual || textoLibre}
              onChangeText={(texto) => {
                setTextoLibre(texto);
                choose(texto);
              }}
              placeholder="Escribe la respuesta..."
              className="min-h-14 bg-gray-50 rounded-2xl p-4 text-sm text-gray-900 border border-gray-200"
            />
          </View>
        )}
      </View>
    );
  };

  if (tema) return <>
    <View className="flex-1 gap-3">
    <View className="flex-row items-center gap-3"><TouchableOpacity onPress={() => pantallaResumen ? setPantallaResumen(false) : setTema(null)} className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"><Ionicons name="arrow-back" size={20} color="#374151" /></TouchableOpacity><View className="flex-1"><Text className="text-lg font-black text-gray-900" numberOfLines={1}>{contenido?.title || tema.titulo}</Text><Text className="text-xs text-gray-500">{materiaNombre} · {pantallaResumen ? 'Resumen' : reto ? 'Prueba' : 'Lectura'}</Text></View></View>
    {tema.tipoMaterial === 'actividad' ? <BentoCard className="p-4 bg-amber-50"><Text className="font-bold text-amber-900">Actividad del docente</Text><Text className="text-xs text-amber-800 mt-1">Abre el archivo para revisar las instrucciones y completar la actividad.</Text></BentoCard> : contenidoLoading ? <View className="py-5 items-center"><ActivityIndicator color="#801529"/><Text className="text-xs text-gray-500 mt-2">Cargando contenido generado por IA...</Text></View> : !contenido ? <BentoCard className="p-4 bg-amber-50"><Text className="font-bold text-amber-900">{contenidoError ? 'No pudimos cargar el contenido de IA' : 'El análisis del material sigue en proceso'}</Text><Text className="text-xs text-amber-800 mt-1">{contenidoError ? (contenidoErrorDetalle || 'Revisa el estado y vuelve a intentarlo.') : 'Puedes leer el archivo mientras se prepara el resumen y las actividades.'}</Text><TouchableOpacity onPress={() => void actualizarContenido()} className="mt-3 self-start rounded-xl bg-white border border-amber-200 px-4 py-2"><Text className="text-xs font-bold text-amber-900">Actualizar contenido</Text></TouchableOpacity></BentoCard> : null}
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      {!reto && !pantallaResumen && <>
        {tema.tipoMaterial !== 'actividad' ? <BentoCard className="gap-2 bg-slate-50 p-3"><Text className="text-xs font-bold text-gray-600">LECTURA DEL DOCUMENTO</Text><LectorArchivo material={tema}/></BentoCard> : null}
        {tema.tipoMaterial !== 'actividad' && !rutaIniciada && (
          <TouchableOpacity
            disabled={!contenido || contenidoLoading || !partesRuta.length}
            onPress={() => {
              setTemaRutaAbierto(null);
              setParteRutaSeleccionada(0);
              setCartaRutaSeleccionada(0);
              setRutaIniciada(true);
            }}
            className="flex-row items-center justify-center gap-2 rounded-2xl bg-[#801F3F] p-4 shadow-sm disabled:opacity-50"
          >
            <Ionicons name="map" size={20} color="white"/>
            <Text className="font-black text-white">{contenidoLoading ? 'Preparando tu ruta...' : 'Iniciar ruta de aprendizaje'}</Text>
          </TouchableOpacity>
        )}

        {rutaIniciada && temaRutaAbierto === null && (
          <View className="gap-4">
            <BentoCard className="border border-maroon/20 bg-rose-50/40 p-4">
              <Text className="text-base font-black text-gray-900">Temas y capítulos del libro</Text>
              <Text className="text-xs leading-5 text-gray-600 mt-1">Selecciona un tema para estudiar sus 5 cartas de microlearning y, al final, el esquema visual de conexiones.</Text>
            </BentoCard>

            {partesRuta.map((parte, index) => (
              <TouchableOpacity
                key={`${parte.numero}-${parte.titulo}-${index}`}
                activeOpacity={0.85}
                onPress={() => {
                  setParteRutaSeleccionada(index);
                  setCartaRutaSeleccionada(0);
                  setTemaRutaAbierto(index);
                  avanzarProgresoTema(parte.numero, 20);
                }}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <View className="flex-row items-center justify-between">
                  <View className="rounded-lg bg-maroon/10 px-2.5 py-1">
                    <Text className="text-[10px] font-black uppercase text-maroon">Tema {parte.numero}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#801F3F" />
                </View>
                <Text className="mt-2 text-base font-black text-gray-900">{parte.titulo}</Text>
                <Text className="mt-1 text-xs leading-5 text-gray-600" numberOfLines={2}>{parte.resumen}</Text>
                <BarraProgresoTema
                  tema={`Tema ${parte.numero}`}
                  progreso={progresoDeTema(parte.numero).porcentaje}
                  completado={progresoDeTema(parte.numero).completado}
                  puntosAlCompletar={progresoDeTema(parte.numero).puntos}
                  onCompletado={() => marcarTemaCompletado(parte.numero, progresoDeTema(parte.numero).puntos)}
                  color="#2563EB"
                />
                <View className="mt-3 flex-row flex-wrap gap-1.5">
                  {parte.conceptos.slice(0, 3).map((concepto, cIdx) => (
                    <View key={`${concepto}-${cIdx}`} className="rounded-md bg-slate-100 px-2 py-0.5">
                      <Text className="text-[10px] font-semibold text-slate-700">{concepto}</Text>
                    </View>
                  ))}
                </View>
                <View className="mt-3 flex-row items-center gap-1 border-t border-gray-100 pt-2.5">
                  <Ionicons name="albums-outline" size={14} color="#6B7280" />
                  <Text className="text-[11px] font-semibold text-gray-500">5 ideas + esquema de conexiones</Text>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={() => setRutaIniciada(false)} className="rounded-xl border border-gray-300 bg-white p-3">
              <Text className="text-center text-xs font-bold text-gray-700">← Volver a lectura del documento</Text>
            </TouchableOpacity>
          </View>
        )}

        {rutaIniciada && temaRutaAbierto !== null && parteRutaActual && (
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => setTemaRutaAbierto(null)}
                className="flex-row items-center gap-1.5 rounded-xl bg-gray-100 px-3 py-2"
              >
                <Ionicons name="arrow-back" size={16} color="#374151" />
                <Text className="text-xs font-bold text-gray-700">Temas del libro</Text>
              </TouchableOpacity>
              <View className="flex-row items-center gap-1.5">
                {cartasRutaActual.map((_, dotIndex) => (
                  <TouchableOpacity
                    key={dotIndex}
                    onPress={() => setCartaRutaSeleccionada(dotIndex)}
                    className={`h-2.5 rounded-full ${dotIndex === cartaRutaSeleccionada ? 'w-6 bg-maroon' : 'w-2.5 bg-gray-300'}`}
                  />
                ))}
              </View>
            </View>

            <BentoCard className="border border-violet-100 bg-violet-50/50 p-4">
              <Text className="text-[10px] font-black uppercase text-violet-800 tracking-wider">Tema {parteRutaActual.numero}</Text>
              <Text className="text-lg font-black text-gray-900 mt-0.5">{parteRutaActual.titulo}</Text>
              <Text className="text-xs font-bold text-maroon mt-1">Carta {cartaRutaSeleccionada + 1} de {cartasRutaActual.length}</Text>
            </BentoCard>

            {cartaRutaActual ? (
              <BentoCard className="gap-3 border border-amber-200 bg-amber-50/40 p-5">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                    {cartaRutaActual.esEsquema ? 'Esquema visual del tema' : `Idea clave ${cartaRutaSeleccionada + 1} de 5`}
                  </Text>
                  <StatusBadge label={cartaRutaActual.esEsquema ? 'Conexiones' : 'Microlearning'} variant="warning" />
                </View>
                <Text className="text-xl font-black text-gray-900">{cartaRutaActual.titulo}</Text>
                <Text className="text-sm leading-6 text-gray-800">{cartaRutaActual.explicacion}</Text>
                {cartaRutaActual.indagacion ? (
                  <View className="mt-1 rounded-xl border border-violet-100 bg-violet-50 p-3">
                    <Text className="text-[10px] font-black uppercase text-violet-800">Pregunta de indagación</Text>
                    <Text className="mt-1 text-sm font-semibold text-violet-950">{cartaRutaActual.indagacion}</Text>
                  </View>
                ) : null}

                {!cartaRutaActual.esEsquema ? (
                  <View className="mt-2">
                    <EjemploCanvas ejemplos={[cartaRutaActual.ejemplo]} etiqueta="Ejercicio / Ejemplo resuelto" />
                  </View>
                ) : null}

                {cartaRutaActual.esEsquema && cartaRutaActual.svg ? (
                  <View className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                    <Text className="text-[10px] font-black uppercase text-slate-500 mb-1 px-1">Mapa de conexiones</Text>
                    <SvgXml xml={cartaRutaActual.svg} width="100%" height={260} />
                  </View>
                ) : null}

                <TouchableOpacity
                  disabled={Boolean(explicacionLoading)}
                  onPress={() => void explicarMejor({ title: cartaRutaActual.titulo, explanation: cartaRutaActual.explicacion, example: cartaRutaActual.ejemplo }, 'paso_a_paso')}
                  className="mt-2 self-start rounded-xl border border-violet-200 bg-white px-3.5 py-2 shadow-sm"
                >
                  <Text className="text-xs font-bold text-violet-900">
                    {explicacionLoading ? 'Preparando otra explicación…' : '¿Dudas con este concepto? Explicar de mejor manera'}
                  </Text>
                </TouchableOpacity>
              </BentoCard>
            ) : null}

            <View className="flex-row gap-2">
              <TouchableOpacity
                disabled={cartaRutaSeleccionada === 0}
                onPress={() => setCartaRutaSeleccionada((actual) => Math.max(0, actual - 1))}
                className="flex-1 rounded-xl bg-white border border-gray-200 p-3 disabled:opacity-40"
              >
                <Text className="text-center text-xs font-bold text-gray-700">← Anterior</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={cartaRutaSeleccionada + 1 >= cartasRutaActual.length}
                onPress={() => setCartaRutaSeleccionada((actual) => Math.min(cartasRutaActual.length - 1, actual + 1))}
                className="flex-1 rounded-xl bg-[#801F3F] p-3 disabled:opacity-40"
              >
                <Text className="text-center text-xs font-bold text-white">Siguiente carta →</Text>
              </TouchableOpacity>
            </View>

            {/* Último tema: al terminar las cartas, mostrar ejercicios finales + preguntas de indagación */}
            {cartaRutaSeleccionada + 1 === cartasRutaActual.length && parteRutaSeleccionada === partesRuta.length - 1 ? (
              <BentoCard className="gap-3 border border-emerald-200 bg-emerald-50 p-5 mt-2">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="trophy" size={24} color="#059669" />
                  <Text className="text-base font-black text-emerald-950">¡Completaste todas las cartas del material!</Text>
                </View>
                <Text className="text-xs text-emerald-800 leading-5">Has terminado el último tema. Pon a prueba tu comprensión con los ejercicios finales.</Text>
                {parteRutaActual && !progresoDeTema(parteRutaActual.numero).completado && (
                  <TouchableOpacity
                    onPress={() => {
                      marcarTemaCompletado(parteRutaActual.numero, 5);
                    }}
                    className="mt-2 self-start rounded-xl bg-emerald-100 px-3 py-1"
                  >
                    <Text className="text-xs font-bold text-emerald-800">Marcar tema como completado</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  disabled={retoLoading}
                  onPress={() => void iniciarReto(String(parteRutaActual.numero))}
                  className="rounded-xl bg-[#801F3F] p-3.5 shadow-sm"
                >
                  <Text className="text-center text-sm font-black text-white">🎯 Empezar ejercicios finales</Text>
                </TouchableOpacity>

                {/* Preguntas de inquiry-based learning para el último tema */}
                {parteRutaActual?.preguntas_indagacion?.length && (
                  <View className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                    <View className="flex-row items-center gap-2 mb-2">
                      <Ionicons name="help-circle-outline" size={18} color="#7C3AED" />
                      <Text className="text-xs font-bold text-violet-900 uppercase tracking-wider">
                        Preguntas para investigar más
                      </Text>
                    </View>
                    <View className="gap-2">
                      {parteRutaActual.preguntas_indagacion.map((preg, pIdx) => (
                        <TouchableOpacity
                          key={`indagacion-final-${pIdx}`}
                          onPress={() => void consultarIndagacionLLM(preg, tema!.id)}
                          className={`p-3 rounded-xl border flex-row items-center justify-between gap-2 ${
                            preguntaIndagacionActiva === preg
                              ? 'bg-violet-100 border-violet-300'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <View className="flex-1">
                            <Text className="text-xs font-semibold text-violet-800 leading-tight">
                              {preg}
                            </Text>
                          </View>
                          <Ionicons
                            name={preguntaIndagacionActiva === preg ? 'chevron-up' : 'chevron-down-outline'}
                            size={14}
                            color="#7C3AED"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Respuesta del LLM */}
                    {indagacionRespuesta && preguntaIndagacionActiva && (
                      <View className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <View className="flex-row items-center gap-2 mb-2">
                          <Ionicons name="chatbubbles-outline" size={16} color="#D97706" />
                          <Text className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                            Respuesta del profesor virtual
                          </Text>
                        </View>
                        <Text className="text-sm text-amber-800 leading-relaxed">
                          {indagacionRespuesta}
                        </Text>
                        {indagacionCargando ? (
                          <View className="mt-2 flex-row items-center gap-2">
                            <ActivityIndicator size="small" color="#D97706" />
                            <Text className="text-[10px] text-amber-700 font-medium">Consultando al profesor…</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                )}
              </BentoCard>
            ) : null}

            {/* Botón siguiente tema (solo si no es el último) */}
            {parteRutaSeleccionada + 1 < partesRuta.length ? (
              <TouchableOpacity
                onPress={() => {
                  const siguiente = parteRutaSeleccionada + 1;
                  setParteRutaSeleccionada(siguiente);
                  setCartaRutaSeleccionada(0);
                  setTemaRutaAbierto(siguiente);
                }}
                className="rounded-xl bg-white border border-emerald-300 p-3"
              >
                <Text className="text-center text-xs font-bold text-emerald-900">Siguiente tema: {partesRuta[parteRutaSeleccionada + 1].titulo} →</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity onPress={() => setTemaRutaAbierto(null)} className="rounded-xl bg-white/70 p-2.5">
              <Text className="text-center text-xs font-bold text-gray-600">Volver a la lista de temas</Text>
            </TouchableOpacity>
          </View>
        )}
      </>}
      {pantallaResumen && resumen && !reto && <><View className="flex-row items-center justify-between"><Text className="text-xl font-black text-gray-900">{(resumen.data as any)?.title || (resumen as any)?.title || 'Tu resumen'}</Text><StatusBadge label={(resumen.formato || 'ESQUEMA_GEMMA').replaceAll('_', ' ')} variant="brand"/></View><ResumenInteractivo key={`${resumen.content_id}-${resumen.formato}`} formato={(resumen.formato === 'CARTAS_EXPLICATIVAS' ? 'CARTAS_EXPLICATIVAS' : 'ESQUEMA_GEMMA') as FormatoResumen} data={(resumen.data || resumen) as any} explicacion={explicacion && seccionExplicada ? explicacion : null} explicacionLoading={Boolean(explicacionLoading)} onExplain={(section) => void explicarMejor(section, 'paso_a_paso')} onCompleteStudy={(formato) => { void gamificacionApi.registrarProgresoEstudio({ contentId: tema.id, titulo: (resumen.data as any)?.title || tema.titulo, materiaNombre, formato, completo: true }).then((resultado) => { if (resultado.bonoDesafios > 0) Alert.alert('¡Desafíos completados!', `Ganaste ${resultado.bonoDesafios} puntos de bono.`); }).catch(() => Alert.alert('No se registró el logro', 'Comprueba tu conexión e inténtalo de nuevo.')); }} onAlternateSummary={(formato) => void generarResumen(formato)} onStartActivity={() => void iniciarReto()}/></>}
      {reto && !resultadoReto && actividadActual && <View className="gap-4"><View className="flex-row items-center justify-between"><StatusBadge label={`RETO ${posicion + 1} / ${totalActividades}`} variant="brand"/><Text className="text-xs font-bold text-amber-700">⭐ Puntos: {puntosEnReto}</Text></View><BentoCard className="p-4 bg-indigo-50"><Text className="text-xs font-bold text-indigo-700">{actividadActual.tipo === 'SELECCION_MULTIPLE' ? 'SELECCIÓN MÚLTIPLE' : actividadActual.tipo === 'COMPLETAR' ? 'COMPLETA LA RESPUESTA' : actividadActual.tipo.replaceAll('_', ' ')}</Text>{actividadActual.learning_objective ? <Text className="mt-1 text-xs text-indigo-900">Concepto: {actividadActual.learning_objective}</Text> : null}</BentoCard>{actividadActual.exercise_svg ? <BentoCard className="bg-white p-2"><SvgXml xml={actividadActual.exercise_svg} width="100%" height={210}/></BentoCard> : null}<BentoCard className="p-4 bg-indigo-50"><Text className="text-lg font-black text-gray-900">{activityPrompt(actividadActual)}</Text></BentoCard>{renderReto(actividadActual)}<TouchableOpacity disabled={!puedeContinuar || retoSubmitting} onPress={() => void avanzarReto()} className="bg-maroon disabled:opacity-40 rounded-2xl p-4"><Text className="text-center text-white font-black">{retoSubmitting ? 'Analizando respuestas…' : posicion + 1 === totalActividades ? 'Terminar y ver mis puntos' : 'Continuar'}</Text></TouchableOpacity>{retoSubmitting ? <View className="items-center gap-2"><ActivityIndicator color="#801529"/><Text className="text-center text-xs text-gray-600">Estamos preparando tu retroalimentación para que puedas mejorar.</Text></View> : null}</View>}
      {resultadoReto && <View className="gap-3"><BentoCard className="p-6 items-center bg-amber-50"><Ionicons name="trophy" size={48} color="#D97706"/><Text className="text-2xl font-black text-gray-900 mt-3">Reto completado</Text><Text className="text-base text-gray-700 mt-2">{resultadoReto.correctas} de {resultadoReto.total} correctas</Text><Text className="text-3xl font-black text-maroon mt-2">{resultadoReto.puntos} puntos ganados</Text></BentoCard>{resultadoReto.feedback ? <BentoCard className="gap-2 border border-violet-200 bg-violet-50 p-4"><Text className="font-bold text-violet-950">{resultadoReto.feedback.pending ? 'Analizando tu avance…' : 'Tu retroalimentación'}</Text><Text className="text-sm leading-6 text-violet-900">{resultadoReto.feedback.feedback}</Text><Text className="text-sm font-semibold text-violet-950">Cómo mejorar: {resultadoReto.feedback.next_step}</Text></BentoCard> : null}{resultadoReto.answers.map((answer, index) => { const actividad = reto?.activities.find((item) => item.activity_id === answer.activity_id); const titulo = actividad?.question || activityPrompt(actividad || { activity_id: answer.activity_id, tipo: 'COMPLETAR' }); const feedback = answer.feedback; const duda = !answer.correct; return <BentoCard key={answer.activity_id} className={`p-4 ${duda ? 'bg-rose-50' : 'bg-emerald-50'}`}><Text className="text-xs font-bold">{duda ? 'A REFORZAR' : 'DOMINADO'} · {answer.tipo.replaceAll('_', ' ')}</Text><Text className="text-sm font-bold text-gray-900 mt-1">{index + 1}. {titulo}</Text><Text className="text-sm text-gray-700 mt-2">{feedback?.where_failed || (duda ? 'Tu respuesta no coincide con la información del material.' : 'Aplicaste correctamente el concepto.')}</Text>{duda ? <TouchableOpacity disabled={Boolean(explicacionLoading)} onPress={() => void explicarMejor({ title: answer.concept || titulo, explanation: feedback?.explanation || answer.concept || titulo, example: feedback?.correct_answer }, 'paso_a_paso')} className="mt-3 self-start rounded-xl bg-white border border-rose-200 px-3 py-2"><Text className="text-xs font-bold text-rose-900">Explicar esta duda</Text></TouchableOpacity> : null}</BentoCard>; })}<TouchableOpacity disabled={retoLoading} onPress={() => void iniciarReto(seccionRetoActual)} className="rounded-xl bg-[#801F3F] px-6 py-3"><Text className="text-center font-bold text-white">Repetir reto para mejorar</Text></TouchableOpacity><TouchableOpacity onPress={() => setTema(null)} className="bg-maroon rounded-xl px-6 py-3"><Text className="text-center text-white font-bold">Volver a temas</Text></TouchableOpacity></View>}
    </ScrollView>
    </View>
    <Modal visible={modalExplicacionVisible} animationType="fade" transparent onRequestClose={() => setModalExplicacionVisible(false)}>
      <View className="flex-1 justify-end bg-black/40"><View className="max-h-[85%] rounded-t-3xl bg-white p-6 gap-4">{explicacionLoading ? <View className="items-center gap-3 py-8"><ActivityIndicator color="#801529" size="large"/><Text className="text-center text-lg font-black text-gray-900">Analizando y preparando contenido</Text><Text className="text-center text-sm text-gray-600">Estamos construyendo una explicación clara para tu duda.</Text></View> : explicacion ? <><Text className="text-xl font-black text-gray-900">{explicacion.title}</Text><ScrollView><Text className="text-sm leading-6 text-gray-700">{explicacion.explanation}</Text>{explicacion.explanation_svg ? <SvgXml xml={explicacion.explanation_svg} width="100%" height={210}/> : null}<Text className="mt-3 text-sm font-bold text-gray-900">Respuesta correcta y ejemplo</Text><EjemploCanvas ejemplos={explicacion.examples || []}/></ScrollView><TouchableOpacity onPress={() => setModalExplicacionVisible(false)} className="rounded-xl bg-maroon p-3"><Text className="text-center font-bold text-white">Entendido</Text></TouchableOpacity></> : null}</View></View>
    </Modal>
    <Modal visible={retoLoading} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => undefined}>
      <View className="flex-1 items-center justify-center bg-[#F8F7F6] px-7">
        <View className="mb-8 h-40 w-64 items-center justify-center">
          <Animated.View
            style={{
              position: 'absolute',
              left: 22,
              top: 18,
              transform: [
                { translateY: cargaPulso.interpolate({ inputRange: [0, 1], outputRange: [5, -7] }) },
                { rotate: '-12deg' },
              ],
            }}
            className="h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 shadow-sm"
          >
            <Ionicons name="book" size={30} color="#2563EB" />
          </Animated.View>
          <Animated.View
            style={{
              transform: [
                { scale: cargaPulso.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.08] }) },
                { rotate: cargaPulso.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
              ],
            }}
            className="z-10 h-24 w-24 items-center justify-center rounded-[28px] bg-[#801F3F] shadow-lg"
          >
            <Ionicons name="flash" size={46} color="#FFD700" />
          </Animated.View>
          <Animated.View
            style={{
              position: 'absolute',
              right: 20,
              bottom: 14,
              transform: [
                { translateY: cargaPulso.interpolate({ inputRange: [0, 1], outputRange: [-5, 7] }) },
                { rotate: '10deg' },
              ],
            }}
            className="h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 shadow-sm"
          >
            <Ionicons name="bulb" size={30} color="#D97706" />
          </Animated.View>
        </View>
        <Text className="text-center text-xl font-black text-gray-900">Tu reto está tomando forma</Text>
        <Animated.Text
          key={MENSAJES_CARGA_RETO[mensajeCargaReto]}
          style={{ opacity: mensajeOpacity, transform: [{ translateY: mensajeOffset }] }}
          className="mt-3 min-h-12 text-center text-base font-semibold text-[#801F3F]"
        >
          {MENSAJES_CARGA_RETO[mensajeCargaReto]}
        </Animated.Text>
        <View className="mt-6 h-2 w-64 overflow-hidden rounded-full bg-rose-100">
          <Animated.View
            style={{ transform: [{ translateX: cargaMovimiento.interpolate({ inputRange: [0, 1], outputRange: [-90, 260] }) }] }}
            className="h-full w-24 rounded-full bg-[#801F3F]"
          />
        </View>
      </View>
    </Modal>
  </>;

  // Helper: agrupar materiales por temaId
  const materialesPorTema = materiales.reduce((acc, mat) => {
    const key = mat.temaId || 'sin_tema';
    if (!acc[key]) acc[key] = [];
    acc[key].push(mat);
    return acc;
  }, {} as Record<string, MaterialItem[]>);

  // Helper: obtener unidades únicas ordenadas
  const unidades = [...new Set(malla.map(t => t.unidad))].sort((a, b) => a - b);
  const temasMallaIds = new Set(malla.map((item) => String(item.id)));
  const materialesSinTemaMalla = materiales.filter((item) => !item.temaId || !temasMallaIds.has(String(item.temaId)));
  const renderMaterialSinTema = (material: MaterialItem) => <TouchableOpacity key={material.id} onPress={() => void abrirTema(material)} className="p-3 bg-white rounded-xl border border-gray-200 flex-row items-center gap-3">
    <Ionicons name={material.tipoMaterial === 'actividad' ? 'clipboard-outline' : 'document-text-outline'} size={19} color={material.tipoMaterial === 'actividad' ? '#B45309' : '#2563EB'} />
    <View className="flex-1"><Text className="font-bold text-gray-900 text-sm">{material.titulo}</Text><Text className="text-xs text-gray-500 mt-0.5">{material.tipoMaterial === 'actividad' ? 'Actividad del docente' : material.detalle || material.nombreArchivo || 'Material de estudio'}</Text></View>
    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
  </TouchableOpacity>;

  return <View className="gap-4 my-2">
    <View className="flex-row items-center justify-between"><View><Text className="text-lg font-black text-gray-900">Malla Curricular · {materiaNombre}</Text><Text className="text-xs text-gray-500">{unidades.length} unidad{unidades.length !== 1 ? 'es' : ''} · {malla.length} tema{malla.length !== 1 ? 's' : ''}</Text></View><StatusBadge label={`${materiales.length} Recursos`} variant="brand"/></View>

    {(loading || mallaLoading) ? <View className="p-8 items-center"><ActivityIndicator color="#801529"/><Text className="text-xs text-gray-500 mt-2">Cargando plan de estudios...</Text></View> : malla.length === 0 ? <View className="gap-3"><BentoCard className="p-4 bg-gray-50"><Text className="text-sm font-bold text-gray-700">Materiales de {materiaNombre}</Text><Text className="text-xs text-gray-500 mt-1">No hay una malla disponible; aquí aparecen igualmente los archivos compartidos por el docente.</Text></BentoCard>{materiales.length ? materiales.map(renderMaterialSinTema) : <BentoCard className="p-6 items-center bg-gray-50"><Ionicons name="book-outline" size={32} color="#9CA3AF"/><Text className="text-sm font-bold text-gray-600 mt-2">Todavía no hay materiales para {materiaNombre}</Text></BentoCard>}</View> : (
      <View className="gap-4">
        {unidades.map((unidadNum) => {
          const temasUnidad = malla.filter(t => t.unidad === unidadNum);
          const temasConMateriales = temasUnidad.filter(t => materialesPorTema[t.id]?.length);
          return (
            <BentoCard key={`unidad-${unidadNum}`} className="p-4 bg-white border border-gray-100">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <View className="w-8 h-8 rounded-xl bg-maroon/10 items-center justify-center">
                    <Ionicons name="grid-outline" size={18} color="#801529" />
                  </View>
                  <Text className="text-lg font-black text-gray-900">Unidad {unidadNum}</Text>
                </View>
                <View className="text-xs text-gray-400 font-mono">{temasUnidad.length} tema{temasUnidad.length !== 1 ? 's' : ''}</View>
              </View>

              <View className="gap-2">
                {temasUnidad.map((tema) => {
                  const mats = materialesPorTema[tema.id] || [];
                  const estudios = mats.filter(m => m.tipoMaterial !== 'actividad');
                  const actividades = mats.filter(m => m.tipoMaterial === 'actividad');
                  return (
                    <View key={tema.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 gap-3">
                      <View>
                        <View className="flex-row items-center gap-2 flex-wrap">
                          <View className={`w-6 h-6 rounded-lg items-center justify-center ${tema.esEvaluacion ? 'bg-amber-100' : 'bg-blue-100'}`}>
                            <Ionicons name={tema.esEvaluacion ? 'flag' : 'book'} size={13} color={tema.esEvaluacion ? '#D97706' : '#2563EB'} />
                          </View>
                          <Text className="flex-1 text-sm font-bold text-gray-900">{tema.titulo}</Text>
                          {tema.esEvaluacion && <View className="px-1.5 py-0.5 bg-amber-100 rounded-md"><Text className="text-[9px] font-bold text-amber-700">EVALUACIÓN</Text></View>}
                        </View>
                        {tema.contenidos ? <Text className="text-xs text-gray-500 mt-1">{tema.contenidos}</Text> : null}
                      </View>
                      {estudios.length > 0 ? <View className="gap-1.5">
                        <Text className="text-[10px] font-black uppercase text-blue-800">Material educativo</Text>
                        {estudios.map((material) => <TouchableOpacity key={material.id} onPress={() => void abrirTema(material)} className="flex-row items-center gap-2 rounded-lg bg-white border border-blue-100 p-2.5">
                          <Ionicons name="document-text-outline" size={17} color="#2563EB" />
                          <View className="flex-1"><Text className="text-xs font-bold text-gray-800">{material.titulo}</Text><Text className="text-[10px] text-gray-500">{material.nombreArchivo || material.detalle || 'Abrir material'}</Text></View>
                          <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                        </TouchableOpacity>)}
                      </View> : null}
                      {actividades.length > 0 ? <View className="gap-1.5">
                        <Text className="text-[10px] font-black uppercase text-amber-800">Actividades del tema</Text>
                        {actividades.map((material) => <TouchableOpacity key={material.id} onPress={() => void abrirTema(material)} className="flex-row items-center gap-2 rounded-lg bg-white border border-amber-100 p-2.5">
                          <Ionicons name="clipboard-outline" size={17} color="#B45309" />
                          <View className="flex-1"><Text className="text-xs font-bold text-gray-800">{material.titulo}</Text><Text className="text-[10px] text-gray-500">{material.nombreArchivo || material.detalle || 'Abrir actividad'}</Text></View>
                          <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                        </TouchableOpacity>)}
                      </View> : null}
                      {mats.length === 0 ? <Text className="text-[10px] text-gray-400">Todavía no hay materiales para este tema.</Text> : null}
                    </View>
                  );
                })}
              </View>
            </BentoCard>
          );
        })}

        {/* Materiales sin tema asignado */}
        {materialesSinTemaMalla.length > 0 && (
          <BentoCard className="p-4 bg-white border border-gray-100">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-xl bg-gray-200 items-center justify-center">
                  <Ionicons name="folder-open-outline" size={18} color="#6B7280" />
                </View>
                <Text className="text-lg font-black text-gray-900">Sin unidad asignada</Text>
              </View>
              <View className="text-xs text-gray-400 font-mono">{materialesSinTemaMalla.length} recurso{materialesSinTemaMalla.length !== 1 ? 's' : ''}</View>
            </View>
            <View className="gap-2">
              {materialesSinTemaMalla.map(renderMaterialSinTema)}
            </View>
          </BentoCard>
        )}
      </View>
    )}
  </View>;
}

function activityPrompt(activity: ActividadAprendizaje): string {
  if (activity.tipo === 'CONECTAR_FRASES') return 'Conecta cada concepto con su pareja';
  if (activity.tipo === 'DRAG_AND_DROP') return 'Ordena los pasos para resolver el ejercicio';
  return activity.question || 'Completa o selecciona la respuesta correcta';
}
