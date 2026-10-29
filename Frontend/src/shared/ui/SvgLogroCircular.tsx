// logro_circular_svg -> gráfico donut SVG para logros y tasas de comprensión
import { Svg, Circle, Text, Defs, LinearGradient, Stop } from 'react-native-svg';
import React from 'react';

interface SvgLogroCircularProps {
  titulo: string;
  valor: number; // 0-100
  color: string;
  subtitulo?: string;
  tamano?: number;
}

export function SvgLogroCircular({
  titulo,
  valor,
  color,
  subtitulo,
  tamano = 110,
}: SvgLogroCircularProps) {
  const cx = tamano / 2;
  const cy = tamano / 2 - 8;
  const radio = tamano / 2 - 22;
  const progreso = Math.min(1, Math.max(0, valor / 100));
  const arco = 360 * progreso;

  return (
    <Svg width={tamano} height={tamano + 50}>
      <Defs>
        <LinearGradient id={`gradLogro${titulo}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={color} />
          <Stop offset="100%" stopColor="#F3D9B7" />
        </LinearGradient>
      </Defs>

      {/* Pista de fondo */}
      <Circle cx={cx} cy={cy} r={radio} fill="none" stroke="#F1F5F9" strokeWidth={8} strokeLinecap="round" />

      {/* Donut de progreso SVG */}
      <Circle
        cx={cx}
        cy={cy}
        r={radio}
        fill="none"
        stroke="url(#gradLogro${titulo})"
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={2 * Math.PI * radio}
        strokeDashoffset={2 * Math.PI * radio * (1 - progreso)}
      />

      {/* Valor central */}
      <Text x={cx} y={cy + 6} textAnchor="middle" fill="#0F172A" fontSize={tamano * 0.22} fontWeight="900">
        {Math.round(valor)}%
      </Text>

      {/* Título */}
      <Text x={cx} y={tamano - 10} textAnchor="middle" fill="#6B7280" fontSize={tamano * 0.11} fontWeight="700">
        {titulo}
      </Text>

      {subtitulo && (
        <Text x={cx} y={tamano + 28} textAnchor="middle" fill="#94A3B8" fontSize={tamano * 0.075}>
          {subtitulo}
        </Text>
      )}
    </Svg>
  );
}
