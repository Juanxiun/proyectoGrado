import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  academicServicesApi,
  type MayaPorMateria,
  type NivelEducativo,
  type ResumenMalla,
  type TemaMalla,
} from '../../../api/academicServices.api';
import { useRealtimeResource } from '../../../hooks/useRealtimeResource';
import { NIVEL_LABEL, numeroGrado } from '../utils/niveles';
import { Alert, BentoCard, Button, KpiCard, TextField } from '../../../shared/ui';

type Borrador = {
  id?: string;
  titulo: string;
  contenidos: string;
  horasPrevistas: string;
  esEvaluacion: boolean;
};

const aBorrador = (t: TemaMalla): Borrador => ({
  id: t.id,
  titulo: t.titulo,
  contenidos: t.contenidos ?? '',
  horasPrevistas: String(t.horasPrevistas ?? 1),
  esEvaluacion: Boolean(t.esEvaluacion),
});

const borradorVacio = (): Borrador => ({
  titulo: '',
  contenidos: '',
  horasPrevistas: '1',
  esEvaluacion: false,
});

/**
 * Maya curricular: qué temas se van a trabajar en cada materia de un grado.
 *
 * Es el contenido de la materia y se define una sola vez por grado —igual que
 * las materias—, así que 1°A y 1°B comparten temario. A diferencia de la malla
 * del período, que sólo registra qué materia existe en una gestión concreta.
 */
