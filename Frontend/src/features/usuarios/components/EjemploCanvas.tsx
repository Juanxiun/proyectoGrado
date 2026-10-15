import React from 'react';
import { Text, View } from 'react-native';
import { BentoCard } from '../../../displays/components/BentoCard';

interface EjemploCanvasProps {
  ejemplos: string[];
  etiqueta?: string;
}

function separarPasos(texto: string): string[] {
  return texto
    .replace(/\s+(?=paso\s*\d+)/gi, '\n')
    .replace(/\s+(?=\d+[.)]\s+)/g, '\n')
    .replace(/\s+(?=(?:luego|despues|a continuacion)\b)/gi, '\n')
    .split(/\r?\n|;\s*|\s*(?:→|⇒|->)\s*/)
    .map((paso) => paso.replace(/^\s*(?:[-•]|paso\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter(Boolean);
}

function pareceFormula(texto: string): boolean {
  return /(?:=|\+|−|\-|×|÷|\*|\/|\^|√)/.test(texto) && /\d|[a-z]/i.test(texto);
}

export function EjemploCanvas({ ejemplos, etiqueta = 'Ejemplo guiado' }: EjemploCanvasProps) {
  const visibles = ejemplos.map((ejemplo) => ejemplo.trim()).filter(Boolean);
  if (!visibles.length) return null;

  return <View className="gap-3">
    {visibles.map((ejemplo, index) => {
      const pasos = separarPasos(ejemplo);
      return <BentoCard key={`${index}-${ejemplo}`} className="overflow-hidden border border-sky-200 bg-sky-50 p-4">
        <View className="mb-3 flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-sky-800"><Text className="text-xs font-black text-white">{index + 1}</Text></View>
          <Text className="text-xs font-black uppercase text-sky-900">{etiqueta}</Text>
        </View>
        <View className="gap-2 rounded-xl bg-white p-3">
          {pasos.map((paso, pasoIndex) => <View key={`${pasoIndex}-${paso}`} className="flex-row items-start gap-2 border-b border-sky-100 py-2 last:border-b-0">
            {pasos.length > 1 ? <Text className="w-6 text-xs font-bold text-sky-700">{pasoIndex + 1}.</Text> : null}
            <Text className={`flex-1 text-gray-900 ${pareceFormula(paso) ? 'text-center text-lg font-black' : 'text-sm leading-6'}`}>{paso}</Text>
          </View>)}
        </View>
      </BentoCard>;
    })}
  </View>;
}
