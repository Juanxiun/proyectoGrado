import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { RIESGO_META, type NivelRiesgo, type PanelCurso } from '../../../api/seguimiento.api';
import { StatusBadge } from '../../../shared/ui';

function porcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : `${valor.toFixed(1)}%`;
}

function BarrasDistribucion({ panel }: { panel: PanelCurso }) {
  const maximo = Math.max(1, ...panel.distribucionPromedios.map((r) => r.estudiantes));
  const colorPorRango = (minimo: number) => {
    if (minimo < 50) return '#DC2626';
    if (minimo < 60) return '#EAB308';
    if (minimo < 70) return '#D97706';
    if (minimo < 80) return '#2563EB';
    return '#16A34A';
  };

  return (
    <View className="gap-2">
      {panel.distribucionPromedios.map((rango) => (
        <View key={rango.rango} className="flex-row items-center gap-3">
          <Text className="w-20 text-xs text-gray-500 font-mono">{rango.rango}</Text>
          <View className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{
                width: `${(rango.estudiantes / maximo) * 100}%`,
                backgroundColor: colorPorRango(rango.minimo),
              }}
            />
          </View>
          <Text className="w-8 text-right text-xs font-bold text-gray-700">{rango.estudiantes}</Text>
        </View>
      ))}
    </View>
  );
}

function Indicador({
  etiqueta,
  valor,
  icono,
  sufijo = '',
}: {
  etiqueta: string;
  valor: string;
  icono: keyof typeof Ionicons.glyphMap;
  sufijo?: string;
}) {
  return (
    <View className="flex-1 min-w-[120px] bg-white border border-gray-100 rounded-2xl p-4">
      <View className="flex-row items-center gap-2 mb-2">
        <Ionicons name={icono} size={16} color="#801529" />
        <Text className="text-[10px] font-bold text-gray-500 uppercase">{etiqueta}</Text>
      </View>
      <Text className="text-2xl font-bold text-gray-900">
        {valor}
        {sufijo ? <Text className="text-sm text-gray-500">{sufijo}</Text> : null}
      </Text>
    </View>
  );
}

