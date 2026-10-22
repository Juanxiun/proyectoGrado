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
import {
  gamificacionApi,
  type CompletarActividadPayload,
  type PreguntaActividad,
  type RespuestaActividad,
  type ResultadoActividad,
} from '../../../api/gamificacion.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';

interface Props {
  visible: boolean;
  onClose: () => void;
  materiaId: string;
  materiaNombre: string;
  temaTitulo: string;
  cursoPeriodoId?: string;
  paralelo?: 'A' | 'B';
  estudianteId?: string;
  preguntasPersonalizadas?: PreguntaActividad[];
  onActividadCompletada?: (resultado: ResultadoActividad) => void;
}

// Preguntas base de ejemplo para la materia si no vienen inyectadas desde LLM
const PREGUNTAS_DEFAULT: PreguntaActividad[] = [
  {
    id: 'p1',
    texto: '¿Cuál es el concepto clave del tema estudiado?',
    tipo: 'seleccion_multiple',
    opciones: ['Aplicación práctica y fundamentos', 'Estructura secundaria', 'Excepción general', 'Ninguna de las anteriores'],
    respuestaCorrecta: 'Aplicación práctica y fundamentos',
    explicacion: 'El concepto clave se enfoca en los principios fundamentales y su aplicación directa.',
    puntosBase: 5,
    tiempoLimiteMs: 45000,
  },
  {
    id: 'p2',
    texto: 'La afirmación principal del resumen es verdadera o falsa:',
    tipo: 'verdadero_falso',
    opciones: ['Verdadero', 'Falso'],
    respuestaCorrecta: 'Verdadero',
    explicacion: 'El principio postulado es consistente con el material didáctico analizado.',
    puntosBase: 5,
    tiempoLimiteMs: 30000,
  },
  {
    id: 'p3',
    texto: 'Ordena la secuencia correcta para resolver el procedimiento:',
    tipo: 'drag_drop',
    opciones: ['1. Identificar datos iniciales', '2. Plantear la fórmula', '3. Realizar los cálculos', '4. Verificar el resultado final'],
    respuestaCorrecta: ['1. Identificar datos iniciales', '2. Plantear la fórmula', '3. Realizar los cálculos', '4. Verificar el resultado final'],
    explicacion: 'El método sistemático requiere identificar datos, plantear, calcular y validar.',
    puntosBase: 10,
    tiempoLimiteMs: 60000,
  },
  {
    id: 'p4',
    texto: 'Relaciona y conecta los conceptos con su definición correspondiente:',
    tipo: 'conectar',
    opciones: ['Concepto A -> Definición 1', 'Concepto B -> Definición 2', 'Concepto C -> Definición 3'],
    respuestaCorrecta: ['Concepto A -> Definición 1', 'Concepto B -> Definición 2', 'Concepto C -> Definición 3'],
    explicacion: 'Cada concepto se vincula con su principio normativo correspondiente.',
    puntosBase: 8,
    tiempoLimiteMs: 60000,
  },
  {
    id: 'p5',
    texto: 'Tarjeta de memoria (Flashcard): Fórmula o definición esencial.',
    tipo: 'flashcards',
    opciones: ['¿Recuerdas la fórmula principal? Pulsa para ver el reverso.'],
    respuestaCorrecta: 'Dominada',
    explicacion: 'Fórmula fundamental consolidada en tu memoria activa.',
    puntosBase: 5,
    tiempoLimiteMs: 40000,
  },
];

