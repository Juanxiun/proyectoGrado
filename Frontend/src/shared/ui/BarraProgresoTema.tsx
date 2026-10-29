// barra_progreso_tema -> barra de completado de un tema con animacion y puntos al terminar
import { Animated, Text, View } from 'react-native';
import React, { useEffect, useRef } from 'react';

interface BarraProgresoTemaProps {
  tema: string;
  progreso: number; // 0-100
  completado: boolean;
  puntosAlCompletar?: number;
  onCompletado?: () => void;
  color?: string;
}

export function BarraProgresoTema({
  tema,
  progreso,
  completado,
  puntosAlCompletar = 0,
  onCompletado,
  color = '#2563EB',
}: BarraProgresoTemaProps) {
  const animProgreso = useRef(new Animated.Value(0)).current;
  const animPuntos = useRef(new Animated.Value(0)).current;
  const completadoAntes = useRef(false);

  // Animar barra de progreso cuando cambia
  useEffect(() => {
    Animated.timing(animProgreso, {
      toValue: progreso,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [progreso, animProgreso]);

  // Detectar cuando se completa el tema y animar puntos
  useEffect(() => {
    if (completado && !completadoAntes.current) {
      completadoAntes.current = true;
      if (puntosAlCompletar > 0) {
        Animated.timing(animPuntos, {
          toValue: puntosAlCompletar,
          duration: 1000,
          useNativeDriver: true,
        }).start();
      }
      if (onCompletado) onCompletado();
    }
  }, [completado, puntosAlCompletar, onCompletado, animPuntos]);

  const porcentaje = Math.max(0, Math.min(100, progreso));

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs font-bold text-gray-700">{tema}</Text>
        <Text className="text-[10px] font-bold text-gray-500">
          {Math.round(porcentaje)}%
        </Text>
      </View>

      <View className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <Animated.View
          style={{
            width: `${porcentaje}%`,
            height: 4,
            backgroundColor: completado ? '#16A34A' : color,
            borderRadius: 2,
          }}
        />
      </View>

      {completado && puntosAlCompletar > 0 && (
        <View className="flex-row items-center gap-1 mt-1">
          <Text className="text-[10px] font-bold text-emerald-700">
            <Animated.Text>{animPuntos}</Animated.Text>
          </Text>
          <Text className="text-[10px] text-emerald-600">puntos obtenidos</Text>
        </View>
      )}
    </View>
  );
}
