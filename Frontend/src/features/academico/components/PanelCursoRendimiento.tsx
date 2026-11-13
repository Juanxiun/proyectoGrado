import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { RIESGO_META, type NivelRiesgo, type PanelCurso } from '../../../api/seguimiento.api';
import { StatusBadge, UserAvatar } from '../../../shared/ui';

function porcentaje(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : `${valor.toFixed(1)}%`;
}

function GraficoDistribucion({ panel }: { panel: PanelCurso }) {
  const colores = ['#DC2626', '#EAB308', '#D97706', '#2563EB', '#16A34A'];
  const total = panel.distribucionPromedios.reduce((suma, item) => suma + item.estudiantes, 0);
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  let desplazamiento = 0;

  return (
    <View className="flex-row flex-wrap items-center gap-5">
      <View className="w-28 h-28 items-center justify-center">
        <Svg width={112} height={112} viewBox="0 0 112 112">
          <Circle cx="56" cy="56" r={radio} fill="none" stroke="#F3F4F6" strokeWidth="14" />
          {total > 0 ? panel.distribucionPromedios.map((rango, indice) => {
            const longitud = (rango.estudiantes / total) * circunferencia;
            const circulo = <Circle key={rango.rango} cx="56" cy="56" r={radio} fill="none" stroke={colores[indice % colores.length]} strokeWidth="14" strokeDasharray={`${longitud} ${circunferencia - longitud}`} strokeDashoffset={-desplazamiento} transform="rotate(-90 56 56)" />;
            desplazamiento += longitud;
            return circulo;
          }) : null}
        </Svg>
        <View className="absolute items-center">
          <Text className="text-xl font-black text-gray-900">{total}</Text>
          <Text className="text-[9px] text-gray-500">estudiantes</Text>
        </View>
      </View>
      <View className="flex-1 min-w-[180px] gap-2">
        {panel.distribucionPromedios.map((rango, indice) => (
          <View key={rango.rango} className="flex-row items-center gap-2">
            <View className="w-3 h-3 rounded-full" style={{ backgroundColor: colores[indice % colores.length] }} />
            <Text className="flex-1 text-xs text-gray-600">Promedio {rango.rango}</Text>
            <Text className="text-xs font-bold text-gray-900">{rango.estudiantes}</Text>
            <Text className="w-10 text-right text-[10px] text-gray-400">{total ? `${Math.round(rango.estudiantes / total * 100)}%` : '0%'}</Text>
          </View>
        ))}
      </View>
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

// panel del curso -> promedios, asistencia y riesgo
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
        <Text className="text-xs text-gray-500 mb-4">Cada color representa cuántos estudiantes están en ese tramo de notas.</Text>
        <GraficoDistribucion panel={panel} />
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

// lista estudiantes -> resumen y acceso al panel
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
            <UserAvatar
              nombre={estudiante.nombre}
              apellidoPaterno={estudiante.apellidoPaterno}
              className="w-10 h-10 rounded-xl bg-maroon/10"
              textoClassName="text-sm font-bold text-maroon"
            />
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