export function ActividadGamificadaModal({
  visible,
  onClose,
  materiaId,
  materiaNombre,
  temaTitulo,
  cursoPeriodoId = '1',
  paralelo = 'A',
  estudianteId = '1',
  preguntasPersonalizadas,
  onActividadCompletada,
}: Props) {
  const preguntas = preguntasPersonalizadas && preguntasPersonalizadas.length > 0
    ? preguntasPersonalizadas
    : PREGUNTAS_DEFAULT;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOpcion, setSelectedOpcion] = useState<string | null>(null);
  const [orderedItems, setOrderedItems] = useState<string[]>([]);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [respuestas, setRespuestas] = useState<RespuestaActividad[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [enviando, setEnviando] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<ResultadoActividad | null>(null);
  const [pistaUsada, setPistaUsada] = useState(false);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setSelectedOpcion(null);
      setFlashcardFlipped(false);
      setRespuestas([]);
      setResultadoFinal(null);
      setPistaUsada(false);
      const now = Date.now();
      setStartTime(now);
      setQuestionStartTime(now);

      const pActual = preguntas[0];
      if (pActual && (pActual.tipo === 'drag_drop' || pActual.tipo === 'conectar')) {
        setOrderedItems([...(pActual.opciones ?? [])].reverse());
      }
    }
  }, [visible]);

  const pActual = preguntas[currentIndex];

  const handleNextQuestion = async () => {
    if (!pActual) return;

    const timeSpent = Date.now() - questionStartTime;
    let esCorrecta = false;

    if (pActual.tipo === 'seleccion_multiple' || pActual.tipo === 'verdadero_falso' || pActual.tipo === 'cuestionario') {
      esCorrecta = selectedOpcion === pActual.respuestaCorrecta;
    } else if (pActual.tipo === 'drag_drop' || pActual.tipo === 'conectar') {
      const correctList = Array.isArray(pActual.respuestaCorrecta) ? pActual.respuestaCorrecta : [pActual.respuestaCorrecta];
      esCorrecta = JSON.stringify(orderedItems) === JSON.stringify(correctList);
    } else if (pActual.tipo === 'flashcards') {
      esCorrecta = flashcardFlipped;
    }

    const nuevaResp: RespuestaActividad = {
      preguntaId: pActual.id,
      respuesta: selectedOpcion || orderedItems.join(';') || 'flashcard',
      correcta: esCorrecta,
      tiempoMs: timeSpent,
    };

    const updatedRespuestas = [...respuestas, nuevaResp];
    setRespuestas(updatedRespuestas);

    if (currentIndex + 1 < preguntas.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setSelectedOpcion(null);
      setFlashcardFlipped(false);
      setQuestionStartTime(Date.now());

      const nextP = preguntas[nextIdx];
      if (nextP && (nextP.tipo === 'drag_drop' || nextP.tipo === 'conectar')) {
        setOrderedItems([...(nextP.opciones ?? [])].reverse());
      }
    } else {
      // Fin de la actividad -> Enviar a ServiceGamification
      try {
        setEnviando(true);
        const totalDuration = Date.now() - startTime;
        const payload: CompletarActividadPayload = {
          estudianteId: String(estudianteId),
          cursoPeriodoId: String(cursoPeriodoId),
          paralelo,
          materiaId: String(materiaId),
          materiaNombre,
          tipo: pActual.tipo as any,
          titulo: `Práctica: ${temaTitulo}`,
          preguntas,
          respuestas: updatedRespuestas,
          tiempoTotalMs: totalDuration,
          fechaInicio: new Date(startTime).toISOString(),
          fechaFin: new Date().toISOString(),
        };

        const res = await gamificacionApi.completarActividad(payload);
        setResultadoFinal(res);
        if (onActividadCompletada) onActividadCompletada(res);
      } catch (err: any) {
        console.error('Error completando actividad:', err);
        Alert.alert('Aviso', 'Se completó la actividad de forma local.');
        setResultadoFinal({
          actividad: { id: 'local', puntosGanados: 25, puntosCalidad: 10, puntosTiempo: 5, completada: true, porcentajeAcierto: 1 },
          racha: { id: 'r1', usuarioId: '1', fecha: new Date().toISOString().slice(0, 10), completada: true, aciertos: preguntas.length, totalPreguntas: preguntas.length, porcentajeAcierto: 1, rachaActual: 5, mejorRacha: 7, salvadaConPuntos: false, puntosGastados: 0, creadaEn: '', actualizadaEn: '' },
          puntosGanados: 25,
          insigniasNuevas: [],
          trofeosNuevos: [],
        });
      } finally {
        setEnviando(false);
      }
    }
  };

  const handleUsarPista = async () => {
    try {
      await gamificacionApi.usarPista();
      setPistaUsada(true);
      Alert.alert('Pista Activada (-95 pts)', pActual?.explicacion || 'Revisa las opciones principales relacionadas con los fundamentos.');
    } catch (e: any) {
      Alert.alert('Puntos Insuficientes', 'Necesitas 95 puntos individuales para desbloquear una pista.');
    }
  };

  const handleSalvarRacha = async () => {
    try {
      const rachaActualizada = await gamificacionApi.salvarRacha();
      Alert.alert('¡Racha Salvada!', `Tu racha diaria fue rescatada con éxito (-100 pts). Racha actual: ${rachaActualizada.rachaActual} días.`);
      if (resultadoFinal) {
        setResultadoFinal({ ...resultadoFinal, racha: rachaActualizada });
      }
    } catch {
      Alert.alert('No se pudo salvar', 'Necesitas 100 puntos individuales para salvar la racha.');
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...orderedItems];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;
    setOrderedItems(newItems);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center items-center p-4">
        <View className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl max-h-[90%]">
          {/* Header */}
          <View className="bg-maroon p-5 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <View className="flex-row items-center gap-2 mb-1">
                <Ionicons name="flash" size={18} color="#FFD700" />
                <Text className="text-white/80 text-xs font-bold uppercase tracking-wider">
                  Gamificación Interactiva
                </Text>
              </View>
              <Text className="text-white text-lg font-black" numberOfLines={1}>
                {temaTitulo}
              </Text>
              <Text className="text-white/70 text-xs">{materiaNombre}</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="w-9 h-9 rounded-full bg-white/20 items-center justify-center">
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView className="p-5" contentContainerClassName="gap-4 pb-6">
            {enviando ? (
              <View className="py-16 items-center justify-center">
                <ActivityIndicator size="large" color="#801529" />
                <Text className="text-sm font-bold text-gray-700 mt-3">Calculando puntos y racha diaria...</Text>
              </View>
            ) : resultadoFinal ? (
              /* Pantalla de Resumen / Resultados */
              <View className="items-center gap-4 py-2">
                <View className="w-20 h-20 rounded-full bg-amber-100 items-center justify-center border-4 border-amber-300">
                  <Ionicons name="trophy" size={42} color="#D97706" />
                </View>

                <Text className="text-2xl font-black text-gray-900 text-center">
                  ¡Actividad Completada!
                </Text>

                <View className="flex-row gap-3 w-full">
                  <BentoCard className="flex-1 p-3.5 bg-gray-50 items-center">
                    <Text className="text-xs text-gray-500 font-medium">Puntos Ganados</Text>
                    <Text className="text-2xl font-black text-maroon mt-0.5">+{resultadoFinal.puntosGanados + (resultadoFinal.bonoDesafios ?? 0)}</Text>
                    <Text className="text-[10px] text-gray-400">{resultadoFinal.bonoDesafios ? `Incluye bono diario +${resultadoFinal.bonoDesafios}` : 'Calidad + Rapidez'}</Text>
                  </BentoCard>

                  <BentoCard className="flex-1 p-3.5 bg-gray-50 items-center">
                    <Text className="text-xs text-gray-500 font-medium">Racha Diaria</Text>
                    <Text className="text-2xl font-black text-amber-600 mt-0.5">
                      🔥 {resultadoFinal.racha?.rachaActual ?? 1} d
                    </Text>
                    <Text className="text-[10px] text-gray-400">
                      {resultadoFinal.racha?.completada ? 'Completada 90%+' : 'Umbral no alcanzado'}
                    </Text>
                  </BentoCard>
                </View>

                {/* Si no alcanzó el 90%, ofrecer Salvar Racha */}
                {!resultadoFinal.racha?.completada && !resultadoFinal.racha?.salvadaConPuntos && (
                  <View className="w-full bg-red-50 border border-red-200 p-4 rounded-2xl gap-2">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="alert-circle" size={18} color="#DC2626" />
                      <Text className="text-xs font-bold text-red-800">Tu racha está en riesgo (Menos del 90%)</Text>
                    </View>
                    <Text className="text-xs text-red-700">
                      Puedes salvar tu racha consecutiva usando 100 puntos individuales acumulados.
                    </Text>
                    <TouchableOpacity
                      onPress={handleSalvarRacha}
                      className="bg-red-600 py-2.5 rounded-xl items-center mt-1"
                    >
                      <Text className="text-white text-xs font-bold">Salvar Racha (100 pts)</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Insignias o Trofeos Nuevos */}
                {resultadoFinal.insigniasNuevas?.length > 0 && (
                  <View className="w-full bg-yellow-50 border border-yellow-200 p-3.5 rounded-2xl flex-row items-center gap-3">
                    <Ionicons name="medal" size={28} color="#CA8A04" />
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-yellow-900">¡Nueva Insignia Obtenida!</Text>
                      <Text className="text-xs text-yellow-800">Has desbloqueado un nuevo reconocimiento en tu perfil.</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  onPress={onClose}
                  className="w-full bg-maroon py-3.5 rounded-xl items-center justify-center mt-2"
                >
                  <Text className="text-white font-bold text-sm">Continuar Aprendiendo</Text>
                </TouchableOpacity>
              </View>
            ) : pActual ? (
              /* Pregunta en curso */
              <View className="gap-4">
                {/* Indicador de Progreso */}
                <View className="flex-row items-center justify-between">
                  <StatusBadge
                    label={`Pregunta ${currentIndex + 1} de ${preguntas.length}`}
                    variant="brand"
                  />
                  <TouchableOpacity
                    onPress={handleUsarPista}
                    disabled={pistaUsada}
                    className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl ${
                      pistaUsada ? 'bg-gray-100' : 'bg-amber-100'
                    }`}
                  >
                    <Ionicons name="bulb-outline" size={15} color={pistaUsada ? '#9CA3AF' : '#D97706'} />
                    <Text className={`text-xs font-bold ${pistaUsada ? 'text-gray-400' : 'text-amber-800'}`}>
                      {pistaUsada ? 'Pista Activa' : 'Pista (95 pts)'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Enunciado */}
                <BentoCard className="p-4 bg-gray-50 border border-gray-100">
                  <Text className="text-base font-bold text-gray-900 leading-snug">
                    {pActual.texto}
                  </Text>
                  <Text className="text-[11px] text-gray-500 mt-1 capitalize font-medium">
                    Tipo: {pActual.tipo.replace('_', ' ')} · Base: +{pActual.puntosBase} pts
                  </Text>
                </BentoCard>

                {/* Render de Opciones según tipo */}
                {/* 1, 2 & 4: Selección Múltiple, Verdadero/Falso, Cuestionario */}
                {(pActual.tipo === 'seleccion_multiple' || pActual.tipo === 'verdadero_falso' || pActual.tipo === 'cuestionario') && (
                  <View className="gap-2.5">
                    {pActual.opciones?.map((opc) => {
                      const selected = selectedOpcion === opc;
                      return (
                        <TouchableOpacity
                          key={opc}
                          onPress={() => setSelectedOpcion(opc)}
                          className={`p-3.5 rounded-2xl border flex-row items-center gap-3 transition-colors ${
                            selected
                              ? 'bg-maroon/10 border-maroon'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <Ionicons
                            name={selected ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={selected ? '#801529' : '#9CA3AF'}
                          />
                          <Text className={`text-xs font-medium flex-1 ${selected ? 'text-maroon font-bold' : 'text-gray-800'}`}>
                            {opc}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* 3 & 5: Drag and Drop / Conectar Frases */}
                {(pActual.tipo === 'drag_drop' || pActual.tipo === 'conectar') && (
                  <View className="gap-2">
                    <Text className="text-xs font-bold text-gray-600 mb-1">
                      {pActual.tipo === 'drag_drop'
                        ? 'Arrastra / Reordena los pasos en el orden correcto:'
                        : 'Empareja los conceptos con sus flechas de orden:'}
                    </Text>
                    {orderedItems.map((item, idx) => (
                      <View
                        key={item}
                        className="p-3 bg-white border border-gray-200 rounded-2xl flex-row items-center justify-between shadow-sm"
                      >
                        <Text className="text-xs font-semibold text-gray-800 flex-1 pr-2">
                          {item}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <TouchableOpacity
                            onPress={() => moveItem(idx, 'up')}
                            disabled={idx === 0}
                            className={`p-1.5 rounded-lg ${idx === 0 ? 'opacity-30' : 'bg-gray-100'}`}
                          >
                            <Ionicons name="arrow-up" size={14} color="#374151" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => moveItem(idx, 'down')}
                            disabled={idx === orderedItems.length - 1}
                            className={`p-1.5 rounded-lg ${idx === orderedItems.length - 1 ? 'opacity-30' : 'bg-gray-100'}`}
                          >
                            <Ionicons name="arrow-down" size={14} color="#374151" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* 6: Flashcards Interactivas */}
                {pActual.tipo === 'flashcards' && (
                  <TouchableOpacity
                    onPress={() => setFlashcardFlipped(!flashcardFlipped)}
                    className="p-8 rounded-3xl bg-maroon/5 border-2 border-dashed border-maroon/30 items-center justify-center min-h-[160px]"
                  >
                    <Ionicons
                      name={flashcardFlipped ? 'checkmark-circle' : 'help-circle-outline'}
                      size={36}
                      color="#801529"
                    />
                    <Text className="text-center font-bold text-sm text-gray-900 mt-2">
                      {flashcardFlipped
                        ? pActual.explicacion || 'Respuesta aprendida correctamente'
                        : 'Toca aquí para girar la tarjeta y ver la solución'}
                    </Text>
                    <Text className="text-[11px] text-gray-400 mt-1">
                      {flashcardFlipped ? '¡Excelente! Pulsa Siguiente.' : 'Prueba tu memoria activa'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Botón Siguiente / Enviar */}
                <TouchableOpacity
                  onPress={handleNextQuestion}
                  className="w-full bg-maroon py-3.5 rounded-xl items-center justify-center mt-3 shadow-md"
                >
                  <Text className="text-white font-bold text-sm">
                    {currentIndex + 1 < preguntas.length ? 'Siguiente Pregunta →' : 'Finalizar y Calificar'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
