import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, PanResponder, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicServicesApi, type TemaMalla } from '../../../api/academicServices.api';
import { ApiClientError } from '../../../api/client';
import { aprendizajeApi, type ActividadAprendizaje, type ContenidoAprendizaje, type ExplicacionSeccion, type FormatoResumen, type ResumenAprendizaje, type ResultadoReto, type RetoAprendizaje } from '../../../api/aprendizaje.api';
import { gamificacionApi, type PreguntaActividad, type RespuestaActividad } from '../../../api/gamificacion.api';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { DocumentWebView } from './DocumentWebView';
import { ResumenInteractivo } from './ResumenInteractivo';
import { EjemploCanvas } from './EjemploCanvas';
import { SigueAprendiendo } from './SigueAprendiendo';
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
  { id: 'ESQUEMA_GEMMA', label: 'Esquema', detail: 'Diagrama interactivo con Skia', icon: 'share-social-outline' },
];

interface ZonaActividad {
  x: number;
  y: number;
  width: number;
  height: number;
}

function PiezaArrastrable({ texto, destino, alSoltar }: { texto: string; destino: React.MutableRefObject<ZonaActividad>; alSoltar: () => void }) {
  const posicion = useRef(new Animated.ValueXY()).current;
  const gesto = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, estado) => Math.abs(estado.dx) + Math.abs(estado.dy) > 8,
    onPanResponderMove: Animated.event([null, { dx: posicion.x, dy: posicion.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, estado) => {
      const area = destino.current;
      if (estado.moveX >= area.x && estado.moveX <= area.x + area.width && estado.moveY >= area.y && estado.moveY <= area.y + area.height) alSoltar();
      Animated.spring(posicion, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(posicion, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start(),
  });
  return <Animated.View {...gesto.panHandlers} style={{ transform: posicion.getTranslateTransform(), zIndex: 2 }}><BentoCard className="border border-indigo-200 bg-indigo-50 p-3"><Text className="text-sm font-semibold text-indigo-900">{texto}</Text></BentoCard></Animated.View>;
}

function LectorArchivo({ material }: { material: MaterialItem }) {
  const extension = (material.nombreArchivo || '').split('.').pop()?.toLowerCase();
  const esImagen = material.tipoMime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '');
  const esPdf = material.tipoMime === 'application/pdf' || extension === 'pdf';
  const url = normalizarUrlMovil(material.archivoUrl);
  const usarPdfNativo = Platform.OS !== 'web' && esPdf;
  return <DocumentWebView uri={url} title={material.titulo} mimeType={material.tipoMime} isPdf={esPdf} preferNativePdf={usarPdfNativo} fileName={material.nombreArchivo}/>;
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

export function ContenidoEstudioSection({ asignacionId, nivel, grado, materiaId, materiaNombre }: ContenidoEstudioSectionProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [materiales, setMateriales] = useState<MaterialItem[]>([]);
  const [tema, setTema] = useState<MaterialItem | null>(null);
  const [contenido, setContenido] = useState<ContenidoAprendizaje | null>(null);
  const [contenidoLoading, setContenidoLoading] = useState(false);
  const [contenidoError, setContenidoError] = useState(false);
  const [contenidoErrorDetalle, setContenidoErrorDetalle] = useState('');
  const [resumen, setResumen] = useState<ResumenAprendizaje | null>(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [pantallaResumen, setPantallaResumen] = useState(false);
  const [reto, setReto] = useState<RetoAprendizaje | null>(null);
  const [retoLoading, setRetoLoading] = useState(false);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [opcionSeleccionada, setOpcionSeleccionada] = useState<string | null>(null);
  const [parejaSeleccionada, setParejaSeleccionada] = useState<string | null>(null);
  const [parejas, setParejas] = useState<Record<string, string>>({});
  const [resultadoParejas, setResultadoParejas] = useState<Record<string, { correct: boolean; expected?: string; explanation?: string }>>({});
  const [textoLibre, setTextoLibre] = useState('');
  const [posicion, setPosicion] = useState(0);
  const [resultadoReto, setResultadoReto] = useState<{ puntos: number; correctas: number; total: number; answers: ResultadoReto['answers'] } | null>(null);
  const [explicacion, setExplicacion] = useState<ExplicacionSeccion | null>(null);
  const [seccionExplicada, setSeccionExplicada] = useState<string | null>(null);
  const [explicacionLoading, setExplicacionLoading] = useState<string | null>(null);
  const inicioRetoRef = useRef(0);
  const zonaActividadRef = useRef<ZonaActividad>({ x: 0, y: 0, width: 0, height: 0 });
  const zonaVisualRef = useRef<View | null>(null);

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
    setContenidoError(false);
    setContenidoErrorDetalle('');
    setResumen(null);
    setExplicacion(null);
    setSeccionExplicada(null);
    setPantallaResumen(false);
    setReto(null);
    setResultadoReto(null);
    inicioRetoRef.current = Date.now();
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
    setExplicacionLoading(key);
    try {
      setExplicacion(await aprendizajeApi.explicarSeccion(tema.id, { ...section, format }));
      setSeccionExplicada(section.title);
    } catch {
      Alert.alert('No se pudo generar la explicación', 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setExplicacionLoading(null);
    }
  };

  const iniciarReto = async () => {
    if (!tema) return;
    setRetoLoading(true);
    setRespuestas({});
    setParejas({});
    setResultadoParejas({});
    setPosicion(0);
    setResultadoReto(null);
    try {
      setReto(await aprendizajeApi.reto(tema.id, 6));
    } catch (error) {
      const detalle = error instanceof ApiClientError ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.';
      Alert.alert('No se pudo preparar el reto', detalle);
    } finally {
      setRetoLoading(false);
    }
  };

  const actividadActual = reto?.activities[posicion];
  const totalActividades = reto?.activities.length ?? 0;
  const preguntasParaSeguir = Array.from(new Set([
    ...(contenido?.inquiry_questions || []),
    ...(contenido?.microlearning_units || []).map((unidad) => unidad.inquiry_question),
  ].map((pregunta) => pregunta.trim()).filter(Boolean))).slice(0, 8);

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
    : actividadActual.tipo === 'CUESTIONARIO'
    ? respuestaActual.trim().length > 0 || textoLibre.trim().length > 0
    : Boolean(respuestaActual);

  const avanzarReto = async () => {
    if (!actividadActual || !reto) return;
    if (actividadActual.tipo === 'CONECTAR_FRASES') {
      const answer = Object.entries(parejas).map(([left, right]) => `${left} => ${right}`).join(';');
      setRespuestas((previous) => ({ ...previous, [actividadActual.activity_id]: answer }));
    }
    if (posicion + 1 < totalActividades) {
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
    if (actividadActual.tipo === 'CUESTIONARIO') respuestasFinales[actividadActual.activity_id] = textoLibre || respuestasFinales[actividadActual.activity_id];
    if (actividadActual.tipo === 'FLASHCARD' && !respuestasFinales[actividadActual.activity_id]) respuestasFinales[actividadActual.activity_id] = 'recordado';
    const answers = reto.activities.map((activity) => ({ activity_id: activity.activity_id, response: respuestasFinales[activity.activity_id] || '' }));
    try {
      const resultado = await aprendizajeApi.completarReto(tema!.id, reto.quiz_id, answers, Date.now() - inicioRetoRef.current);
      let puntos = Math.round((resultado.score || 0) * 10) * totalActividades;
      try {
        const preguntas: PreguntaActividad[] = reto.activities.map((activity, index) => ({
          id: activity.activity_id,
          texto: activity.question || activity.front || activity.statement || `Actividad ${index + 1}`,
          tipo: activity.tipo === 'FLASHCARD' ? 'flashcards' : activity.tipo === 'VERDADERO_FALSO' ? 'verdadero_falso' : activity.tipo === 'CONECTAR_FRASES' ? 'conectar' : activity.tipo === 'DRAG_AND_DROP' ? 'drag_drop' : activity.tipo === 'CUESTIONARIO' ? 'cuestionario' : 'seleccion_multiple',
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
          tiempoMs: 30000,
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
          tiempoTotalMs: totalActividades * 30000,
          fechaInicio: new Date(Date.now() - totalActividades * 30000).toISOString(),
          fechaFin: new Date().toISOString(),
        });
        puntos = reward.puntosGanados;
      } catch (error) {
        console.error('No se pudo registrar puntos de gamificacion:', error);
      }
      setResultadoReto({ puntos, correctas: resultado.correct, total: resultado.total, answers: resultado.answers });
      return;
    } catch (error) {
      console.error('No se pudo registrar el resultado del reto:', error);
      Alert.alert('No se pudo guardar el resultado', 'Intenta enviar tus respuestas otra vez.');
    }
  };

  const renderReto = (activity: ActividadAprendizaje) => {
    const choose = (answer: string) => responderSeleccion(activity, answer);
    if (activity.tipo === 'SELECCION_MULTIPLE') return <View className="gap-2">{activity.options?.map((option) => <TouchableOpacity key={option} onPress={() => choose(option)} className={`p-4 rounded-2xl border ${respuestaActual === option ? 'border-maroon bg-maroon/10' : 'border-gray-200 bg-white'}`}><Text className="text-sm font-semibold text-gray-800">{option}</Text></TouchableOpacity>)}</View>;
    if (activity.tipo === 'VERDADERO_FALSO') return <View className="flex-row gap-3">{['Verdadero', 'Falso'].map((option) => <TouchableOpacity key={option} onPress={() => choose(option)} className={`flex-1 p-4 rounded-2xl border ${respuestaActual === option ? 'border-maroon bg-maroon/10' : 'border-gray-200'}`}><Text className="text-center font-bold">{option}</Text></TouchableOpacity>)}</View>;
    if (activity.tipo === 'FLASHCARD') return <View className="gap-3"><BentoCard className="p-6 bg-amber-50"><Text className="text-center text-lg font-bold">{respuestaActual === 'recordado' ? activity.back : activity.front}</Text></BentoCard><TouchableOpacity onPress={() => choose(respuestaActual === 'recordado' ? 'no lo recuerdo' : 'recordado')} className="bg-maroon rounded-2xl p-4"><Text className="text-center text-white font-bold">{respuestaActual === 'recordado' ? 'Ver de nuevo' : 'Ya lo recorde'}</Text></TouchableOpacity></View>;
    if (activity.tipo === 'DRAG_AND_DROP') return <View className="gap-3"><Text className="text-xs text-gray-500">Arrastra cada pieza al area de respuesta para ordenar el procedimiento.</Text><View className="flex-row flex-wrap gap-2">{activity.items?.filter((item) => !respuestaActual.split(';').includes(item)).map((item) => <PiezaArrastrable key={item} texto={item} destino={zonaActividadRef} alSoltar={() => choose([respuestaActual, item].filter(Boolean).join(';'))}/>)}</View><View ref={zonaVisualRef} onLayout={() => zonaVisualRef.current?.measureInWindow((x, y, width, height) => { zonaActividadRef.current = { x, y, width, height }; })} className="min-h-20 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-3"><Text className="text-xs font-bold text-indigo-800">Tu orden · suelta aqui</Text>{respuestaActual.split(';').filter(Boolean).map((item, index) => <Text key={`${item}-${index}`} className="mt-2 rounded-xl bg-white p-3 text-sm text-gray-800">{index + 1}. {item}</Text>)}</View>{respuestaActual ? <TouchableOpacity onPress={() => choose('')}><Text className="text-xs font-bold text-maroon">Borrar respuesta</Text></TouchableOpacity> : null}</View>;
    if (activity.tipo === 'CONECTAR_FRASES') return <View className="gap-3"><Text className="text-xs text-gray-500">Toca un concepto y luego su pareja. Cada conexion se valida al instante.</Text><View className="flex-row gap-2"><View className="flex-1 gap-2">{activity.left_items?.map((left) => <TouchableOpacity key={left} onPress={() => seleccionarConcepto(left)} className={`p-3 rounded-xl ${parejaSeleccionada === left ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={parejaSeleccionada === left ? 'text-white text-xs font-bold' : 'text-gray-800 text-xs font-semibold'}>{left}</Text></TouchableOpacity>)}</View><View className="flex-1 gap-2">{activity.right_items?.map((right) => <TouchableOpacity key={right} onPress={() => void asignarConcepto(right)} className="p-3 rounded-xl bg-sky-50"><Text className="text-sky-900 text-xs font-semibold">{right}</Text></TouchableOpacity>)}</View></View>{Object.entries(parejas).map(([left, right]) => { const evaluacion = resultadoParejas[left]; return <View key={left} className={`rounded-xl p-3 ${evaluacion?.correct ? 'bg-emerald-50' : 'bg-rose-50'}`}><Text className="text-xs font-semibold text-gray-800">{left} → {right}</Text><Text className={`text-xs font-bold mt-1 ${evaluacion?.correct ? 'text-emerald-800' : 'text-rose-800'}`}>{evaluacion?.correct ? 'Relacion correcta' : `Vuelve a intentarlo. Relacion correcta: ${evaluacion?.expected || ''}`}</Text>{evaluacion?.explanation ? <Text className="text-xs text-gray-700 mt-1">{evaluacion.explanation}</Text> : null}</View>; })}</View>;
    return <View className="gap-3"><TextInput value={textoLibre} onChangeText={setTextoLibre} multiline placeholder={activity.question?.includes('_____') ? 'Completa el espacio en blanco' : 'Escribe tu respuesta'} className="min-h-28 bg-gray-50 rounded-2xl p-4 text-sm text-gray-900"/><TouchableOpacity onPress={() => choose(textoLibre)} className="bg-sky-50 p-3 rounded-xl"><Text className="text-sky-900 font-bold">{activity.question?.includes('_____') ? 'Comprobar respuesta' : 'Guardar respuesta'}</Text></TouchableOpacity></View>;
  };

  if (tema) return <View className="flex-1 gap-3">
    <View className="flex-row items-center gap-3"><TouchableOpacity onPress={() => pantallaResumen ? setPantallaResumen(false) : setTema(null)} className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"><Ionicons name="arrow-back" size={20} color="#374151" /></TouchableOpacity><View className="flex-1"><Text className="text-lg font-black text-gray-900" numberOfLines={1}>{contenido?.title || tema.titulo}</Text><Text className="text-xs text-gray-500">{materiaNombre} · {pantallaResumen ? 'Resumen' : reto ? 'Prueba' : 'Lectura'}</Text></View></View>
    {tema.tipoMaterial === 'actividad' ? <BentoCard className="p-4 bg-amber-50"><Text className="font-bold text-amber-900">Actividad del docente</Text><Text className="text-xs text-amber-800 mt-1">Abre el archivo para revisar las instrucciones y completar la actividad.</Text></BentoCard> : contenidoLoading ? <View className="py-5 items-center"><ActivityIndicator color="#801529"/><Text className="text-xs text-gray-500 mt-2">Cargando contenido generado por IA...</Text></View> : !contenido ? <BentoCard className="p-4 bg-amber-50"><Text className="font-bold text-amber-900">{contenidoError ? 'No pudimos cargar el contenido de IA' : 'El análisis del material sigue en proceso'}</Text><Text className="text-xs text-amber-800 mt-1">{contenidoError ? (contenidoErrorDetalle || 'Revisa el estado y vuelve a intentarlo.') : 'Puedes leer el archivo mientras se prepara el resumen y las actividades.'}</Text><TouchableOpacity onPress={() => void actualizarContenido()} className="mt-3 self-start rounded-xl bg-white border border-amber-200 px-4 py-2"><Text className="text-xs font-bold text-amber-900">Actualizar contenido</Text></TouchableOpacity></BentoCard> : null}
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      {!reto && !pantallaResumen && <>
        {tema.tipoMaterial !== 'actividad' && <View className="gap-2"><Text className="text-sm font-black text-gray-900">Opciones de estudio con IA</Text><View className="flex-row flex-wrap gap-2">{FORMATOS.map((format) => <TouchableOpacity key={format.id} disabled={resumenLoading} onPress={() => void generarResumen(format.id)} className="w-[48%] min-h-20 px-3 py-3 bg-white border border-[#E8D9DD] rounded-2xl flex-row items-center gap-2"><Ionicons name={format.icon} size={19} color="#801F3F"/><View className="flex-1"><Text className="text-xs font-bold text-[#801F3F]">{format.label}</Text><Text className="text-[10px] text-gray-500 mt-1">{format.detail}</Text></View></TouchableOpacity>)}</View>{resumenLoading && <View className="items-center py-2"><ActivityIndicator color="#801529"/><Text className="text-xs text-gray-500 mt-2">Preparando tu resumen...</Text></View>}</View>}
        {contenido ? <View className="gap-3">
          <BentoCard className="p-4 bg-[#FBF5EC]">
            <Text className="text-xs font-black text-[#801F3F]">RESUMEN BASE GENERADO POR IA</Text>
            <Text className="text-sm text-gray-800 mt-2">{contenido.summary}</Text>
            {contenido.key_concepts?.length ? <View className="mt-3"><Text className="text-xs font-bold text-[#801F3F]">Conceptos clave</Text><View className="flex-row flex-wrap gap-2 mt-2">{contenido.key_concepts.map((concept, index) => <View key={`${concept}-${index}`} className="rounded-full bg-white px-3 py-1.5"><Text className="text-xs text-gray-800">{concept}</Text></View>)}</View></View> : null}
            {contenido.learning_objectives?.length ? <View className="mt-3"><Text className="text-xs font-bold text-[#801F3F]">Al terminar podrás</Text>{contenido.learning_objectives.map((objective, index) => <Text key={`${index}-${objective}`} className="text-xs text-gray-700 mt-1">• {objective}</Text>)}</View> : null}
            {contenido.microlearning_units?.length ? <View className="mt-3 gap-2"><Text className="text-xs font-bold text-[#801F3F]">Aprende por partes</Text>{contenido.microlearning_units.map((unit, index) => <View key={`${unit.title}-${index}`} className="rounded-xl bg-white p-3"><Text className="text-sm font-bold text-gray-900">{unit.title}</Text><Text className="text-xs text-gray-700 mt-1">{unit.explanation}</Text></View>)}</View> : null}
          </BentoCard>
          <SigueAprendiendo
            unidades={contenido.microlearning_units || []}
            preguntas={preguntasParaSeguir}
            preguntaActiva={seccionExplicada}
            explicacion={explicacion}
            cargandoPregunta={explicacionLoading}
            onPregunta={(pregunta, unidad) => void explicarMejor({ title: pregunta, explanation: unidad.explanation, example: unidad.title }, 'preguntas')}
          />
        </View> : null}
        <BentoCard className="p-3 bg-slate-50"><Text className="text-xs font-bold text-gray-600 mb-2">LECTURA DEL MATERIAL</Text><LectorArchivo material={tema}/></BentoCard>
        {tema.tipoMaterial !== 'actividad' && <TouchableOpacity disabled={retoLoading} onPress={() => void iniciarReto()} className="bg-maroon rounded-2xl p-4 flex-row items-center justify-center gap-2"><Ionicons name="flash" size={19} color="#FFD700"/><Text className="text-white font-black">{retoLoading ? 'Preparando actividades...' : 'Practicar con actividades IA'}</Text></TouchableOpacity>}
      </>}
      {pantallaResumen && resumen && !reto && <><View className="flex-row items-center justify-between"><Text className="text-xl font-black text-gray-900">{(resumen.data as any).title || 'Tu resumen'}</Text><StatusBadge label={resumen.formato.replaceAll('_', ' ')} variant="brand"/></View><ResumenInteractivo key={`${resumen.content_id}-${resumen.formato}`} formato={resumen.formato} data={resumen.data} explicacion={explicacion && seccionExplicada ? explicacion : null} explicacionLoading={Boolean(explicacionLoading)} onExplain={(section) => void explicarMejor(section, 'paso_a_paso')} onStartActivity={() => void iniciarReto()}/>{retoLoading && <View className="items-center py-4"><ActivityIndicator color="#801529"/><Text className="text-xs text-gray-500 mt-2">Preparando la actividad...</Text></View>}</>}
      {reto && !resultadoReto && actividadActual && <View className="gap-4"><View className="flex-row items-center justify-between"><StatusBadge label={`RETO ${posicion + 1} / ${totalActividades}`} variant="brand"/><Text className="text-xs font-bold text-amber-700">⭐ Gana puntos al terminar</Text></View><BentoCard className="p-4 bg-indigo-50"><Text className="text-xs font-bold text-indigo-700">{actividadActual.tipo.replaceAll('_', ' ')}</Text></BentoCard>{actividadActual.question ? <EjemploCanvas etiqueta="Enunciado de práctica" ejemplos={[actividadActual.question]}/> : <BentoCard className="p-4 bg-indigo-50"><Text className="text-lg font-black text-gray-900">{activityPrompt(actividadActual)}</Text></BentoCard>}{renderReto(actividadActual)}<TouchableOpacity disabled={!puedeContinuar} onPress={() => void avanzarReto()} className="bg-maroon disabled:opacity-40 rounded-2xl p-4"><Text className="text-center text-white font-black">{posicion + 1 === totalActividades ? 'Terminar y ver mis puntos' : 'Continuar'}</Text></TouchableOpacity></View>}
      {resultadoReto && <View className="gap-3"><BentoCard className="p-6 items-center bg-amber-50"><Ionicons name="trophy" size={48} color="#D97706"/><Text className="text-2xl font-black text-gray-900 mt-3">Reto completado</Text><Text className="text-base text-gray-700 mt-2">{resultadoReto.correctas} de {resultadoReto.total} correctas</Text><Text className="text-3xl font-black text-maroon mt-2">+{resultadoReto.puntos} puntos</Text></BentoCard>{resultadoReto.answers.map((answer, index) => { const actividad = reto?.activities.find((item) => item.activity_id === answer.activity_id); const titulo = actividad?.question || activityPrompt(actividad || { activity_id: answer.activity_id, tipo: 'CUESTIONARIO' }); const feedback = answer.feedback; const duda = !answer.correct; return <BentoCard key={answer.activity_id} className={`p-4 ${duda ? 'bg-rose-50' : 'bg-emerald-50'}`}><Text className="text-xs font-bold">{duda ? 'A REFORZAR' : 'DOMINADO'} · {answer.tipo.replaceAll('_', ' ')}</Text><Text className="text-sm font-bold text-gray-900 mt-1">{index + 1}. {titulo}</Text>{feedback?.correct_answer ? <Text className="text-sm text-gray-800 mt-2">Respuesta: {feedback.correct_answer}</Text> : null}<Text className="text-sm text-gray-700 mt-2">{feedback?.explanation || feedback?.where_failed || answer.concept}</Text>{duda ? <TouchableOpacity disabled={Boolean(explicacionLoading)} onPress={() => void explicarMejor({ title: answer.concept || titulo, explanation: feedback?.explanation || answer.concept || titulo, example: feedback?.correct_answer }, 'paso_a_paso')} className="mt-3 self-start rounded-xl bg-white border border-rose-200 px-3 py-2"><Text className="text-xs font-bold text-rose-900">{explicacionLoading === `${answer.concept || titulo}-paso_a_paso` ? 'Explicando...' : 'Explicar esta duda'}</Text></TouchableOpacity> : null}{seccionExplicada === (answer.concept || titulo) && explicacion ? <View className="mt-3 gap-3 rounded-xl bg-white p-3"><Text className="font-bold text-gray-900">{explicacion.title}</Text><Text className="text-sm leading-6 text-gray-700">{explicacion.explanation}</Text><EjemploCanvas ejemplos={explicacion.examples || []}/></View> : null}</BentoCard>; })}<TouchableOpacity onPress={() => setTema(null)} className="bg-maroon rounded-xl px-6 py-3"><Text className="text-center text-white font-bold">Volver a temas</Text></TouchableOpacity></View>}
    </ScrollView>
  </View>;

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
  if (activity.tipo === 'FLASHCARD') return activity.front || 'Recuerda el concepto';
  if (activity.tipo === 'VERDADERO_FALSO') return activity.statement || '¿Es verdadero o falso?';
  if (activity.tipo === 'CONECTAR_FRASES') return 'Conecta cada concepto con su pareja';
  if (activity.tipo === 'DRAG_AND_DROP') return 'Ordena los pasos para resolver el ejercicio';
  return 'Responde la pregunta';
}
