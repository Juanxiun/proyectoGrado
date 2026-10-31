// insignia_svg -> medalla con cinta/liston; dorada si la tiene, gris si no
import { Svg, Circle, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import React, { useState } from 'react';
import { Modal, TouchableOpacity, View, Text as RNText } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SvgInsigniaProps {
  nombre: string;
  obtenida: boolean;
  tamano?: number;
  icono?: string;
  criterio?: string;
}

export function SvgInsignia({
  nombre,
  obtenida,
  tamano = 80,
  icono = 'award',
  criterio,
}: SvgInsigniaProps) {
  const [detalleVisible, setDetalleVisible] = useState(false);
  const cx = tamano / 2;
  const cy = tamano / 2 + 6;
  const radioMedalla = tamano * 0.26;
  const oroOscuro = obtenida ? '#B45309' : '#94A3B8';
  const brillo = obtenida ? '#FCD34D' : '#E5E7EB';
  const textoColor = obtenida ? '#0F172A' : '#6B7280';
  const iconColor = obtenida ? '#78350F' : '#6B7280';

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => setDetalleVisible(true)} style={{ width: tamano, height: tamano + 52, alignItems: 'center' }}>
      <Svg width={tamano} height={tamano + 16}>
        <Defs>
          <LinearGradient id={`gradCinta${nombre}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={obtenida ? '#F59E0B' : '#9CA3AF'} />
            <Stop offset="100%" stopColor={oroOscuro} />
          </LinearGradient>
          <LinearGradient id={`gradMedalla${nombre}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={obtenida ? '#FBBF24' : '#E5E7EB'} />
            <Stop offset="100%" stopColor={oroOscuro} />
          </LinearGradient>
        </Defs>

        {/* Colas de la cinta (detras de la medalla) */}
        <Path
          d={`M ${cx - tamano * 0.14} ${tamano * 0.04}
               L ${cx - tamano * 0.14} ${tamano * 0.16}
               L ${cx - tamano * 0.06} ${tamano * 0.16}
               L ${cx - tamano * 0.06} ${tamano * 0.04}
               Z`}
          fill={oroOscuro}
        />
        <Path
          d={`M ${cx + tamano * 0.14} ${tamano * 0.04}
               L ${cx + tamano * 0.14} ${tamano * 0.16}
               L ${cx + tamano * 0.06} ${tamano * 0.16}
               L ${cx + tamano * 0.06} ${tamano * 0.04}
               Z`}
          fill={oroOscuro}
        />

        {/* Cinta principal (liston horizontal) */}
        <Rect
          x={cx - tamano * 0.30}
          y={tamano * 0.06}
          width={tamano * 0.60}
          height={tamano * 0.14}
          rx={tamano * 0.02}
          fill={`url(#gradCinta${nombre})`}
          stroke={oroOscuro}
          strokeWidth={2}
        />

        {/* Medalla circular */}
        <Circle
          cx={cx}
          cy={cy}
          r={radioMedalla}
          fill={`url(#gradMedalla${nombre})`}
          stroke={oroOscuro}
          strokeWidth={3}
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radioMedalla - 4}
          fill="none"
          stroke={brillo}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={obtenida ? 0.6 : 0.3}
        />
      </Svg>

      {/* Icono dentro de la medalla */}
      <Ionicons
        name={icono as any}
        size={radioMedalla * 0.8}
        color={iconColor}
        style={{
          position: 'absolute',
          top: cy - radioMedalla * 0.4,
          left: cx - radioMedalla * 0.4,
        }}
      />

      {/* Nombre de la insignia debajo */}
      <RNText style={{ marginTop: 8, textAlign: 'center' }}
        className={obtenida ? 'text-[#0F172A] text-[11px] font-bold' : 'text-[#6B7280] text-[11px] font-bold'}>
        {nombre}
      </RNText>

      <Modal visible={detalleVisible} transparent animationType="fade" onRequestClose={() => setDetalleVisible(false)}>
        <View className="flex-1 bg-black/60 justify-center p-6"><View className="rounded-3xl bg-white p-5 items-center gap-3">
          <Ionicons name={icono as any} size={36} color={obtenida ? '#B45309' : '#94A3B8'} />
          <RNText className="text-lg font-black text-gray-900">{nombre}</RNText>
          <RNText className="text-center text-sm leading-6 text-gray-700">{criterio || 'Completa actividades de estudio para conseguir este logro.'}</RNText>
          <RNText className="text-xs font-bold text-[#801F3F]">{obtenida ? 'Logro conseguido' : 'Aún por conseguir'}</RNText>
          <TouchableOpacity onPress={() => setDetalleVisible(false)} className="w-full rounded-xl bg-[#801F3F] p-3"><RNText className="text-center font-bold text-white">Cerrar</RNText></TouchableOpacity>
        </View></View>
      </Modal>
    </TouchableOpacity>
  );
}
