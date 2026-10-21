import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { FormatoResumen } from '../../../api/aprendizaje.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { EjemploCanvas } from './EjemploCanvas';
import { EsquemaSkia } from './EsquemaSkia';

interface ResumenInteractivoProps {
  formato: FormatoResumen;
  data: Record<string, any>;
  explicacion?: { title: string; explanation: string; examples?: string[] } | null;
  explicacionLoading?: boolean;
  onExplain: (section: { title: string; explanation: string }) => void;
  onStartActivity: () => void;
}

export function ResumenInteractivo({ formato, data, explicacion, explicacionLoading, onExplain, onStartActivity }: ResumenInteractivoProps) {
  const [indiceCarta, setIndiceCarta] = useState(0);
  const [cartasFinalizadas, setCartasFinalizadas] = useState(false);
  const cartas = data.cards?.length ? data.cards : (data.nodes || []).map((node: any) => ({
    concept: node.label,
    definition: node.detail,
    key_points: (data.edges || []).filter((edge: any) => edge.source === node.id || edge.target === node.id).slice(0, 3).map((edge: any) => edge.label),
  }));

  const renderCartas = () => {
    const carta = cartas[indiceCarta];
    if (cartasFinalizadas) return null;
    if (!carta) return null;
    const key = `carta-${indiceCarta}`;
    const explicacionCarta = explicacion?.title === carta.concept ? explicacion : null;
    return <View className="gap-3">
      <Text className="text-xs font-bold text-amber-800">CARTA {indiceCarta + 1} DE {cartas.length}</Text>
      <BentoCard className="min-h-52 justify-center p-6 bg-amber-50">
        <Text className="text-xs font-bold text-amber-700">CONCEPTO</Text>
        <Text className="text-xl font-black text-gray-900 mt-2">{carta.concept}</Text>
        <Text className="text-sm leading-6 text-gray-700 mt-4">{carta.definition}</Text>
        {carta.key_points?.map((point: string, index: number) => <Text key={`${index}-${point}`} className="text-sm text-gray-600 mt-2">• {point}</Text>)}
      </BentoCard>
      <View className="flex-row gap-2">
        <TouchableOpacity disabled={Boolean(explicacionLoading)} onPress={() => onExplain({ title: carta.concept, explanation: carta.definition })} className="flex-1 rounded-xl border border-violet-200 bg-violet-50 p-3">
          <Text className="text-center text-xs font-bold text-violet-900">{explicacionLoading && key ? 'Generando explicación...' : 'Explicación más lenta'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => indiceCarta + 1 === cartas.length ? setCartasFinalizadas(true) : setIndiceCarta((previous) => previous + 1)} className="flex-1 rounded-xl bg-[#801F3F] p-3">
          <Text className="text-center text-xs font-bold text-white">{indiceCarta + 1 === cartas.length ? 'Aprendí · Terminar' : 'Aprendí · Siguiente'}</Text>
        </TouchableOpacity>
      </View>
      {explicacionCarta ? <BentoCard className="gap-3 p-4 bg-violet-50"><Text className="font-bold text-violet-950">{explicacionCarta.title}</Text><Text className="text-sm leading-6 text-violet-900">{explicacionCarta.explanation}</Text><EjemploCanvas ejemplos={explicacionCarta.examples || []}/></BentoCard> : null}
    </View>;
  };

  const renderEsquema = () => (
    <EsquemaSkia
      nodes={data.nodes || []}
      edges={data.edges || []}
      relatedTopics={data.related_topics || data.relatedTopics || []}
      title={data.title || 'Esquema del tema'}
      onNodePress={(node) => onExplain({ title: node.label, explanation: node.detail || node.label })}
    />
  );

  const recommendation = data.recommendation || '¿Qué concepto del tema te gustaría investigar y explicar con tus propias palabras?';
  return (
    <View className="gap-4">
      {formato === 'CARTAS_EXPLICATIVAS' && cartas.length ? renderCartas() : formato === 'CARTAS_EXPLICATIVAS' ? (
        <BentoCard className="p-4 bg-amber-50"><Text className="font-bold text-amber-900">No hay tarjetas disponibles</Text><Text className="text-sm text-amber-800 mt-1">Vuelve a generar el resumen para cargar los conceptos del material.</Text></BentoCard>
      ) : (
        <EsquemaSkia
          nodes={data.nodes || []}
          edges={data.edges || []}
          relatedTopics={data.related_topics || data.relatedTopics || []}
          title={data.title || 'Esquema del tema'}
          onNodePress={(node) => onExplain({ title: node.label, explanation: node.detail || node.label })}
        />
      )}
      {(formato !== 'CARTAS_EXPLICATIVAS' || cartasFinalizadas) ? (
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
    </View>
  );
}