export function MayaCurricularScreen({
  nivelInicial = 'primaria',
  gradoInicial,
  canEdit,
}: {
  nivelInicial?: NivelEducativo;
  /** Grado con el que se abre el panel (viene de la tarjeta del curso). */
  gradoInicial?: string;
  canEdit: boolean;
}) {
  const [nivel, setNivel] = useState<NivelEducativo>(nivelInicial);
  const [grado, setGrado] = useState<string>('');
  const [gradosDisponibles, setGradosDisponibles] = useState<{ grado: string; conMaterias: boolean }[]>([]);
  const [maya, setMaya] = useState<MayaPorMateria[]>([]);
  const [resumen, setResumen] = useState<ResumenMalla | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La materia abierta y su temario en edición. Se edita en memoria y se
  // guarda entero de un golpe, que es lo que espera el backend.
  const [materiaAbierta, setMateriaAbierta] = useState<string | null>(null);
  const [borradores, setBorradores] = useState<Borrador[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargarGrados = useCallback(async () => {
    try {
      const lista = await academicServicesApi.listGrados(nivel);
      const grados = [
        ...lista.conMaterias.map((g) => ({ grado: g.grado, conMaterias: true })),
        ...lista.sinMaterias.map((g) => ({ grado: g.grado, conMaterias: false })),
      ].sort((a, b) => (numeroGrado(a.grado) ?? 99) - (numeroGrado(b.grado) ?? 99));
      setGradosDisponibles(grados);
      setGrado((actual) =>
        actual && grados.some((g) => g.grado === actual) ? actual : grados[0]?.grado ?? '',
      );
    } catch (err) {
      setGradosDisponibles([]);
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los grados');
    }
  }, [nivel]);

  const cargarMalla = useCallback(async () => {
    if (!grado) {
      setMaya([]);
      setResumen(null);
      return;
    }
    setLoading(true);
    setError(null);

    const [mallaRes, resumenRes] = await Promise.allSettled([
      academicServicesApi.getMalla(nivel, grado),
      academicServicesApi.getResumenMalla(nivel, grado),
    ]);

    if (mallaRes.status === 'fulfilled') setMaya(mallaRes.value ?? []);
    else {
      setMaya([]);
      setError('No se pudo cargar la maya curricular de este grado.');
    }

    if (resumenRes.status === 'fulfilled') setResumen(resumenRes.value ?? null);

    setLoading(false);
  }, [nivel, grado]);

  useEffect(() => {
    void cargarGrados();
  }, [cargarGrados]);

  // Llegar desde la tarjeta de un grado debe abrir ese grado, no el primero.
  useEffect(() => {
    if (gradoInicial) setGrado(gradoInicial);
  }, [gradoInicial]);

  useEffect(() => {
    setMateriaAbierta(null);
    setBorradores([]);
    void cargarMalla();
  }, [cargarMalla]);

  // Cualquier escritura en grados o materias obliga a recargar la maya.
  useRealtimeResource('grados', () => {
    void cargarGrados();
    void cargarMalla();
  });
  useRealtimeResource('malla', () => {
    void cargarMalla();
  });

  const abrirMateria = (materiaId: string, temas: TemaMalla[]) => {
    setMateriaAbierta(materiaId);
    setBorradores(temas.map(aBorrador));
  };

  const guardar = async () => {
    if (!materiaAbierta) return;
    const limpios = borradores.filter((b) => b.titulo.trim());
    const sinTitulo = borradores.length - limpios.length;
    if (sinTitulo > 0) {
      setError('Hay temas sin título. Completalos o quitalos antes de guardar.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await academicServicesApi.guardarMallaMateria(
        nivel,
        grado,
        materiaAbierta,
        limpios.map((b, indice) => ({
          id: b.id,
          titulo: b.titulo.trim(),
          contenidos: b.contenidos.trim() || null,
          horasPrevistas: Number(b.horasPrevistas) || 1,
          esEvaluacion: b.esEvaluacion,
          // Cada tema cierra su propia unidad salvo que se indique otra.
          unidad: indice + 1,
        })),
      );
      setBorradores([]);
      await cargarMalla();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el temario');
    } finally {
      setGuardando(false);
    }
  };

  const gradesOrdenados = useMemo(
    () =>
      maya
        .slice()
        .sort((a, b) => a.materia.nombre.localeCompare(b.materia.nombre)),
    [maya],
  );

  const sinMaterias = maya.length === 0;

  return (
    <View className="gap-4 min-w-0">
      <BentoCard className="p-5">
        <View className="flex-row items-center gap-2">
          <Ionicons name="map-outline" size={20} color="#801529" />
          <Text className="text-lg font-bold text-gray-900">Maya curricular</Text>
        </View>
        <Text className="text-sm text-gray-500 mt-1">
          Elegí el grado y definí, materia por materia, los temas que se trabajarán. Es
          reutilizable: 1°A y 1°B comparten el mismo temario y sirve para todas las gestión.
        </Text>

        {/* Nivel */}
        <View className="mt-4">
          <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">Nivel</Text>
          <View className="flex-row flex-wrap gap-2">
            {(['primaria', 'secundaria'] as const).map((opcion) => {
              const activo = nivel === opcion;
              return (
                <TouchableOpacity
                  key={opcion}
                  onPress={() => setNivel(opcion)}
                  className={`flex-1 min-w-[130px] rounded-2xl border-2 px-4 py-3 ${
                    activo ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${activo ? 'text-white' : 'text-gray-800'}`}
                  >
                    {NIVEL_LABEL[opcion]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Grado */}
        <View className="mt-4">
          <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">Grado</Text>
          {gradosDisponibles.length === 0 ? (
            <Text className="text-xs text-gray-500">
              Este nivel todavía no tiene cursos creados.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {gradosDisponibles.map(({ grado: opcion, conMaterias }) => {
                  const activo = grado === opcion;
                  return (
                    <TouchableOpacity
                      key={opcion}
                      onPress={() => setGrado(opcion)}
                      className={`px-4 py-2.5 rounded-xl border flex-row items-center gap-1.5 ${
                        activo ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${activo ? 'text-white' : 'text-gray-700'}`}
                      >
                        {opcion}
                      </Text>
                      {!conMaterias ? (
                        <Ionicons
                          name="warning"
                          size={12}
                          color={activo ? '#FFD700' : '#B45309'}
                        />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </BentoCard>

      {error ? (
        <Alert tone="danger" message={error} />
      ) : null}

      {loading ? (
        <BentoCard className="p-10 items-center">
          <ActivityIndicator color="#801529" size="large" />
          <Text className="text-xs text-gray-500 mt-3 font-medium">Cargando la maya curricular…</Text>
        </BentoCard>
      ) : sinMaterias ? (
        <BentoCard className="p-6 items-center">
          <Ionicons name="alert-circle-outline" size={38} color="#B45309" />
          <Text className="text-base font-bold text-gray-800 mt-2 text-center">
            {grado} todavía no tiene materias
          </Text>
          <Text className="text-xs text-gray-500 mt-1 text-center">
            Asignale las materias en la pestaña Materias y volvé acá para cargar los temas.
          </Text>
        </BentoCard>
      ) : (
        <>
          {resumen ? (
            <View className="flex-row flex-wrap -mx-1.5">
              <KpiCard
                label="Materias con temario"
                value={`${resumen.conTemas}/${resumen.materias}`}
                icon="book-outline"
              />
              <KpiCard label="Temas definidos" value={String(resumen.totalTemas)} icon="list-outline" />
              <KpiCard label="Horas previstas" value={String(resumen.horasPrevistas)} icon="time-outline" />
            </View>
          ) : null}

          {gradesOrdenados.map(({ materia, temas }) => {
            const abierto = materiaAbierta === materia.materiaId;
            const horas = temas.reduce((acc, t) => acc + (t.horasPrevistas ?? 0), 0);

            return (
              <BentoCard key={materia.materiaId} className="p-4">
                <TouchableOpacity
                  onPress={() =>
                    abierto ? setMateriaAbierta(null) : abrirMateria(materia.materiaId, temas)
                  }
                  className="flex-row items-center justify-between gap-3"
                >
                  <View className="flex-1 min-w-0">
                    <Text className="text-[9px] font-bold text-gray-400 font-mono">
                      {materia.codigo}
                    </Text>
                    <Text className="text-sm font-bold text-gray-900 mt-0.5" numberOfLines={2}>
                      {materia.nombre}
                    </Text>
                    <Text className="text-[10px] text-gray-500 mt-1">
                      {temas.length === 0
                        ? 'Sin temas cargados'
                        : `${temas.length} ${temas.length === 1 ? 'tema' : 'temas'} · ${horas} h previstas`}
                      {materia.tipoMateria === 'extracurricular' ? ' · extracurricular' : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={abierto ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#801529"
                  />
                </TouchableOpacity>

                {abierto ? (
                  <View className="mt-4 pt-4 border-t border-gray-100 gap-2">
                    {borradores.length === 0 ? (
                      <Text className="text-xs text-gray-500 italic">
                        Todavía no hay temas. Agregá el primero.
                      </Text>
                    ) : null}

                    {borradores.map((borrador, indice) => (
                      <View
                        key={borrador.id ?? `nuevo-${indice}`}
                        className="bg-gray-50 border border-gray-200 rounded-2xl p-3 gap-2"
                      >
                        <View className="flex-row items-center gap-2">
                          <View className="w-7 h-7 rounded-full bg-maroon items-center justify-center">
                            <Text className="text-[11px] font-bold text-white">{indice + 1}</Text>
                          </View>
                          <Text className="flex-1 text-[10px] font-bold text-gray-500 uppercase">
                            Unidad {indice + 1}
                          </Text>
                          {canEdit ? (
                            <TouchableOpacity
                              onPress={() =>
                                setBorradores((prev) => prev.filter((_, i) => i !== indice))
                              }
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              accessibilityLabel="Quitar tema"
                              className="w-7 h-7 rounded-full bg-red-600 items-center justify-center"
                            >
                              <Ionicons name="close" size={15} color="#FFFFFF" />
                            </TouchableOpacity>
                          ) : null}
                        </View>

                        <TextField
                          label="Tema"
                          value={borrador.titulo}
                          onChangeText={(v) =>
                            setBorradores((prev) =>
                              prev.map((b, i) => (i === indice ? { ...b, titulo: v } : b))
                            )
                          }
                          placeholder="Título del tema"
                          editable={canEdit}
                        />
                        <TextField
                          label="Contenidos"
                          value={borrador.contenidos}
                          onChangeText={(v) =>
                            setBorradores((prev) =>
                              prev.map((b, i) => (i === indice ? { ...b, contenidos: v } : b))
                            )
                          }
                          placeholder="Qué se trabaja en este tema"
                          multiline
                          editable={canEdit}
                        />
                        <View className="flex-row flex-wrap items-end gap-2">
                          <TextField
                            containerClassName="w-24"
                            label="Horas"
                            value={borrador.horasPrevistas}
                            onChangeText={(v) =>
                              setBorradores((prev) =>
                                prev.map((b, i) =>
                                  i === indice
                                    ? { ...b, horasPrevistas: v.replace(/[^0-9]/g, '') }
                                    : b
                                )
                              )
                            }
                            keyboardType="numeric"
                            editable={canEdit}
                          />
                          <TouchableOpacity
                            onPress={() =>
                              setBorradores((prev) =>
                                prev.map((b, i) =>
                                  i === indice ? { ...b, esEvaluacion: !b.esEvaluacion } : b
                                )
                              )
                            }
                            disabled={!canEdit}
                            className={`flex-1 min-w-[150px] rounded-xl px-3 py-3 flex-row items-center gap-2 ${
                              borrador.esEvaluacion ? 'bg-green-100' : 'bg-gray-100'
                            }`}
                          >
                            <Ionicons
                              name={borrador.esEvaluacion ? 'checkbox' : 'square-outline'}
                              size={18}
                              color={borrador.esEvaluacion ? '#15803D' : '#9CA3AF'}
                            />
                            <Text
                              className={`text-xs font-bold ${
                                borrador.esEvaluacion ? 'text-green-800' : 'text-gray-500'
                              }`}
                            >
                              Evaluación
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    {canEdit ? (
                      <View className="flex-row flex-wrap gap-2 mt-1">
                        <Button
                          label="Agregar tema"
                          icon="add"
                          size="sm"
                          variant="secondary"
                          onPress={() => setBorradores((prev) => [...prev, borradorVacio()])}
                        />
                        <Button
                          label={guardando ? 'Guardando…' : 'Guardar temario'}
                          icon="checkmark"
                          size="sm"
                          loading={guardando}
                          onPress={guardar}
                        />
                      </View>
                    ) : (
                      <Text className="text-[11px] text-gray-500 mt-1">
                        Sólo dirección, control y docentes pueden modificar el temario.
                      </Text>
                    )}
                  </View>
                ) : null}
              </BentoCard>
            );
          })}
        </>
      )}
    </View>
  );
}