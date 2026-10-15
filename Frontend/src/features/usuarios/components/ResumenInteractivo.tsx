import React, { useState } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { FormatoResumen } from '../../../api/aprendizaje.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { EjemploCanvas } from './EjemploCanvas';

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
  const [nodoActivo, setNodoActivo] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const cartas = data.cards || [];
  const conexiones = (data.connections || []).slice(0, 3);
  const ancho = Math.max(300, width - 56);
  const centro = ancho / 2;
  const coordenadas: Array<{ x: number; y: number }> = conexiones.map((_: unknown, index: number) => ({ x: (ancho * (index + 0.5)) / conexiones.length, y: 225 }));

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

  const renderConexiones = () => {
    const activo = conexiones.find((item: any) => item.id === nodoActivo);
    return <View className="gap-3">
      <Text className="text-sm text-gray-700">{data.summary}</Text>
      <View style={{ width: ancho, height: 310 }}>
        <Svg width={ancho} height={280} style={{ position: 'absolute', left: 0, top: 0 }}>
          {coordenadas.map((punto, index) => <Line key={`linea-${index}`} x1={centro} y1={75} x2={punto.x} y2={punto.y} stroke="#9CA3AF" strokeWidth={2} />)}
          {coordenadas.map((punto, index) => <Circle key={`nodo-${index}`} cx={punto.x} cy={punto.y} r={5} fill="#801F3F" />)}
        </Svg>
        <View style={{ position: 'absolute', left: centro - 95, top: 24, width: 190 }}>
          <BentoCard className="items-center p-3 bg-[#F7E9ED]"><Text className="text-center text-xs font-black text-[#801F3F]">{data.central_concept || data.title}</Text></BentoCard>
        </View>
        {conexiones.map((item: any, index: number) => <TouchableOpacity key={item.id || index} onPress={() => setNodoActivo(item.id)} style={{ position: 'absolute', left: coordenadas[index].x - 54, top: 174, width: 108 }}>
          <BentoCard className={`min-h-16 items-center justify-center p-2 ${nodoActivo === item.id ? 'bg-sky-100' : 'bg-sky-50'}`}><Text className="text-center text-xs font-bold text-sky-900">{item.concept}</Text></BentoCard>
        </TouchableOpacity>)}
      </View>
      {activo ? <BentoCard className="p-4 bg-sky-50"><Text className="font-bold text-sky-950">{activo.concept} · {activo.relation}</Text><Text className="text-sm text-gray-700 mt-2">{activo.context}</Text></BentoCard> : null}
    </View>;
  };

  const renderEsquema = () => {
    const nodo = (data.nodes || []).find((item: any) => item.id === nodoActivo);
    const relaciones = (data.edges || []).filter((edge: any) => edge.source === nodoActivo);
    return <View className="gap-2">
      <BentoCard className="items-center p-3 bg-[#F7E9ED]"><Text className="text-center font-black text-[#801F3F]">{data.title}</Text></BentoCard>
      {(data.nodes || []).map((item: any) => <TouchableOpacity key={item.id} onPress={() => setNodoActivo(item.id)}>
        <BentoCard className={`p-3 ${item.id === nodoActivo ? 'bg-violet-100' : 'bg-violet-50'}`}><Text className="text-[10px] font-bold uppercase text-violet-800">{item.kind}</Text><Text className="font-semibold text-gray-900 mt-1">{item.label}</Text></BentoCard>
      </TouchableOpacity>)}
      {nodo ? <BentoCard className="p-4 bg-white"><Text className="font-bold text-gray-900">{nodo.label}</Text><Text className="text-sm text-gray-700 mt-2">{nodo.detail}</Text>{relaciones.map((edge: any, index: number) => <Text key={`${edge.source}-${edge.target}-${index}`} className="text-sm text-gray-700 mt-2">{edge.label}: {(data.nodes || []).find((target: any) => target.id === edge.target)?.label}</Text>)}</BentoCard> : null}
    </View>;
  };

  const recommendation = data.recommendation || '¿Qué concepto del tema te gustaría investigar y explicar con tus propias palabras?';
  return <View className="gap-4">
    {formato === 'CARTAS_EXPLICATIVAS' ? renderCartas() : formato === 'CONEXIONES' ? renderConexiones() : renderEsquema()}
    {(formato !== 'CARTAS_EXPLICATIVAS' || cartasFinalizadas) ? <><BentoCard className="p-4 bg-amber-50"><Text className="text-xs font-bold text-amber-800">SIGUE INVESTIGANDO</Text><Text className="text-sm text-gray-800 mt-1">{recommendation}</Text></BentoCard>
      <TouchableOpacity onPress={onStartActivity} className="rounded-2xl bg-[#801F3F] p-4"><Text className="text-center font-black text-white">Empezar actividad</Text></TouchableOpacity></> : null}
  </View>;
}
