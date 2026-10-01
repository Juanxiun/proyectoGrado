import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import type { DashboardData } from '../../../api/dashboard.api';

function Barra({ valor, color = '#801529' }: { valor: number; color?: string }) {
  return (
    <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <View
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, valor))}%`, backgroundColor: color }}
      />
    </View>
  );
}

function Estadistica({
  etiqueta,
  valor,
  color,
}: {
  etiqueta: string;
  valor: string | number;
  color?: string;
}) {
  return (
    <View className="flex-1 min-w-[80px]">
      <Text
        className="text-xl font-bold"
        style={color ? { color } : undefined}
      >
        {valor}
      </Text>
      <Text className="text-[10px] font-bold text-gray-500 uppercase mt-0.5">{etiqueta}</Text>
    </View>
  );
}

/** Asistencia global, últimos días y los alumnos con más faltas. */
export function PanelAsistencia({ asistencia }: { asistencia: DashboardData['asistencia'] }) {
  const { global } = asistencia;

  if (global.registros === 0) {
    return (
      <View className="py-8 items-center">
        <Ionicons name="calendar-outline" size={34} color="#9CA3AF" />
        <Text className="text-sm text-gray-500 mt-2">
          Todavía no se registró asistencia en este período.
        </Text>
      </View>
    );
  }

  const maxDia = Math.max(1, ...asistencia.ultimosDias.map((d) => d.presentes + d.ausentes));

  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap gap-3">
        <Estadistica
          etiqueta="Tasa"
          valor={global.tasa !== null ? `${global.tasa}%` : '—'}
          color={(global.tasa ?? 100) < 85 ? '#DC2626' : '#16A34A'}
        />
        <Estadistica etiqueta="Faltas" valor={global.ausentes} color={global.ausentes > 0 ? '#DC2626' : undefined} />
        <Estadistica etiqueta="Atrasos" valor={global.atrasos} />
        <Estadistica etiqueta="Justificadas" valor={global.justificadas} />
        <Estadistica etiqueta="Días" valor={global.diasRegistrados} />
      </View>

      {asistencia.ultimosDias.length > 0 ? (
        <View>
          <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">
            Últimos días registrados
          </Text>
          <View className="flex-row items-end gap-1 h-16">
            {asistencia.ultimosDias.map((dia) => {
              const total = dia.presentes + dia.ausentes;
              return (
                <View key={dia.fecha} className="flex-1 items-center gap-0.5">
                  <View
                    className="w-full rounded-t bg-gray-100 flex-1 justify-end overflow-hidden"
                  >
                    <View
                      className="w-full"
                      style={{ height: `${(total / maxDia) * 100}%` }}
                    >
                      <View className="h-full bg-maroon" style={{ flex: dia.presentes / Math.max(1, total) }} />
                      <View className="h-full bg-red-400" style={{ flex: dia.ausentes / Math.max(1, total) }} />
                    </View>
                  </View>
                  <Text className="text-[8px] text-gray-400">{dia.fecha.slice(8)}</Text>
                </View>
              );
            })}
          </View>
          <View className="flex-row gap-3 mt-2">
            <View className="flex-row items-center gap-1">
              <View className="w-2 h-2 rounded-sm bg-maroon" />
              <Text className="text-[10px] text-gray-500">Asistencias</Text>
            </View>
            <View className="flex-row items-center gap-1">
              <View className="w-2 h-2 rounded-sm bg-red-400" />
              <Text className="text-[10px] text-gray-500">Faltas</Text>
            </View>
          </View>
        </View>
      ) : null}

      {asistencia.estudiantesConMasFaltas.length > 0 ? (
        <View>
          <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">
            Estudiantes con más faltas
          </Text>
          {asistencia.estudiantesConMasFaltas.map((estudiante) => (
            <View
              key={estudiante.estudianteId}
              className="flex-row items-center justify-between py-2 border-b border-gray-50"
            >
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-800" numberOfLines={1}>
                  {estudiante.nombre} {estudiante.apellidoPaterno}
                </Text>
                <Text className="text-[11px] text-gray-400">{estudiante.cursoParalelo}</Text>
              </View>
              <Text className="text-sm font-bold text-red-600 mr-3">
                {estudiante.ausentes} {estudiante.ausentes === 1 ? 'falta' : 'faltas'}
              </Text>
              <Text className="text-[11px] text-gray-400 w-16 text-right">
                de {estudiante.total}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Avance de calificación por materia, ordenado por los más atrasados. */
export function PanelAvance({ academico }: { academico: DashboardData['academico'] }) {
  const materias = academico._avance ?? [];

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-gray-600">
          Avance global del trimestre
        </Text>
        <Text className="text-lg font-bold text-maroon">{academico.materias.avanceGlobal}%</Text>
      </View>
      <Barra
        valor={academico.materias.avanceGlobal}
        color={academico.materias.avanceGlobal < 50 ? '#EAB308' : '#801529'}
      />

      <View className="flex-row flex-wrap gap-3 pt-1">
        <Estadistica etiqueta="Materias" valor={academico.materias.total} />
        <Estadistica etiqueta="Con encargos" valor={academico.materias.conEncargos} />
        <Estadistica
          etiqueta="Sin encargos"
          valor={academico.materias.sinEncargos}
          color={academico.materias.sinEncargos > 0 ? '#B45309' : undefined}
        />
        <Estadistica etiqueta="Cursos" valor={academico.cursos.total} />
        <Estadistica
          etiqueta="Sin docente"
          valor={academico.cursos.sinDocente}
          color={academico.cursos.sinDocente > 0 ? '#DC2626' : undefined}
        />
      </View>

      {materias.length === 0 ? (
        <Text className="text-sm text-gray-500 py-4">
          No hay materias asignadas en esta gestión.
        </Text>
      ) : (
        [...materias]
          .sort((a, b) => a.avanceCalificacion - b.avanceCalificacion)
          .slice(0, 10)
          .map((materia) => (
            <View key={`${materia.materiaId}-${materia.cursoParalelo}`} className="py-2.5 border-b border-gray-50">
              <View className="flex-row items-center justify-between mb-1.5">
                <View className="flex-1 pr-2">
                  <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                    {materia.materia}
                  </Text>
                  <Text className="text-[11px] text-gray-400">
                    {materia.cursoParalelo}
                    {materia.maestro ? ` · ${materia.maestro}` : ' · sin docente'}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-gray-900">
                  {materia.promedio !== null ? materia.promedio.toFixed(1) : '—'}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <Barra
                    valor={materia.avanceCalificacion}
                    color={
                      materia.avanceCalificacion === 0
                        ? '#E5E7EB'
                        : materia.avanceCalificacion < 50
                        ? '#EAB308'
                        : '#16A34A'
                    }
                  />
                </View>
                <Text className="text-[11px] text-gray-500 w-10 text-right">
                  {materia.avanceCalificacion}%
                </Text>
              </View>
              {materia.estudiantesSinNota > 0 ? (
                <Text className="text-[11px] text-amber-600 mt-1">
                  {materia.estudiantesSinNota} de {materia.estudiantes} sin nota
                </Text>
              ) : null}
            </View>
          ))
      )}
    </View>
  );
}
