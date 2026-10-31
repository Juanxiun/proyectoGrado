// podio_svg -> podio del ranking: foto arriba, nombre y apellido debajo, sin numeros
import { Svg, Circle, Rect, Text, Defs, LinearGradient, Stop, G, Image as SvgImage } from 'react-native-svg';
import React from 'react';

interface EstudiantePodioSvg {
  nombre: string;
  apellidoPaterno: string;
  puntosIndividuales: number;
  avatarUrl?: string | null;
  posicion: number;
  color: string;
  esLogueado: boolean;
  tamano?: number;
}

interface SvgPodioProps {
  estudiantes: EstudiantePodioSvg[];
}

const COLORES_POSICION = ['#F59E0B', '#9CA3AF', '#EF4444']; // oro, gris, rojo

export function SvgPodio({ estudiantes }: SvgPodioProps) {
  const ancho = 300;
  const alto = 300;
  const columnWidth = 85;
  const gap = 14;
  const baseY = 260;

  const alturas = [170, 130, 160];
  const posicionesX = [gap, gap + columnWidth + gap, gap + (columnWidth + gap) * 2];

  return (
    <Svg width={ancho} height={alto}>
      <Defs>
        <LinearGradient id="gradPodioFondo" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#F8FAFC" />
          <Stop offset="100%" stopColor="#F1F5F9" />
        </LinearGradient>
        <LinearGradient id="gradLogueado" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#801529" />
          <Stop offset="100%" stopColor="#5B1220" />
        </LinearGradient>
      </Defs>

      <Rect x={0} y={0} width={ancho} height={alto} fill="url(#gradPodioFondo)" />

      {estudiantes.map((est, i) => {
        const posX = posicionesX[i];
        const altura = alturas[i] ?? 100;
        const color = COLORES_POSICION[i] ?? '#6B7280';
        const esLogueado = est.esLogueado;

        return (
          <G key={est.posicion} transform={`translate(${posX}, ${baseY - altura})`}>
            {/* Barra de altura */}
            <Rect
              x={0}
              y={0}
              width={columnWidth}
              height={altura}
              rx={10}
              fill={esLogueado ? 'url(#gradLogueado)' : color}
              stroke={esLogueado ? '#801529' : '#FFFFFF'}
              strokeWidth={esLogueado ? 3 : 0}
            />

            {/* Foto de perfil del estudiante arriba */}
            {est.avatarUrl ? (
              <SvgImage
                href={est.avatarUrl}
                x={columnWidth / 2 - 18}
                y={altura - 44}
                width={36}
                height={36}
                preserveAspectRatio="xMidYMid slice"
              />
            ) : (
              <Circle
                cx={columnWidth / 2}
                cy={altura - 26}
                r={18}
                fill="#E2E8F0"
                stroke={esLogueado ? color : '#CBD5E1'}
                strokeWidth={2}
              />
            )}

            {/* Nombre */}
            <Text
              x={columnWidth / 2}
              y={altura + 8}
              textAnchor="middle"
              fill="#0F172A"
              fontSize={9.5}
              fontWeight="800"
              textLength={columnWidth - 10}
              lengthAdjust="spacingAndGlyphs"
            >
              {est.nombre}
            </Text>

            {/* Apellido */}
            <Text
              x={columnWidth / 2}
              y={altura + 22}
              textAnchor="middle"
              fill="#6B7280"
              fontSize={8.5}
              fontWeight="700"
              textLength={columnWidth - 10}
              lengthAdjust="spacingAndGlyphs"
            >
              {est.apellidoPaterno}
            </Text>

            {/* Puntos */}
            <Text
              x={columnWidth / 2}
              y={altura + 36}
              textAnchor="middle"
              fill="#6B7280"
              fontSize={8}
              fontWeight="700"
            >
              {est.puntosIndividuales.toLocaleString('es-BO')} pts
            </Text>

            {esLogueado && (
              <G>
                <Rect
                  x={columnWidth / 2 - 22}
                  y={altura + 48}
                  width={44}
                  height={14}
                  rx={7}
                  fill="#DC2626"
                />
                <Text
                  x={columnWidth / 2}
                  y={altura + 58}
                  textAnchor="middle"
                  fill="white"
                  fontSize={8}
                  fontWeight="900"
                >
                  Tú
                </Text>
              </G>
            )}
          </G>
        );
      })}
    </Svg>
  );
}
