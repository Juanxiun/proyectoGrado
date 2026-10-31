// medalla_rango_svg -> medallón limpio del rango del estudiante, color sólido sin degradado
import { Svg, Circle, Text } from 'react-native-svg';
import React from 'react';

interface SvgRangoMedallaProps {
  rango: string;
  nivel: number;
  colorRango: string;
  tamano?: number;
}

export function SvgRangoMedalla({
  rango,
  nivel,
  colorRango,
  tamano = 130,
}: SvgRangoMedallaProps) {
  const cx = tamano / 2;
  const cy = tamano / 2;
  const radioExterno = tamano / 2 - 10;
  const radioInterno = tamano / 2 - 26;

  return (
    <Svg width={tamano} height={tamano}>
      {/* Círculo exterior del rango, color sólido */}
      <Circle
        cx={cx}
        cy={cy}
        r={radioExterno}
        fill={colorRango}
        stroke="white"
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* Anillo decorativo interior sutil */}
      <Circle
        cx={cx}
        cy={cy}
        r={radioExterno - 6}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
        strokeDasharray="20, 8"
      />

      {/* Letra del rango grande y centrada */}
      <Text
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        fill="white"
        fontSize={tamano * 0.34}
        fontWeight="900"
        letterSpacing="-1"
      >
        {rango}
      </Text>

      {/* Etiqueta Rango debajo de la letra */}
      <Text
        x={cx}
        y={cy + radioInterno * 0.55}
        textAnchor="middle"
        fill="rgba(255,255,255,0.9)"
        fontSize={tamano * 0.09}
        fontWeight="800"
      >
        Rango {rango}
      </Text>
    </Svg>
  );
}
