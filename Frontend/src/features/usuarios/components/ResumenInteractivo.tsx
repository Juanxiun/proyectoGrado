import React, { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import type { FormatoResumen } from '../../../api/aprendizaje.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { MarkdownContent } from '../../../shared/ui/MarkdownContent';
import { EjemploCanvas } from './EjemploCanvas';
import { EsquemaSkia } from './EsquemaSkia';

interface ResumenInteractivoProps {
  formato: FormatoResumen;
  data: Record<string, any> | string | null;
  explicacion?: { title: string; explanation: string; examples?: string[] } | null;
  explicacionLoading?: boolean;
  onExplain: (section: { title: string; explanation: string }) => void;
  onStartActivity: () => void;
  onCompleteStudy?: (formato: FormatoResumen, progreso?: { cartaActual: number; totalCartas: number; completo: boolean }) => void;
  onAlternateSummary?: (formato: FormatoResumen) => void;
}

// resumen -> texto seguro para <Text>
function aTexto(valor: unknown, respaldo = ''): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return respaldo;
}

// resumen -> lista de textos segura
function aTextos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor.map((item) => aTexto(item, '')).filter((item) => item.trim().length > 0);
}

// resumen -> normalizar la carga util recibida del backend
function normalizarData(valor: ResumenInteractivoProps['data']): Record<string, any> {
  if (!valor) return {};
  if (typeof valor === 'string') {
    try {
      const parseado = JSON.parse(valor);
      return parseado && typeof parseado === 'object' ? (parseado as Record<string, any>) : {};
    } catch {
      return {};
    }
  }
  return typeof valor === 'object' ? valor : {};
}

interface CartaResumen {
  concept: string;
  definition: string;
  key_points: string[];
}

// resumen -> tarjetas a partir de nodos del esquema
function cartasDesdeNodos(data: Record<string, any>): CartaResumen[] {
  const nodos = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  return nodos.reduce<CartaResumen[]>((acc, nodo) => {
    if (!nodo || typeof nodo !== 'object') return acc;
    const concept = aTexto(nodo.label ?? nodo.title ?? nodo.concept, '').trim();
    if (!concept) return acc;
    const key_points = edges
      .filter((edge: any) => edge && (edge.source === nodo.id || edge.target === nodo.id))
      .map((edge: any) => aTexto(edge.label, ''))
      .filter(Boolean)
      .slice(0, 3);
    acc.push({
      concept,
      definition: aTexto(nodo.detail ?? nodo.definition, concept),
      key_points,
    });
    return acc;
  }, []);
}

