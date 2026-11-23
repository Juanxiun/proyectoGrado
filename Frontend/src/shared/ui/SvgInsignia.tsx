// SvgInsignia -> medalla con cinta e ícono, dorada o bloqueada
import { useState } from 'react';
import { Modal, TouchableOpacity, View, Text as RNText } from 'react-native';
import { Svg, Circle, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

interface SvgInsigniaProps {
  nombre: string;
  obtenida: boolean;
  tamano?: number;
  icono?: keyof typeof Ionicons.glyphMap;
  color?: string;
  criterio?: string;
}

function sanitizarId(valor: string): string {
  return valor.replace(/[^a-zA-Z0-9]/g, '') || 'insignia';
}

export function SvgInsignia({
  nombre,
  obtenida,
  tamano = 64,
  icono = 'ribbon',
  color = '#F59E0B',
  criterio,
}: SvgInsigniaProps) {
  const [detalleVisible, setDetalleVisible] = useState(false);
  const slug = sanitizarId(nombre);
  const gradCintaId = `gradCinta_${slug}_${obtenida ? 'on' : 'off'}`;
  const gradMedallaId = `gradMedalla_${slug}_${obtenida ? 'on' : 'off'}`;

  const acentoOscuro = obtenida ? '#B45309' : '#94A3B8';
  const acentoClaro = obtenida ? '#FDE68A' : '#E2E8F0';
  const colorPrincipal = obtenida ? color : '#CBD5E1';
  const iconColor = obtenida ? '#FFFFFF' : '#64748B';

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={() => setDetalleVisible(true)}
      className={`flex-1 items-center rounded-2xl border p-3 ${
        obtenida ? 'border-amber-200 bg-amber-50/70' : 'border-gray-200 bg-gray-50/80'
      }`}
    >
      <View style={{ width: tamano, height: tamano + 10, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={tamano} height={tamano + 10} viewBox="0 0 80 90">
          <Defs>
            <LinearGradient id={gradCintaId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={obtenida ? '#801F3F' : '#94A3B8'} />
              <Stop offset="100%" stopColor={obtenida ? '#4C1025' : '#64748B'} />
            </LinearGradient>
            <LinearGradient id={gradMedallaId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={acentoClaro} />
              <Stop offset="50%" stopColor={colorPrincipal} />
              <Stop offset="100%" stopColor={acentoOscuro} />
            </LinearGradient>
          </Defs>

          {/* Cinta superior */}
          <Path d="M24 6 L37 6 L37 32 L24 26 Z" fill={`url(#${gradCintaId})`} />
          <Path d="M43 6 L56 6 L56 26 L43 32 Z" fill={`url(#${gradCintaId})`} />
          <Rect x="20" y="3" width="40" height="8" rx="3" fill={obtenida ? '#B45309' : '#94A3B8'} />

          {/* Medalla */}
          <Circle cx="40" cy="54" r="28" fill={`url(#${gradMedallaId})`} stroke={acentoOscuro} strokeWidth="2.5" />
          <Circle cx="40" cy="54" r="22" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeDasharray="4,3" />
        </Svg>

        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: (tamano + 10) * 0.6 - tamano * 0.19,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icono} size={Math.round(tamano * 0.34)} color={iconColor} />
        </View>
      </View>

      <RNText
        numberOfLines={2}
        className={`mt-1.5 text-center text-[11px] font-extrabold leading-tight ${
          obtenida ? 'text-gray-900' : 'text-gray-500'
        }`}
      >
        {nombre}
      </RNText>

      <View
        className={`mt-1.5 flex-row items-center gap-1 rounded-full px-2 py-0.5 ${
          obtenida ? 'bg-amber-100' : 'bg-gray-200/80'
        }`}
      >
        <Ionicons
          name={obtenida ? 'checkmark-circle' : 'lock-closed-outline'}
          size={10}
          color={obtenida ? '#B45309' : '#64748B'}
        />
        <RNText className={`text-[9px] font-bold ${obtenida ? 'text-amber-800' : 'text-gray-500'}`}>
          {obtenida ? 'Obtenida' : 'Bloqueada'}
        </RNText>
      </View>

      <Modal visible={detalleVisible} transparent animationType="fade" onRequestClose={() => setDetalleVisible(false)}>
        <View className="flex-1 bg-black/60 justify-center p-6">
          <View className="rounded-3xl bg-white p-6 items-center gap-3 shadow-xl">
            <View
              className={`h-16 w-16 rounded-2xl items-center justify-center ${
                obtenida ? 'bg-amber-100' : 'bg-gray-100'
              }`}
            >
              <Ionicons name={icono} size={34} color={obtenida ? color : '#94A3B8'} />
            </View>
            <RNText className="text-lg font-black text-gray-900 text-center">{nombre}</RNText>
            <RNText className="text-center text-sm leading-6 text-gray-600">
              {criterio || 'Completa actividades de estudio para desbloquear este logro.'}
            </RNText>
            <View
              className={`flex-row items-center gap-1.5 rounded-full px-3 py-1 ${
                obtenida ? 'bg-emerald-100' : 'bg-gray-100'
              }`}
            >
              <Ionicons
                name={obtenida ? 'checkmark-circle' : 'lock-closed-outline'}
                size={14}
                color={obtenida ? '#047857' : '#6B7280'}
              />
              <RNText className={`text-xs font-bold ${obtenida ? 'text-emerald-800' : 'text-gray-600'}`}>
                {obtenida ? 'Logro conseguido' : 'Aún por conseguir'}
              </RNText>
            </View>
            <TouchableOpacity
              onPress={() => setDetalleVisible(false)}
              className="mt-1 w-full rounded-xl bg-[#801F3F] p-3"
            >
              <RNText className="text-center font-bold text-white">Cerrar</RNText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}