/** Resumen de desempeño de todo el curso: promedios, asistencia y riesgo. */
export function PanelCursoRendimiento({
  panel,
  loading,
}: {
  panel: PanelCurso | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <View className="py-16 items-center">
        <ActivityIndicator size="large" color="#801529" />
        <Text className="text-sm text-gray-500 mt-3">Calculando el desempeño del curso…</Text>
      </View>
    );
  }

  if (!panel) {
    return (
      <View className="py-16 items-center">
        <Ionicons name="analytics-outline" size={38} color="#9CA3AF" />
        <Text className="text-gray-500 mt-2 text-center">
          No hay datos de seguimiento para este curso en el trimestre seleccionado.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <Indicador
          etiqueta="Promedio general"
          valor={panel.promedioGeneral !== null ? panel.promedioGeneral.toFixed(1) : '—'}
          icono="school-outline"
        />
        <Indicador
          etiqueta="Asistencia media"
          valor={porcentaje(panel.promedioAsistencia)}
          icono="checkmark-done-outline"
        />
        <Indicador etiqueta="Estudiantes" valor={String(panel.estudiantes)} icono="people-outline" />
        <Indicador etiqueta="Materias" valor={String(panel.totalMaterias)} icono="book-outline" />
      </View>

      <View className="bg-white border border-gray-100 rounded-2xl p-4">
        <Text className="text-sm font-bold text-gray-900 mb-1">Alertas de riesgo</Text>
        <Text className="text-xs text-gray-500 mb-3">
          Un estudiante cuenta una vez por materia. El mismo estudiante puede aparecer en varias.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <View className="flex-row items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <Ionicons name="warning" size={16} color="#DC2626" />
            <Text className="text-xs font-bold text-red-700">
              Riesgo alto: {panel.riesgo.alto}
            </Text>
          </View>
          <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Ionicons name="warning-outline" size={16} color="#D97706" />
            <Text className="text-xs font-bold text-amber-700">
              En riesgo: {Math.max(0, panel.riesgo.total - panel.riesgo.alto)}
            </Text>
          </View>
          <View className="flex-row items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <Ionicons name="eye-outline" size={16} color="#2563EB" />
            <Text className="text-xs font-bold text-blue-700">
              En observación: {panel.riesgo.observacion}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-white border border-gray-100 rounded-2xl p-4">
        <Text className="text-sm font-bold text-gray-900 mb-1">Distribución de promedios</Text>
        <Text className="text-xs text-gray-500 mb-4">Cantidad de estudiantes por tramo</Text>
        <BarrasDistribucion panel={panel} />
      </View>

      <View className="bg-white border border-gray-100 rounded-2xl p-4">
        <Text className="text-sm font-bold text-gray-900 mb-3">Desempeño por materia</Text>
        {panel.materias.length === 0 ? (
          <Text className="text-sm text-gray-500">Este curso aún no tiene materias asignadas.</Text>
        ) : (
          panel.materias.map((materia) => (
            <View
              key={materia.materiaId}
              className="flex-row items-center justify-between py-2.5 border-b border-gray-50"
            >
              <View className="flex-1 pr-3">
                <Text className="text-sm font-semibold text-gray-800">{materia.materia}</Text>
                <Text className="text-[11px] text-gray-400">
                  {materia.tipoMateria === 'extracurricular' ? 'Extracurricular' : 'Principal'} ·{' '}
                  {materia.estudiantesEvaluados} evaluados
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-bold text-gray-900">
                  {materia.promedio !== null ? materia.promedio.toFixed(1) : '—'}
                </Text>
                <Text className="text-[11px] text-gray-400">
                  {porcentaje(materia.promedioAsistencia)} asist.
                </Text>
              </View>
              {materia.enRiesgo > 0 ? (
                <View className="ml-3">
                  <StatusBadge
                    label={`${materia.enRiesgo}`}
                    variant={materia.enRiesgo > 2 ? 'danger' : 'warning'}
                  />
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

/** Lista de estudiantes del curso con su resumen; al tocar, se abre su panel. */
export function ListaEstudiantesCurso({
  estudiantes,
  onSelect,
}: {
  estudiantes: Array<{
    estudianteId: string;
    nombre: string;
    apellidoPaterno: string;
    promedio: number | null;
    asistencia: number | null;
    nivelRiesgo: NivelRiesgo;
  }>;
  onSelect: (estudianteId: string) => void;
}) {
  if (estudiantes.length === 0) {
    return (
      <View className="py-10 items-center">
        <Ionicons name="people-outline" size={34} color="#9CA3AF" />
        <Text className="text-sm text-gray-500 mt-2">Este curso no tiene estudiantes inscritos.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="max-h-[420px]">
      {estudiantes.map((estudiante) => {
        const meta = RIESGO_META[estudiante.nivelRiesgo];
        return (
          <TouchableOpacity
            key={estudiante.estudianteId}
            onPress={() => onSelect(estudiante.estudianteId)}
            activeOpacity={0.75}
            className="flex-row items-center gap-3 py-3 border-b border-gray-50"
          >
            <View className="w-10 h-10 rounded-xl bg-maroon/10 items-center justify-center">
              <Text className="text-sm font-bold text-maroon">
                {estudiante.nombre.charAt(0)}{estudiante.apellidoPaterno.charAt(0)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                {estudiante.nombre} {estudiante.apellidoPaterno}
              </Text>
              <Text className="text-[11px] text-gray-400">
                Promedio {estudiante.promedio !== null ? estudiante.promedio.toFixed(1) : '—'} ·
                asistencia {estudiante.asistencia !== null ? `${estudiante.asistencia}%` : '—'}
              </Text>
            </View>
            <StatusBadge label={meta.label} variant={meta.variant} />
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