export function ResumenInteractivo({ formato, data: dataEntrada, explicacion, explicacionLoading, onExplain, onStartActivity, onCompleteStudy, onAlternateSummary }: ResumenInteractivoProps) {
  const [indiceCarta, setIndiceCarta] = useState(0);
  const [cartasFinalizadas, setCartasFinalizadas] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [estudioCompletado, setEstudioCompletado] = useState(false);
  const [aprendio, setAprendio] = useState(false);
  const data = normalizarData(dataEntrada);
  const nodos = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const temasRelacionados = aTextos(data.related_topics ?? data.relatedTopics);
  const cartas: CartaResumen[] = Array.isArray(data.cards) && data.cards.length
    ? data.cards.reduce<CartaResumen[]>((acc, carta) => {
      if (!carta || typeof carta !== 'object') return acc;
      const concept = aTexto(carta.concept ?? carta.title, '').trim();
      if (!concept) return acc;
      acc.push({
        concept,
        definition: aTexto(carta.definition ?? carta.detail, concept),
        key_points: aTextos(carta.key_points),
      });
      return acc;
    }, [])
    : cartasDesdeNodos(data);

  const renderCartas = () => {
    const carta = cartas[indiceCarta];
    if (cartasFinalizadas || !carta) return null;
    const explicacionCarta = explicacion?.title === carta.concept ? explicacion : null;
    return <View className="gap-3">
      <Text className="text-xs font-bold text-amber-800">MICROLEARNING · CARTA {indiceCarta + 1} DE {cartas.length}</Text>
      <BentoCard className="min-h-52 justify-center p-6 bg-amber-50">
        <Text className="text-xs font-bold text-amber-700">¿QUÉ ES?</Text>
        <Text className="text-xl font-black text-gray-900 mt-2">{carta.concept}</Text>
        <Text className="text-sm leading-6 text-gray-700 mt-4">{carta.definition}</Text>
        <View className="mt-3">
          <MarkdownContent texto={carta.definition} />
        </View>
        {carta.key_points.map((point, index) => <Text key={`${index}-${point}`} className="text-sm text-gray-600 mt-2">• {point}</Text>)}
      </BentoCard>
      <View className="flex-row gap-2">
        <TouchableOpacity disabled={Boolean(explicacionLoading)} onPress={() => onExplain({ title: carta.concept, explanation: carta.definition })} className="flex-1 rounded-xl border border-violet-200 bg-violet-50 p-3">
          <Text className="text-center text-xs font-bold text-violet-900">{explicacionLoading ? 'Generando explicación...' : 'Explica mejor'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          if (indiceCarta + 1 === cartas.length) {
            setCartasFinalizadas(true);
            if (!estudioCompletado) onCompleteStudy?.(formato, { cartaActual: cartas.length, totalCartas: cartas.length, completo: true });
            setEstudioCompletado(true);
            setFeedbackVisible(true);
          } else {
            onCompleteStudy?.(formato, { cartaActual: indiceCarta + 1, totalCartas: cartas.length, completo: false });
            setIndiceCarta((previous) => previous + 1);
          }
        }} className="flex-1 rounded-xl bg-[#801F3F] p-3">
          <Text className="text-center text-xs font-bold text-white">{indiceCarta + 1 === cartas.length ? 'Terminar' : 'Siguiente'}</Text>
        </TouchableOpacity>
      </View>
      {explicacionCarta ? (
        <BentoCard className="gap-3 p-4 bg-violet-50">
          <Text className="font-bold text-violet-950">{aTexto(explicacionCarta.title, carta.concept)}</Text>
          <Text className="text-sm leading-6 text-violet-900">{aTexto(explicacionCarta.explanation, carta.definition)}</Text>
          <View>
            <MarkdownContent texto={aTexto(explicacionCarta.explanation, carta.definition)} />
          </View>
          <EjemploCanvas ejemplos={aTextos(explicacionCarta.examples)} />
        </BentoCard>
      ) : null}
    </View>;
  };

  const recommendation = aTexto(data.recommendation, '¿Qué concepto del tema te gustaría investigar y explicar con tus propias palabras?');
  return (
    <View className="gap-4">
      {formato === 'CARTAS_EXPLICATIVAS' && cartas.length ? renderCartas() : formato === 'CARTAS_EXPLICATIVAS' ? (
        <BentoCard className="p-4 bg-amber-50"><Text className="font-bold text-amber-900">No hay tarjetas disponibles</Text><Text className="text-sm text-amber-800 mt-1">Vuelve a generar el resumen para cargar los conceptos del material.</Text></BentoCard>
      ) : (
        <View className="gap-3"><EsquemaSkia
          nodes={nodos as never}
          edges={edges as never}
          relatedTopics={temasRelacionados}
          title={aTexto(data.title, 'Esquema del tema')}
          onNodePress={(node) => onExplain({ title: aTexto(node.label), explanation: aTexto(node.detail, aTexto(node.label)) })}
        /><TouchableOpacity onPress={() => { if (!estudioCompletado) onCompleteStudy?.(formato); setEstudioCompletado(true); setFeedbackVisible(true); }} className="rounded-xl bg-[#801F3F] p-3"><Text className="text-center text-xs font-bold text-white">Terminé de estudiar el mapa mental</Text></TouchableOpacity></View>
      )}
      {aprendio ? (
        <>
          <BentoCard className="p-4 bg-amber-50">
            <Text className="text-xs font-bold text-amber-800">SIGUE INVESTIGANDO</Text>
            <Text className="text-sm text-gray-800 mt-1">{recommendation}</Text>
          </BentoCard>
          <TouchableOpacity onPress={onStartActivity} className="rounded-2xl bg-[#801F3F] p-4">
            <Text className="text-center font-black text-white">Empezar actividad</Text>
          </TouchableOpacity>
        </>
      ) : null}
      <Modal visible={feedbackVisible} transparent animationType="fade" onRequestClose={() => setFeedbackVisible(false)}>
        <View className="flex-1 bg-black/60 justify-center p-5"><View className="rounded-3xl bg-white p-5 gap-3">
          <Text className="text-lg font-black text-gray-900 text-center">¿Aprendí más con esto?</Text>
          <TouchableOpacity onPress={() => { setFeedbackVisible(false); onAlternateSummary?.(formato === 'CARTAS_EXPLICATIVAS' ? 'ESQUEMA_GEMMA' : 'CARTAS_EXPLICATIVAS'); }} className="rounded-xl bg-amber-100 p-3"><Text className="text-center font-bold text-amber-900">Aún me quedan dudas</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setFeedbackVisible(false); setAprendio(true); }} className="rounded-xl bg-[#801F3F] p-3"><Text className="text-center font-bold text-white">Aprendí</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
}
