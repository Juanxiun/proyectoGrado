import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExplicacionSeccion } from '../../../api/aprendizaje.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { MarkdownContent } from '../../../shared/ui/MarkdownContent';
import { EjemploCanvas } from './EjemploCanvas';

interface UnidadMicrolearning {
  title: string;
  explanation: string;
  objective: string;
  inquiry_question: string;
}

interface SigueAprendiendoProps {
  unidades: UnidadMicrolearning[];
  preguntas: string[];
  preguntaActiva: string | null;
  explicacion: ExplicacionSeccion | null;
  cargandoPregunta: string | null;
  onPregunta: (pregunta: string, unidad: UnidadMicrolearning) => void;
}

export function SigueAprendiendo({ unidades, preguntas, preguntaActiva, explicacion, cargandoPregunta, onPregunta }: SigueAprendiendoProps) {
  const explicacionActual = preguntaActiva && explicacion?.title === preguntaActiva ? explicacion : null;
  if (!preguntas.length) return null;

  return <View className="gap-3">
    <View>
      <Text className="text-sm font-black text-[#801F3F]">Sigue aprendiendo</Text>
      <Text className="mt-1 text-xs text-gray-600">Elige una pregunta y la IA te la explicará por partes.</Text>
    </View>
    {preguntas.map((pregunta, index) => {
      const unidad = unidades.find((item) => item.inquiry_question === pregunta) || unidades[index % Math.max(unidades.length, 1)] || {
        title: pregunta,
        explanation: pregunta,
        objective: pregunta,
        inquiry_question: pregunta,
      };
      const cargando = cargandoPregunta === `${pregunta}-preguntas`;
      const mostrar = preguntaActiva === pregunta && explicacionActual;
      return <View key={`${index}-${pregunta}`} className="gap-2">
        <TouchableOpacity disabled={Boolean(cargandoPregunta)} onPress={() => onPregunta(pregunta, unidad)}>
          <BentoCard className={`flex-row items-center gap-3 border p-4 ${preguntaActiva === pregunta ? 'border-[#801F3F] bg-[#FBF5EC]' : 'border-gray-200 bg-white'}`}>
            <Ionicons name={cargando ? 'hourglass-outline' : 'help-circle-outline'} size={22} color="#801F3F"/>
            <Text className="flex-1 text-sm font-semibold leading-5 text-gray-900">{pregunta}</Text>
            {cargando ? <ActivityIndicator size="small" color="#801F3F"/> : <Ionicons name="chevron-forward" size={18} color="#801F3F"/>}
          </BentoCard>
        </TouchableOpacity>
        {mostrar ? <BentoCard className="gap-3 border border-violet-200 bg-violet-50 p-4">
          <Text className="text-base font-black text-violet-950">{explicacionActual.title}</Text>
          <Text className="text-sm leading-6 text-violet-950">{explicacionActual.explanation}</Text>
          <MarkdownContent texto={explicacionActual.explanation} />
          {explicacionActual.microlearning_units?.length ? <View className="gap-2">
            <Text className="text-xs font-black uppercase text-violet-800">Explicación por partes</Text>
            {explicacionActual.microlearning_units.map((paso, pasoIndex) => <View key={`${pasoIndex}-${paso.title}`} className="rounded-xl bg-white p-3">
              <Text className="text-sm font-bold text-gray-900">{pasoIndex + 1}. {paso.title}</Text>
              <Text className="mt-1 text-sm leading-5 text-gray-700">{paso.explanation}</Text>
              <View className="mt-1">
                <MarkdownContent texto={paso.explanation} />
              </View>
              <Text className="mt-2 text-xs font-semibold text-violet-800">{paso.objective}</Text>
            </View>)}
          </View> : null}
          <EjemploCanvas ejemplos={explicacionActual.examples || []}/>
          {explicacionActual.inquiry_questions?.length ? <View className="rounded-xl bg-white p-3">
            <Text className="text-xs font-black text-violet-800">Preguntas para comprobar</Text>
            {explicacionActual.inquiry_questions.map((item, itemIndex) => <Text key={`${itemIndex}-${item}`} className="mt-2 text-sm text-gray-700">• {item}</Text>)}
          </View> : null}
        </BentoCard> : null}
      </View>;
    })}
  </View>;
}
