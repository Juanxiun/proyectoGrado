import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  academicServicesApi,
  type MateriaDelGrado,
  type NivelEducativo,
} from '../../../api/academicServices.api';
import { NIVEL_LABEL } from '../utils/niveles';
import { Alert, Button, TextField } from '../../../shared/ui';

type Item = Record<string, any>;

/** Anchos de columna. En móvil dos, y se abren al ensanchar la pantalla. */
const COLS = 'w-1/2 md:w-1/3 lg:w-1/5';
const VISIBLES_POR_SECCION = 15;

/** Encabezado de sección: separa los bloques para que no se lean mezclados. */
function Seccion({
  titulo,
  cantidad,
  tono = 'maroon',
}: {
  titulo: string;
  cantidad: number;
  tono?: 'maroon' | 'gray';
}) {
  const barra = tono === 'maroon' ? 'bg-maroon' : 'bg-gray-300';
  const texto = tono === 'maroon' ? 'text-maroon' : 'text-gray-500';

  return (
    <View className="flex-row items-center gap-2 mb-2">
      <View className={`w-1 h-4 rounded-full ${barra}`} />
      <Text className={`text-[11px] font-bold uppercase tracking-wider ${texto}`}>
        {titulo}
      </Text>
      <Text className="text-[11px] text-gray-400 font-semibold">({cantidad})</Text>
    </View>
  );
}

/** Agrupa por tipo para que principales y extracurriculares no se mezclen. */
function porTipo<T extends { tipoMateria: string }>(items: T[]) {
  return {
    principales: items.filter((m) => m.tipoMateria !== 'extracurricular'),
    extracurriculares: items.filter((m) => m.tipoMateria === 'extracurricular'),
  };
}

/**
 * Materias que se cursan en un GRADO, no en un paralelo.
 *
 * 1°A y 1°B cursan exactamente lo mismo, así que la materia se configura una
 * sola vez por grado y la interfaz la muestra como un bloque único con todos
 * sus paralelos adentro. Un grado sin materias queda fuera de la gestión, y por
 * eso se avisa con una advertencia.
 */
