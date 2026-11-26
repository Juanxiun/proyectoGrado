// SvgRangoMedalla -> emblema de rango con degradado metálico y corona
import { Svg, Circle, Path, Polygon, Defs, LinearGradient, Stop, Text } from 'react-native-svg';

interface SvgRangoMedallaProps {
  rango: string;
  nivel: number;
  colorRango: string;
  tamano?: number;
}

const PALETA_RANGO: Record<string, { claro: string; medio: string; oscuro: string; borde: string; nombre: string }> = {
  D: { claro: '#E2E8F0', medio: '#94A3B8', oscuro: '#475569', borde: '#CBD5E1', nombre: 'EXPLORADOR' },
  C: { claro: '#F5CBA7', medio: '#B87333', oscuro: '#6E3B16', borde: '#FDEBD0', nombre: 'APRENDIZ' },
  B: { claro: '#93C5FD', medio: '#2563EB', oscuro: '#1E3A8A', borde: '#DBEAFE', nombre: 'AVANZADO' },
  A: { claro: '#FDE68A', medio: '#D97706', oscuro: '#78350F', borde: '#FEF3C7', nombre: 'EXPERTO' },
  S: { claro: '#FCA5A5', medio: '#DC2626', oscuro: '#7F1D1D', borde: '#FEE2E2', nombre: 'MAESTRO' },
};

export function SvgRangoMedalla({
  rango,
  nivel,
  colorRango,
  tamano = 124,
}: SvgRangoMedallaProps) {
  const clave = rango.toUpperCase();
  const paleta = PALETA_RANGO[clave] ?? {
    claro: colorRango,
    medio: colorRango,
    oscuro: '#334155',
    borde: '#FFFFFF',
    nombre: `RANGO ${clave}`,
  };
  const gradId = `rangoGrad_${clave}_${tamano}`;
  const brilloId = `rangoGlow_${clave}_${tamano}`;

  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={paleta.claro} />
          <Stop offset="48%" stopColor={paleta.medio} />
          <Stop offset="100%" stopColor={paleta.oscuro} />
        </LinearGradient>
        <LinearGradient id={brilloId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
          <Stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
        </LinearGradient>
      </Defs>

      {/* Halo exterior sutil */}
      <Circle cx="60" cy="60" r="56" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" />

      {/* Escudo / emblema hexagonal redondeado */}
      <Path
        d="M60 10 L102 28 L96 76 C94 92 78 104 60 110 C42 104 26 92 24 76 L18 28 Z"
        fill={`url(#${gradId})`}
        stroke={paleta.borde}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Borde interior */}
      <Path
        d="M60 17 L95 32 L90 74 C88 87 75 97 60 102 C45 97 32 87 30 74 L25 32 Z"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.2"
      />

      {/* Brillo superior */}
      <Path
        d="M60 17 L95 32 L92 54 C76 47 44 47 28 54 L25 32 Z"
        fill={`url(#${brilloId})`}
      />

      {/* Estrella superior */}
      <Polygon
        points="60,21 62.6,26.6 68.8,27.4 64.2,31.6 65.4,37.6 60,34.6 54.6,37.6 55.8,31.6 51.2,27.4 57.4,26.6"
        fill="#FFFFFF"
        opacity="0.92"
      />

      {/* Letra del rango */}
      <Text
        x="60"
        y="74"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="42"
        fontWeight="900"
      >
        {clave}
      </Text>

      {/* Etiqueta inferior de nivel / categoría */}
      <Text
        x="60"
        y="91"
        textAnchor="middle"
        fill="rgba(255,255,255,0.94)"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="0.8"
      >
        {`${paleta.nombre} · NV ${nivel}`}
      </Text>
    </Svg>
  );
}
