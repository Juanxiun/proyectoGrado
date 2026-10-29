// insignia_svg -> insignia con forma de copa; dorada si la tiene, gris si no
import { Svg, Circle, Path, Rect, Text, Defs, LinearGradient, Stop } from 'react-native-svg';
import React from 'react';

interface SvgInsigniaProps {
  nombre: string;
  color: string;
  obtenida: boolean;
  tamano?: number;
}

export function SvgInsignia({
  nombre,
  color,
  obtenida,
  tamano = 64,
}: SvgInsigniaProps) {
  const cx = tamano / 2;
  const tono = obtenida ? color : '#CBD5E1';
  const copaColor = obtenida ? '#D97706' : '#9CA3AF';
  const brillo = obtenida ? '#FCD34D' : '#E5E7EB';

  const inicial = nombre.charAt(0).toUpperCase();

  return (
    <Svg width={tamano} height={tamano + 26}>
      <Defs>
        <LinearGradient id={`gradCopa${nombre}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={obtenida ? '#F59E0B' : '#94A3B8'} />
          <Stop offset="100%" stopColor={obtenida ? '#B45309' : '#6B7280'} />
        </LinearGradient>
      </Defs>

      {/* Base de la copa */}
      <Rect
        x={cx - tamano * 0.16}
        y={tamano * 0.55}
        width={tamano * 0.32}
        height={tamano * 0.08}
        rx={4}
        fill={obtenida ? '#FCD34D' : '#CBD5E1'}
      />

      {/* Cuerpo de la copa */}
      <Path
        d={`M ${cx - tamano * 0.22} ${tamano * 0.45}
             L ${cx - tamano * 0.12} ${tamano * 0.18}
             L ${cx} ${tamano * 0.06}
             L ${cx + tamano * 0.12} ${tamano * 0.18}
             L ${cx + tamano * 0.22} ${tamano * 0.45}
             Z`}
        fill={obtenida ? 'url(#gradCopa${nombre})' : '#CBD5E1'}
        stroke={obtenida ? '#B45309' : '#9CA3AF'}
        strokeWidth={2}
      />

      {/* Brillo interior de la copa */}
      <Path
        d={`M ${cx - tamano * 0.10} ${tamano * 0.24}
             L ${cx - tamano * 0.04} ${tamano * 0.14}
             L ${cx + tamano * 0.04} ${tamano * 0.14}
             L ${cx + tamano * 0.10} ${tamano * 0.24}
             Z`}
        fill={brillo}
        opacity={obtenida ? 0.8 : 0.3}
      />

      {/* Inicial dentro de la copa */}
      <Text
        x={cx}
        y={tamano * 0.42}
        textAnchor="middle"
        fill={obtenida ? '#78350F' : '#6B7280'}
        fontSize={tamano * 0.16}
        fontWeight="900"
      >
        {inicial}
      </Text>

      {/* Etiqueta nombre debajo */}
      <Text
        x={cx}
        y={tamano + 20}
        textAnchor="middle"
        fill={obtenida ? '#0F172A' : '#94A3B8'}
        fontSize={tamano * 0.13}
        fontWeight="800"
      >
        {nombre}
      </Text>
    </Svg>
  );
}