export function MateriasGradoModal({
  visible,
  grado,
  paralelos,
  canEdit,
  onClose,
  onChanged,
}: {
  visible: boolean;
  grado: { nivel: NivelEducativo; grado: string } | null;
  /** Se muestra como contexto: el grado es uno solo, esto son sus paralelos. */
  paralelos?: string[];
  canEdit: boolean;
  onClose: () => void;
  /** Avisa al listado para que refresque el contador y la advertencia. */
  onChanged?: () => void;
}) {
  const [asignadas, setAsignadas] = useState<MateriaDelGrado[]>([]);
  const [catalogo, setCatalogo] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegistro, setShowRegistro] = useState(false);
  const [verTodo, setVerTodo] = useState(false);
  const [nueva, setNueva] = useState({ codigo: '', nombre: '', cargaHorariaSemanal: '2' });

  const nivel = grado?.nivel;
  const nombreGrado = grado?.grado;

  /**
   * Las dos listas se piden por separado y a propósito: si una falla, la otra
   * sigue mostrándose. Con un Promise.all un 404 en cualquiera de las dos
   * dejaba el modal entero en blanco.
   */
  const cargar = useCallback(async () => {
    if (!nivel || !nombreGrado) return;
    setLoading(true);
    setError(null);

    const fallos: string[] = [];

    const [propias, todas] = await Promise.allSettled([
      academicServicesApi.gradoMaterias(nivel, nombreGrado),
      academicServicesApi.list('materias', { activo: 'true', limit: 200 }),
    ]);

    if (propias.status === 'fulfilled') {
      setAsignadas(propias.value ?? []);
    } else {
      setAsignadas([]);
      fallos.push('las materias del grado');
    }

    if (todas.status === 'fulfilled') {
      setCatalogo(todas.value?.data ?? []);
    } else {
      setCatalogo([]);
      fallos.push('el catálogo de materias');
    }

    if (fallos.length > 0) {
      setError(
        `No se pudo cargar ${fallos.join(' ni ')}. Verificá la conexión y presioná Actualizar.`,
      );
    }

    setLoading(false);
  }, [nivel, nombreGrado]);

  useEffect(() => {
    if (visible) {
      setShowRegistro(false);
      setVerTodo(false);
      setNueva({ codigo: '', nombre: '', cargaHorariaSemanal: '2' });
      void cargar();
    }
  }, [visible, cargar]);

  const agregar = async (materiaId: string) => {
    if (!nivel || !nombreGrado) return;
    setSaving(true);
    setError(null);
    try {
      setAsignadas(await academicServicesApi.agregarMateriaGrado(nivel, nombreGrado, { materiaId }));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar la materia');
    } finally {
      setSaving(false);
    }
  };

  const quitar = async (materiaId: string) => {
    if (!nivel || !nombreGrado) return;
    setSaving(true);
    setError(null);
    try {
      setAsignadas(await academicServicesApi.quitarMateriaGrado(nivel, nombreGrado, materiaId));
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar la materia');
    } finally {
      setSaving(false);
    }
  };

  const registrarMateria = async () => {
    if (!nueva.codigo.trim() || !nueva.nombre.trim()) {
      setError('El código y el nombre son obligatorios');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await academicServicesApi.create('materias', {
        codigo: nueva.codigo.trim(),
        nombre: nueva.nombre.trim(),
        tipoMateria: 'principal',
        cargaHorariaSemanal: Number(nueva.cargaHorariaSemanal) || 2,
        pesoSintactico: 3,
        activo: true,
      });
      setShowRegistro(false);
      setNueva({ codigo: '', nombre: '', cargaHorariaSemanal: '2' });
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la materia');
    } finally {
      setSaving(false);
    }
  };

  if (!visible || !grado || !nivel || !nombreGrado) return null;

  const yaAsignadas = new Set(asignadas.map((m) => m.materiaId));
  const candidatas = catalogo.filter((m) => !yaAsignadas.has(String(m.id)));

  const asignadasPorTipo = porTipo(asignadas);
  const candidatasPorTipo = porTipo(
    candidatas.map((m) => ({ ...m, tipoMateria: m.tipoMateria ?? 'principal' })),
  );

  const listaParalelos = (paralelos ?? []).map((p) => String(p).toUpperCase());
  const tituloParalelos = listaParalelos.length > 0
    ? `Paralelos ${listaParalelos.join(' y ')}`
    : 'Sin paralelos';

  const CuadriculaAsignadas = ({ items, tipo }: { items: MateriaDelGrado[]; tipo: string }) => {
    if (items.length === 0) return null;
    const visibles = verTodo ? items : items.slice(0, VISIBLES_POR_SECCION);
    const ocultas = items.length - visibles.length;

    return (
      <View className="mb-5">
        <Seccion titulo={tipo} cantidad={items.length} />
        <View className="flex-row flex-wrap -mx-1">
          {visibles.map((materia) => (
            <View key={materia.materiaId} className={`${COLS} p-1`}>
              <View className="bg-white border border-gray-200 rounded-xl p-2.5 h-full">
                <View className="flex-row items-start justify-between gap-1">
                  <Text className="text-[9px] font-bold text-gray-400 font-mono" numberOfLines={1}>
                    {materia.codigo}
                  </Text>
                  {canEdit ? (
                    <TouchableOpacity
                      onPress={() => quitar(materia.materiaId)}
                      disabled={saving}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityLabel={`Quitar ${materia.nombre}`}
                      className="w-6 h-6 rounded-full bg-red-600 items-center justify-center"
                    >
                      <Ionicons name="close" size={15} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text className="text-[11px] font-bold text-gray-800 mt-1" numberOfLines={2}>
                  {materia.nombre}
                </Text>
                <Text className="text-[10px] text-gray-500 mt-1">
                  {materia.cargaHorariaSemanal} h/sem
                </Text>
              </View>
            </View>
          ))}
        </View>
        {ocultas > 0 ? (
          <TouchableOpacity onPress={() => setVerTodo(true)} className="mt-1 self-start">
            <Text className="text-[11px] font-bold text-maroon">
              Ver las {ocultas} restantes
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const CuadriculaCatalogo = ({ items, tipo }: { items: Item[]; tipo: string }) => {
    if (items.length === 0) return null;
    const visibles = verTodo ? items : items.slice(0, VISIBLES_POR_SECCION);
    const ocultas = items.length - visibles.length;

    return (
      <View className="mb-4">
        <Seccion titulo={`${tipo} por agregar`} cantidad={items.length} tono="gray" />
        <View className="flex-row flex-wrap -mx-1">
          {visibles.map((materia) => (
            <View key={String(materia.id)} className={`${COLS} p-1`}>
              <View className="bg-white border border-dashed border-maroon/40 rounded-xl p-2.5 h-full">
                <Text className="text-[9px] font-bold text-gray-400 font-mono" numberOfLines={1}>
                  {materia.codigo}
                </Text>
                <Text className="text-[11px] font-bold text-gray-800 mt-1" numberOfLines={2}>
                  {materia.nombre}
                </Text>
                <Text className="text-[10px] text-gray-500 mt-1">
                  {materia.cargaHorariaSemanal ?? '—'} h/sem
                </Text>
                <Button
                  label="Agregar"
                  icon="add"
                  size="sm"
                  className="mt-2"
                  disabled={saving}
                  onPress={() => agregar(String(materia.id))}
                />
              </View>
            </View>
          ))}
        </View>
        {ocultas > 0 ? (
          <TouchableOpacity onPress={() => setVerTodo(true)} className="mt-1 self-start">
            <Text className="text-[11px] font-bold text-maroon">
              Ver las {ocultas} restantes
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
        <View className="bg-white rounded-3xl w-full max-w-4xl max-h-[88vh] overflow-hidden shadow-2xl flex-col">
          {/* Cabecera */}
          <View className="p-4 md:p-5 bg-maroon flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                Materias del grado
              </Text>
              <Text className="text-base md:text-lg font-bold mt-0.5 text-white" numberOfLines={1}>
                {nombreGrado} · {NIVEL_LABEL[nivel] ?? nivel}
              </Text>
              <Text className="text-xs text-white/80 mt-1">
                {tituloParalelos} ·{' '}
                {asignadas.length === 0
                  ? 'sin materias: este grado no se cargará a la próxima gestión.'
                  : `${asignadas.length} ${
                      asignadas.length === 1 ? 'materia asignada' : 'materias asignadas'
                    }, comunes a todos los paralelos`}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <TouchableOpacity
                onPress={() => void cargar()}
                disabled={loading}
                accessibilityLabel="Actualizar"
                className="w-9 h-9 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons
                  name="refresh"
                  size={17}
                  color="#FFFFFF"
                  style={loading ? { transform: [{ rotate: '90deg' }] } : undefined}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                accessibilityLabel="Cerrar"
                className="w-9 h-9 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* El cuerpo tiene scroll propio: nunca desborda la pantalla. */}
          <ScrollView className="flex-1" contentContainerClassName="p-4 md:p-5">
            {error ? (
              <View className="mb-4">
                <Alert tone="danger" message={error} />
              </View>
            ) : null}

            {loading && asignadas.length === 0 && catalogo.length === 0 ? (
              <View className="py-10 items-center">
                <ActivityIndicator color="#801529" size="large" />
                <Text className="text-sm text-gray-500 mt-2">Cargando materias…</Text>
              </View>
            ) : (
              <>
                {/* ── Materias asignadas ── */}
                {asignadas.length === 0 ? (
                  <View className="mb-5">
                    <Seccion titulo="Asignadas" cantidad={0} tono="gray" />
                    <View className="bg-red-600 rounded-2xl p-4 flex-row items-start gap-3">
                      <Ionicons name="warning" size={24} color="#FFFFFF" />
                      <View className="flex-1">
                        <Text className="text-base font-bold text-white">
                          Faltan las materias de {nombreGrado}
                        </Text>
                        <Text className="text-[15px] text-white leading-5 mt-1">
                          Al generar una gestión escolar sólo se cargan los grados que ya tengan al
                          menos una materia. Agregá una desde el catálogo de abajo.
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <>
                    <CuadriculaAsignadas
                      items={asignadasPorTipo.principales}
                      tipo="Materias principales"
                    />
                    <CuadriculaAsignadas
                      items={asignadasPorTipo.extracurriculares}
                      tipo="Extracurriculares"
                    />
                  </>
                )}

                {verTodo ? (
                  <TouchableOpacity onPress={() => setVerTodo(false)} className="mb-4 self-start">
                    <Text className="text-[11px] font-bold text-gray-500">
                      Ver menos (volver a {VISIBLES_POR_SECCION} por sección)
                    </Text>
                  </TouchableOpacity>
                ) : null}

                {/* ── Catálogo ── */}
                {canEdit ? (
                  <View className="pt-4 border-t border-gray-100">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-sm font-bold text-gray-900">
                        Agregar del catálogo ({candidatas.length})
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowRegistro((prev) => !prev)}
                        className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-lg bg-maroon/10"
                      >
                        <Ionicons
                          name={showRegistro ? 'close' : 'add-circle-outline'}
                          size={14}
                          color="#801529"
                        />
                        <Text className="text-[11px] font-bold text-maroon">
                          {showRegistro ? 'Cancelar' : 'Registrar materia nueva'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showRegistro ? (
                      <View className="bg-gray-50 border border-gray-200 rounded-2xl p-3 gap-2 mb-4">
                        <View className="flex-row flex-wrap gap-2">
                          <TextField
                            containerClassName="flex-1 min-w-[110px]"
                            label="Código"
                            value={nueva.codigo}
                            onChangeText={(v) => setNueva((n) => ({ ...n, codigo: v }))}
                            placeholder="MAT-501"
                            autoCapitalize="characters"
                          />
                          <TextField
                            containerClassName="flex-[2] min-w-[150px]"
                            label="Nombre"
                            value={nueva.nombre}
                            onChangeText={(v) => setNueva((n) => ({ ...n, nombre: v }))}
                            placeholder="Nombre de la materia"
                          />
                          <TextField
                            containerClassName="w-20"
                            label="h/sem"
                            value={nueva.cargaHorariaSemanal}
                            onChangeText={(v) =>
                              setNueva((n) => ({
                                ...n,
                                cargaHorariaSemanal: v.replace(/[^0-9]/g, ''),
                              }))
                            }
                            keyboardType="numeric"
                            maxLength={2}
                          />
                        </View>
                        <Button
                          label="Registrar materia"
                          icon="checkmark"
                          size="sm"
                          loading={saving}
                          onPress={registrarMateria}
                        />
                      </View>
                    ) : null}

                    {candidatas.length === 0 ? (
                      <Text className="text-sm text-gray-500">
                        No quedan materias por asignar. Usá "Registrar materia nueva" para crear
                        otra.
                      </Text>
                    ) : (
                      <>
                        <CuadriculaCatalogo
                          items={candidatasPorTipo.principales}
                          tipo="Principales"
                        />
                        <CuadriculaCatalogo
                          items={candidatasPorTipo.extracurriculares}
                          tipo="Extracurriculares"
                        />
                      </>
                    )}
                  </View>
                ) : (
                  <Text className="text-xs text-gray-500">
                    Sólo dirección y control pueden modificar las materias de un grado.
                  </Text>
                )}
              </>
            )}
          </ScrollView>

          <View className="p-3 md:p-4 bg-gray-50 border-t border-gray-200 flex-row items-center justify-between gap-2">
            <Text className="text-[11px] text-gray-500">
              {asignadas.length} de {catalogo.length} del catálogo asignadas
            </Text>
            <Button
              label={saving ? 'Guardando…' : 'Guardar y cerrar'}
              icon="checkmark"
              loading={saving}
              onPress={() => {
                onChanged?.();
                onClose();
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}