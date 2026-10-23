import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { StatusBadge, UserAvatar } from '../../../shared/ui';
import type { NivelRiesgo, ResumenRiesgo } from '../../../api/dashboard.api';

const META: Record<NivelRiesgo, { label: string; variant: 'success' | 'info' | 'warning' | 'danger' }> = {
  sin_riesgo: { label: 'En regla', variant: 'success' },
  observacion: { label: 'Observación', variant: 'info' },
  riesgo: { label: 'En riesgo', variant: 'warning' },
  riesgo_alto: { label: 'Riesgo alto', variant: 'danger' },
};

/** Estudiantes que necesitan intervención, con el motivo del criterio. */
export function PanelRiesgo({ riesgo }: { riesgo: ResumenRiesgo }) {
  if (riesgo.total === 0 && riesgo.observacion === 0) {
    return (
      <View className="py-8 items-center">
        <Ionicons name="shield-checkmark-outline" size={34} color="#16A34A" />
        <Text className="text-sm text-gray-600 mt-2 font-semibold">
          Ningún estudiante en riesgo en este período
        </Text>
        <Text className="text-xs text-gray-400 mt-1">
          Criterio: nota &lt; {riesgo.umbrales.notaRiesgo} o asistencia &lt; {riesgo.umbrales.asistenciaRiesgo}%
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        <Pildora etiqueta="Riesgo alto" valor={riesgo.riesgoAlto} color="#DC2626" bg="#FEF2F2" />
        <Pildora etiqueta="En riesgo" valor={riesgo.riesgo} color="#B45309" bg="#FFFBEB" />
        <Pildora etiqueta="Observación" valor={riesgo.observacion} color="#1D4ED8" bg="#EFF6FF" />
      </View>

      {riesgo.top.length === 0 ? (
        <Text className="text-sm text-gray-500">No hay estudiantes en riesgo para mostrar.</Text>
      ) : (
        riesgo.top.map((estudiante) => {
          const meta = META[estudiante.nivelRiesgo];
          return (
            <View
              key={estudiante.estudianteId}
              className="flex-row items-center gap-3 py-2.5 border-b border-gray-50"
            >
              <UserAvatar
                nombre={estudiante.nombre}
                apellidoPaterno={estudiante.apellidoPaterno}
                className="w-9 h-9 rounded-xl bg-maroon/10"
                textoClassName="text-xs font-bold text-maroon"
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                  {estudiante.nombre} {estudiante.apellidoPaterno}
                </Text>
                <Text className="text-[11px] text-gray-400" numberOfLines={1}>
                  {estudiante.cursoParalelo} · {estudiante.motivos[0]}
                </Text>
              </View>
              <Text className="text-sm font-bold text-gray-900">
                {estudiante.promedio !== null ? estudiante.promedio.toFixed(1) : '—'}
              </Text>
              <StatusBadge label={meta.label} variant={meta.variant} />
            </View>
          );
        })
      )}
    </View>
  );
}

function Pildora({
  etiqueta,
  valor,
  color,
  bg,
}: {
  etiqueta: string;
  valor: number;
  color: string;
  bg: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ backgroundColor: bg }}>
      <Text className="text-xs font-bold" style={{ color }}>
        {valor}
      </Text>
      <Text className="text-[11px]" style={{ color }}>
        {etiqueta}
      </Text>
    </View>
  );
}
