// SvgRangoMedalla -> escudo de rango con sombra en forma de escudo y letra de alto contraste
import { Svg, Path, Polygon, Defs, LinearGradient, Stop, Text } from 'react-native-svg';

interface SvgRangoMedallaProps {
  rango: string;
  nivel?: number;
  colorRango: string;
  tamano?: number;
}

const PALETA_RANGO: Record<
  string,
  { claro: string; medio: string; oscuro: string; borde: string; texto: string; bordeTexto: string }
> = {
  D: { claro: '#94A3B8', medio: '#475569', oscuro: '#1E293B', borde: '#E2E8F0', texto: '#F8FAFC', bordeTexto: '#0F172A' },
  C: { claro: '#D98A4E', medio: '#9A5423', oscuro: '#5C2E0E', borde: '#FDE68A', texto: '#FFFBEB', bordeTexto: '#3B1A06' },
  B: { claro: '#60A5FA', medio: '#2563EB', oscuro: '#1E3A8A', borde: '#DBEAFE', texto: '#FFFFFF', bordeTexto: '#0F172A' },
  A: { claro: '#FBBF24', medio: '#D97706', oscuro: '#78350F', borde: '#FEF3C7', texto: '#FFFBEB', bordeTexto: '#451A03' },
  S: { claro: '#F87171', medio: '#DC2626', oscuro: '#7F1D1D', borde: '#FEE2E2', texto: '#FEF08A', bordeTexto: '#450A0A' },
};

const SHIELD_PATH = 'M60 10 L102 27 L96 75 C94 91 78 103 60 109 C42 103 26 91 24 75 L18 27 Z';

export function SvgRangoMedalla({
  rango,
  colorRango,
  tamano = 112,
}: SvgRangoMedallaProps) {
  const clave = rango.toUpperCase();
  const paleta = PALETA_RANGO[clave] ?? {
    claro: colorRango,
    medio: colorRango,
    oscuro: '#1E293B',
    borde: '#FFFFFF',
    texto: '#FFFFFF',
    bordeTexto: '#0F172A',
  };
  const gradId = `rangoGrad_${clave}_${tamano}`;
  const brilloId = `rangoGlow_${clave}_${tamano}`;

  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={paleta.claro} />
          <Stop offset="55%" stopColor={paleta.medio} />
          <Stop offset="100%" stopColor={paleta.oscuro} />
        </LinearGradient>
        <LinearGradient id={brilloId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </LinearGradient>
      </Defs>

      {/* Sombra con forma de escudo (sin círculo) */}
      <Path d={SHIELD_PATH} fill="rgba(0,0,0,0.34)" transform="translate(0, 6) scale(1.02) translate(-1.2, -1)" />
      <Path d={SHIELD_PATH} fill="rgba(0,0,0,0.18)" transform="translate(0, 3) scale(1.05) translate(-3, -2.5)" />

      {/* Escudo principal */}
      <Path
        d={SHIELD_PATH}
        fill={`url(#${gradId})`}
        stroke={paleta.borde}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Marco interior sutil */}
      <Path
        d="M60 17 L95 31 L90 73 C88 86 75 96 60 101 C45 96 32 86 30 73 L25 31 Z"
        fill="none"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth="1.2"
      />

      {/* Reflejo superior suave sin tapar la letra */}
      <Path
        d="M60 17 L95 31 L93 46 C75 40 45 40 27 46 L25 31 Z"
        fill={`url(#${brilloId})`}
      />

      {/* Estrella decorativa superior */}
      <Polygon
        points="60,21 62.2,25.8 67.4,26.5 63.5,30 64.5,35.1 60,32.6 55.5,35.1 56.5,30 52.6,26.5 57.8,25.8"
        fill={paleta.borde}
        opacity="0.95"
      />

      {/* Sombra de la letra para máximo contraste */}
      <Text
        x="60"
        y="83"
        textAnchor="middle"
        fill={paleta.bordeTexto}
        fontSize="50"
        fontWeight="900"
        opacity="0.55"
      >
        {clave}
      </Text>

      {/* Letra principal del rango */}
      <Text
        x="60"
        y="80"
        textAnchor="middle"
        fill={paleta.texto}
        stroke={paleta.bordeTexto}
        strokeWidth="1.5"
        fontSize="50"
        fontWeight="900"
      >
        {clave}
      </Text>
    </Svg>
  );
}
