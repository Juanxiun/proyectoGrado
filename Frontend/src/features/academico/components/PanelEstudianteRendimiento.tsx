import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { RIESGO_META, type PanelEstudiante } from '../../../api/seguimiento.api';
import { StatusBadge } from '../../../shared/ui';

function Barra({ valor, sufijo = '%' }: { valor: number | null; sufijo?: string }) {
  const esNota = sufijo === '';
  const tono = valor === null
    ? '#D1D5DB'
    : esNota
    ? valor >= 70
      ? '#16A34A'
      : valor >= 60
      ? '#EAB308'
      : '#DC2626'
    : valor >= 80
    ? '#16A34A'
    : valor >= 75
    ? '#EAB308'
    : '#DC2626';

  return (
    <View className="gap-1">
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <View
          className="h-full rounded-full"
          style={{ width: `${Math.max(0, Math.min(100, valor ?? 0))}%`, backgroundColor: tono }}
        />
      </View>
      <Text className="text-[11px] text-gray-400">
        {valor === null ? 'Sin datos' : `${valor}${sufijo}`}
      </Text>
    </View>
  );
}

function FilaResumen({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <View className="flex-1 min-w-[110px]">
      <Text className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">{etiqueta}</Text>
      {children}
    </View>
  );
}

/** Desempeño individual: todas las materias del período, con su riesgo. */
export function PanelEstudianteRendimiento({
  panel,
  loading,
}: {
  panel: PanelEstudiante | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="py-16 items-center">
        <ActivityIndicator size="large" color="#801529" />
        <Text className="text-sm text-gray-500 mt-3">Calculando el desempeño…</Text>
      </View>
    );
  }

  if (!panel) {
    return (
      <View className="py-16 items-center">
        <Ionicons name="person-outline" size={38} color="#9CA3AF" />
        <Text className="text-gray-500 mt-2 text-center">
          No se pudo obtener el seguimiento de este estudiante.
        </Text>
      </View>
    );
  }

  const periodo = panel.periodos[0];

  return (
    <View className="gap-4">
      <View className="bg-maroon rounded-2xl p-5">
        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-2xl bg-white/20 items-center justify-center">
            <Text className="text-white font-bold text-lg">
              {panel.nombre.charAt(0)}{panel.apellidoPaterno.charAt(0)}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-white font-bold text-lg">
              {panel.nombre} {panel.apellidoPaterno}
              {panel.apellidoMaterno ? ` ${panel.apellidoMaterno}` : ''}
            </Text>
            <Text className="text-white/70 text-xs">{panel.cursoParalelo}</Text>
          </View>
        </View>
        {periodo ? (
          <View className="flex-row items-center gap-2 mt-3">
            <Text className="text-white/70 text-xs">
              {periodo.nombre} · {periodo.anio}
            </Text>
            <View className="flex-1" />
            <StatusBadge
              label={RIESGO_META[periodo.nivelRiesgo].label}
              variant={RIESGO_META[periodo.nivelRiesgo].variant}
            />
          </View>
        ) : null}
      </View>

      {periodo ? (
        <View className="bg-white border border-gray-100 rounded-2xl p-4">
          <Text className="text-sm font-bold text-gray-900 mb-3">Resumen del período</Text>
          <View className="flex-row flex-wrap gap-4">
            <FilaResumen etiqueta="Promedio general">
              <Barra valor={periodo.promedio} sufijo="" />
            </FilaResumen>
            <FilaResumen
              etiqueta={`Asistencia (${periodo.asistencia.ausentes} ausencias)`}
            >
              <Barra valor={periodo.asistencia.tasa} />
            </FilaResumen>
            <FilaResumen etiqueta="Índice de desempeño">
              <Barra valor={periodo.indiceDesempeno} />
            </FilaResumen>
          </View>
        </View>
      ) : null}

      <View className="bg-white border border-gray-100 rounded-2xl p-4">
        <Text className="text-sm font-bold text-gray-900 mb-1">Desempeño por materia</Text>
        <Text className="text-xs text-gray-500 mb-3">
          Promedio ponderado de las tareas publicadas del trimestre
        </Text>

        {periodo?.materias.length ? (
          periodo.materias.map((materia) => {
            const meta = RIESGO_META[materia.nivelRiesgo];
            return (
              <View key={materia.materiaId} className="py-3 border-b border-gray-50">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-semibold text-gray-800">{materia.materia}</Text>
                    <Text className="text-[11px] text-gray-400">
                      {materia.tareasCalificadas} de {materia.tareasPublicadas} tareas calificadas ·
                      asistencia {materia.asistencia.tasa !== null ? `${materia.asistencia.tasa}%` : '—'}
                    </Text>
                  </View>
                  <Text className="text-base font-bold text-gray-900 mr-2">
                    {materia.promedio !== null ? materia.promedio.toFixed(1) : '—'}
                  </Text>
                  <StatusBadge label={meta.label} variant={meta.variant} />
                </View>
                <Barra valor={materia.promedio} sufijo="" />
              </View>
            );
          })
        ) : (
          <Text className="text-sm text-gray-500">
            Este estudiante aún no tiene notas registradas en el período.
          </Text>
        )}
      </View>
    </View>
  );
}
