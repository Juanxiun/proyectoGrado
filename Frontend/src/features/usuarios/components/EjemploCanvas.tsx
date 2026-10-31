import React from 'react';
import { Text, View } from 'react-native';
import { BentoCard } from '../../../displays/components/BentoCard';
import { MarkdownContent } from '../../../shared/ui/MarkdownContent';

interface EjemploCanvasProps {
  ejemplos: unknown;
  etiqueta?: string;
}

// ejemplo -> separar pasos escritos en una sola linea
function separarPasos(texto: string): string[] {
  const limpio = texto.trim();
  if (!limpio) return [];

  // markdown -> conservar bloques y listas con formato propio
  if (limpio.includes('###') || limpio.includes('```') || (limpio.includes('- ') && limpio.split('\n').length > 3)) {
    return [limpio];
  }

  const pasos = limpio
    .replace(/\s+(?=paso\s*\d+[:.)]?)/gi, '\n')
    .replace(/\s+(?=\d+[.)]\s+)/g, '\n')
    .replace(/\s+(?=(?:luego|después|despues|a continuación|a continuacion)\b)/gi, '\n')
    .split(/\r?\n|;\s*|\s*(?:→|⇒|->)\s*/)
    .map((paso) => paso.replace(/^\s*(?:[-•]|paso\s*\d+[:.)]?|\d+[.)])\s*/i, '').trim())
    .filter(Boolean);

  return pasos.length ? pasos : [limpio];
}

function pareceFormula(texto: string): boolean {
  return /(?:=|\+|−|\-|×|÷|\*|\/|\^|√)/.test(texto) && /\d|[a-z]/i.test(texto);
}

export function EjemploCanvas({ ejemplos, etiqueta = 'Ejemplo guiado' }: EjemploCanvasProps) {
  const visibles = (Array.isArray(ejemplos) ? ejemplos : [ejemplos])
    .filter((ejemplo): ejemplo is string => typeof ejemplo === 'string')
    .map((ejemplo) => ejemplo.trim())
    .filter(Boolean);

  if (!visibles.length) return null;

  return (
    <View className="gap-3">
      {visibles.map((ejemplo, index) => {
        const pasos = separarPasos(ejemplo);
        return (
          <BentoCard key={`${index}-${ejemplo.slice(0, 30)}`} className="overflow-hidden border border-sky-200 bg-sky-50/80 p-4">
            <View className="mb-3 flex-row items-center gap-2">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-sky-800">
                <Text className="text-xs font-black text-white">{index + 1}</Text>
              </View>
              <Text className="text-xs font-black uppercase text-sky-900">{etiqueta}</Text>
            </View>
            {pasos.length === 1 ? (
              <View className="rounded-xl border border-sky-100 bg-white p-3.5">
                <MarkdownContent texto={pasos[0]} />
              </View>
            ) : (
              <View className="gap-2 rounded-xl border border-sky-100 bg-white p-3">
                {pasos.map((paso, pasoIndex) => (
                  <View key={`${pasoIndex}-${paso.slice(0, 20)}`} className="flex-row items-start gap-2.5 border-b border-sky-100 py-2.5 last:border-b-0">
                    <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-sky-100">
                      <Text className="text-[11px] font-bold text-sky-800">{pasoIndex + 1}</Text>
                    </View>
                    <View className="flex-1">
                      {pareceFormula(paso) ? <Text className="text-center text-lg font-black text-gray-900">{paso}</Text> : <MarkdownContent texto={paso} />}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </BentoCard>
        );
      })}
    </View>
  );
}
