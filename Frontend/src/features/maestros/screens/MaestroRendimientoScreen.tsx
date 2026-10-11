import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { seguimientoApi, type NivelRiesgo, type PanelCurso, type PanelEstudiante } from '../../../api/seguimiento.api';
import { BentoCard, StatusBadge, UserAvatar } from '../../../shared/ui';
import { useResponsive } from '../../../utils/responsive';
import { PanelCursoRendimiento } from '../../../features/academico/components/PanelCursoRendimiento';
import { PanelEstudianteRendimiento } from '../../../features/academico/components/PanelEstudianteRendimiento';

type Periodo = { id: string; nombre: string; anio: number; activo: boolean; estado: string };

type Vista = 'cursos' | 'curso' | 'estudiante';

interface CursoAsignado {
  cursoPeriodoId: string;
  grado: string;
  paralelo: string;
  nivel: string;
  anio?: string | number;
  materias: { id: string; nombre: string; asignacionId: string }[];
}

interface ResumenEstudiante {
  estudianteId: string;
  nombre: string;
  apellidoPaterno: string;
  promedio: number | null;
  asistencia: number | null;
  nivelRiesgo: NivelRiesgo;
}

const TRIMESTRES = [1, 2, 3] as const;

const ORDEN_RIESGO: NivelRiesgo[] = ['riesgo_alto', 'riesgo', 'observacion', 'sin_riesgo'];

function promediar(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100;
}

/**
 * Panel de rendimiento docente: muestra cursos asignados y permite
 * navegar al detalle de rendimiento por curso y por estudiante.
 * Reutiliza la lógica de seguimientoApi y componentes de académico.
 */
export function MaestroRendimientoScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoId, setPeriodoId] = useState('');
  const [trimestre, setTrimestre] = useState<number>(1);

  const [cursos, setCursos] = useState<CursoAsignado[]>([]);
  const [cursosLoading, setCursosLoading] = useState(false);

  const [cursoPeriodoId, setCursoPeriodoId] = useState('');
  const [panel, setPanel] = useState<PanelCurso | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [estudiantes, setEstudiantes] = useState<ResumenEstudiante[]>([]);

  const [estudianteId, setEstudianteId] = useState('');
  const [panelEstudiante, setPanelEstudiante] = useState<PanelEstudiante | null>(null);
  const [estudianteLoading, setEstudianteLoading] = useState(false);

  const [vista, setVista] = useState<Vista>('cursos');

  // ── Cargar gestiones académicas ──────────────────────────────────────────────
  useEffect(() => {
    academicServicesApi
      .list('periodos', { limit: 50 })
      .then((res) => {
        const items = (res.data ?? []) as unknown as Periodo[];
        setPeriodos(items);
        setPeriodoId((actual) => {
          if (actual && items.some((p) => String(p.id) === actual)) return actual;
          const anio = new Date().getFullYear();
          const activa = items.find((p) => p.activo)
            ?? items.find((p) => p.anio === anio)
            ?? items[0];
          return activa ? String(activa.id) : '';
        });
      })
      .catch(() => setPeriodos([]));
  }, []);

  // ── Cargar cursos asignados al docente autenticado ───────────────────────────
  const cargarCursosAsignados = useCallback(async () => {
    if (!periodoId || !user) {
      setCursos([]);
      return;
    }
    setCursosLoading(true);
    try {
      const res = await academicServicesApi.list('asignaciones', { limit: 200 });
      const allAsignaciones = res.data as any[];

      // Filtrar por el maestro autenticado
      const teacherAsignaciones = allAsignaciones.filter((asig) => {
        const m = asig.maestro;
        if (!m) return true; // Fallback seguro
        if (user.maestroId && String(asig.maestroId) === String(user.maestroId)) return true;
        if (String(m.usuarioId) === String(user.id)) return true;
        if (
          user.nombre &&
          m.nombre &&
          String(m.nombre).toLowerCase() === user.nombre.toLowerCase() &&
          String(m.apellidoPaterno ?? '').toLowerCase() === (user.apellidoPaterno ?? '').toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      // Filtrar solo los del período seleccionado
      const asignacionesPeriodo = teacherAsignaciones.filter((a) =>
        String(a.cursoPeriodoId) === String(periodoId) ||
        String(a.cursoPeriodo?.id) === String(periodoId)
      );

      // Agrupar por cursoPeriodoId
      const map = new Map<string, CursoAsignado>();

      for (const item of asignacionesPeriodo) {
        const cpId = String(item.cursoPeriodoId || item.cursoPeriodo?.id || 'sin-id');
        const cursoInfo = item.cursoPeriodo?.curso || {};
        const grado = cursoInfo.grado || item.grado || '1';
        const paralelo = cursoInfo.paralelo || item.paralelo || 'A';
        const nivel = cursoInfo.nivel || item.nivel || 'Secundaria';
        const anio = item.cursoPeriodo?.periodo?.anio || item.periodo?.anio || new Date().getFullYear();

        const materiaNombre = item.materia?.nombre || item.materiaNombre || 'Materia';
        const materiaId = String(item.materia?.id || item.materiaId || '0');
        const asignacionId = String(item.id || '0');

        if (!map.has(cpId)) {
          map.set(cpId, {
            cursoPeriodoId: cpId,
            grado,
            paralelo,
            nivel,
            anio,
            materias: [],
          });
        }

        const current = map.get(cpId)!;
        if (!current.materias.some((m) => m.id === materiaId)) {
          current.materias.push({ id: materiaId, nombre: materiaNombre, asignacionId });
        }
      }

      setCursos(Array.from(map.values()));
    } catch (err) {
      console.error('Error cargando cursos asignados:', err);
      setCursos([]);
    } finally {
      setCursosLoading(false);
    }
  }, [periodoId, user?.id]);

  useEffect(() => {
    void cargarCursosAsignados();
  }, [cargarCursosAsignados]);

  // ── Panel del curso (rendimiento grupal) ─────────────────────────────────────
  const cargarPanelCurso = useCallback(async () => {
    if (!cursoPeriodoId) return;
    setPanelLoading(true);
    try {
      const data = await seguimientoApi.panelCurso({ cursoPeriodoId, trimestre });
      setPanel(data);
    } catch {
      setPanel(null);
    } finally {
      setPanelLoading(false);
    }
  }, [cursoPeriodoId, trimestre]);

  useEffect(() => {
    if (vista === 'curso' || vista === 'estudiante') void cargarPanelCurso();
  }, [cargarPanelCurso, vista]);

  // ── Resumen por estudiante (armado desde libros de cada materia) ─────────────
  useEffect(() => {
    if (vista !== 'curso' || !panel) return;
    let cancelado = false;

    (async () => {
      const libros = await Promise.all(
        panel.materias.map((materia) =>
          seguimientoApi
            .libro({ cursoPeriodoId, materiaId: materia.materiaId, trimestre })
            .catch(() => null),
        ),
      );
      if (cancelado) return;

      const resumen = new Map<string, ResumenEstudiante & { promedios: number[]; tasas: number[]; niveles: NivelRiesgo[] }>();

      for (const libro of libros) {
        for (const linea of libro?.lineas ?? []) {
          const actual = resumen.get(linea.estudianteId) ?? {
            estudianteId: linea.estudianteId,
            nombre: linea.nombre,
            apellidoPaterno: linea.apellidoPaterno,
            promedio: null,
            asistencia: null,
            nivelRiesgo: 'sin_riesgo' as NivelRiesgo,
            promedios: [],
            tasas: [],
            niveles: [],
          };
          if (linea.promedio !== null) actual.promedios.push(linea.promedio);
          if (linea.asistencia.tasa !== null) actual.tasas.push(linea.asistencia.tasa);
          actual.niveles.push(linea.nivelRiesgo);
          resumen.set(linea.estudianteId, actual);
        }
      }

      setEstudiantes(
        [...resumen.values()]
          .map((item) => ({
            estudianteId: item.estudianteId,
            nombre: item.nombre,
            apellidoPaterno: item.apellidoPaterno,
            promedio: promediar(item.promedios),
            asistencia: promediar(item.tasas),
            nivelRiesgo:
              ORDEN_RIESGO.find((nivel) => item.niveles.includes(nivel)) ?? 'sin_riesgo',
          }))
          .sort(
            (a, b) =>
              ORDEN_RIESGO.indexOf(a.nivelRiesgo) - ORDEN_RIESGO.indexOf(b.nivelRiesgo),
          ),
      );
    })().catch(() => {
      if (!cancelado) setEstudiantes([]);
    });

    return () => {
      cancelado = true;
    };
  }, [panel, trimestre, cursoPeriodoId, vista]);

  // ── Panel del estudiante individual ──────────────────────────────────────────
  const cargarEstudiante = useCallback(async () => {
    if (!estudianteId || !periodoId) return;
    setEstudianteLoading(true);
    try {
      setPanelEstudiante(
        await seguimientoApi.panelEstudiante({ estudianteId, periodoId, trimestre }),
      );
    } catch {
      setPanelEstudiante(null);
    } finally {
      setEstudianteLoading(false);
    }
  }, [estudianteId, periodoId, trimestre]);

  useEffect(() => {
    if (vista === 'estudiante') void cargarEstudiante();
  }, [cargarEstudiante, vista]);

  // ── Navegación ───────────────────────────────────────────────────────────────
  const cursoSeleccionado = useMemo(
    () => cursos.find((c) => String(c.cursoPeriodoId) === cursoPeriodoId) ?? null,
    [cursos, cursoPeriodoId],
  );

  const abrirCurso = (id: string) => {
    setCursoPeriodoId(id);
    setEstudianteId('');
    setPanelEstudiante(null);
    setVista('curso');
  };

  const abrirEstudiante = (id: string) => {
    setEstudianteId(id);
    setVista('estudiante');
  };

  const volver = () => {
    if (vista === 'estudiante') {
      setVista('curso');
      return;
    }
    setCursoPeriodoId('');
    setPanel(null);
    setEstudiantes([]);
    setVista('cursos');
  };

  const periodo = periodos.find((p) => String(p.id) === periodoId);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-10">
      {/* Selector de gestión y trimestre */}
      <BentoCard className="p-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="briefcase-outline" size={16} color="#801529" />
          <Text className="text-xs font-bold text-gray-700 uppercase">Gestión académica</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {periodos.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => {
                  setPeriodoId(String(item.id));
                  setCursoPeriodoId('');
                  setVista('cursos');
                }}
                className={`px-3 py-2 rounded-xl border ${
                  periodoId === String(item.id)
                    ? 'bg-maroon border-maroon'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    periodoId === String(item.id) ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {item.nombre}
                  {item.activo ? ' ★' : ''}
                </Text>
                <Text
                  className={`text-[10px] ${
                    periodoId === String(item.id) ? 'text-white/70' : 'text-gray-400'
                  }`}
                >
                  {item.anio}
                </Text>
              </TouchableOpacity>
            ))}
            {periodos.length === 0 ? (
              <Text className="text-xs text-gray-500 py-2">Sin gestionarías registradas.</Text>
            ) : null}
          </View>
        </ScrollView>

        <View className="flex-row items-center gap-2 pt-2 mt-2 border-t border-gray-100">
          <Text className="text-xs font-bold text-gray-600">Trimestre</Text>
          <View className="flex-1 flex-row bg-gray-100 rounded-lg p-0.5">
            {TRIMESTRES.map((numero) => (
              <TouchableOpacity
                key={numero}
                onPress={() => setTrimestre(numero)}
                className={`flex-1 py-1.5 rounded-md ${trimestre === numero ? 'bg-maroon' : ''}`}
              >
                <Text
                  className={`text-xs font-bold text-center ${
                    trimestre === numero ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {numero}°
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BentoCard>

      {/* Migas de pan */}
      <View className="flex-row items-center gap-1 flex-wrap">
        <Miga
          label={periodo ? periodo.nombre : 'Gestión'}
          activo={vista === 'cursos'}
          onPress={() => setVista('cursos')}
        />
        {cursoSeleccionado ? (
          <>
            <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
            <Miga
              label={`${cursoSeleccionado.grado}° "${cursoSeleccionado.paralelo}" · ${cursoSeleccionado.nivel}`}
              activo={vista === 'curso'}
              onPress={() => setEstudianteId('')}
            />
          </>
        ) : null}
        {panelEstudiante ? (
          <>
            <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
            <Miga
              label={`${panelEstudiante.nombre} ${panelEstudiante.apellidoPaterno}`}
              activo={vista === 'estudiante'}
              onPress={() => undefined}
            />
          </>
        ) : null}
      </View>

      {/* Contenido según la vista */}
      {vista === 'cursos' && (
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-gray-900">Mis Cursos y Paralelos</Text>
            {cursos.length > 0 && (
              <StatusBadge label={`${cursos.length} cursos`} variant="info" />
            )}
          </View>

          {cursosLoading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#801529" />
              <Text className="text-gray-500 text-sm mt-3">Cargando cursos asignados...</Text>
            </View>
          ) : cursos.length === 0 ? (
            <BentoCard className="p-8 items-center justify-center text-center">
              <Ionicons name="school-outline" size={48} color="#D1D5DB" />
              <Text className="text-lg font-bold text-gray-700 mt-3">No tienes cursos asignados</Text>
              <Text className="text-sm text-gray-400 mt-1 max-w-sm text-center">
                No se encontraron asignaciones docentes para tu cuenta en el período seleccionado.
              </Text>
            </BentoCard>
          ) : (
            <View className={`gap-4 ${isMobile ? '' : 'flex-row flex-wrap'}`}>
              {cursos.map((curso) => (
                <TouchableOpacity
                  key={curso.cursoPeriodoId}
                  onPress={() => abrirCurso(curso.cursoPeriodoId)}
                  activeOpacity={0.8}
                >
                  <BentoCard className={`p-5 ${isMobile ? 'w-full' : 'w-[48%]'}`}>
                    <View className="flex-row items-start justify-between">
                      <View className="flex-row items-center gap-3">
                        <View
                          className={`w-12 h-12 rounded-2xl items-center justify-center ${
                            String(curso.nivel).toLowerCase().includes('secundaria')
                              ? 'bg-maroon/10'
                              : 'bg-gold/20'
                          }`}
                        >
                          <Ionicons
                            name="school"
                            size={24}
                            color={String(curso.nivel).toLowerCase().includes('secundaria') ? '#801529' : '#B45309'}
                          />
                        </View>
                        <View>
                          <Text className="text-lg font-bold text-gray-900">
                            {curso.grado}° "{curso.paralelo}"
                          </Text>
                          <Text className="text-xs text-gray-500 capitalize">
                            Nivel {curso.nivel} {curso.anio ? `· Gestión ${curso.anio}` : ''}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                    </View>

                    {/* Materias asignadas en este curso */}
                    <View className="mt-4 pt-3 border-t border-gray-100">
                      <Text className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                        Materias que impartes:
                      </Text>
                      <View className="flex-row flex-wrap gap-1.5">
                        {curso.materias.map((m) => (
                          <View
                            key={m.id}
                            className="bg-gray-100 px-2.5 py-1 rounded-lg flex-row items-center gap-1"
                          >
                            <Ionicons name="book-outline" size={12} color="#801529" />
                            <Text className="text-xs font-medium text-gray-800">{m.nombre}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Indicador rápido de estado */}
                    <View className="mt-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="people-outline" size={16} color="#801529" />
                        <Text className="text-xs text-gray-500">
                          Toca para ver rendimiento
                        </Text>
                      </View>
                      <View className="bg-maroon/10 px-3 py-1.5 rounded-lg">
                        <Text className="text-xs font-bold text-maroon uppercase">Ver detalle</Text>
                      </View>
                    </View>
                  </BentoCard>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {vista === 'curso' && (
        <View className="gap-4">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={volver} className="flex-row items-center gap-1">
              <Ionicons name="arrow-back" size={15} color="#801529" />
              <Text className="text-xs font-bold text-maroon">Volver a los cursos</Text>
            </TouchableOpacity>
            {cursoSeleccionado ? (
              <View className="flex-1 flex-row justify-end">
                <StatusBadge
                  label={`${cursoSeleccionado.grado}° "${cursoSeleccionado.paralelo}"`}
                  variant="info"
                />
              </View>
            ) : null}
          </View>

          {/* Panel de rendimiento del curso - reutiliza componente de académico */}
          <PanelCursoRendimiento panel={panel} loading={panelLoading} />

          {/* Lista de estudiantes con resumen individual */}
          <BentoCard className="p-4">
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-sm font-bold text-gray-900">Estudiantes del curso</Text>
                <Text className="text-xs text-gray-500">Ordenados por nivel de riesgo (mayor a menor)</Text>
              </View>
              <Text className="text-xs font-bold text-gray-500">
                {estudiantes.length} alumnos
              </Text>
            </View>

            {estudiantes.length > 0 ? (
              <View className="gap-2">
                {estudiantes.map((estudiante) => (
                  <TouchableOpacity
                    key={estudiante.estudianteId}
                    onPress={() => abrirEstudiante(estudiante.estudianteId)}
                    activeOpacity={0.75}
                    className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3">
                      <UserAvatar
                        nombre={estudiante.nombre}
                        apellidoPaterno={estudiante.apellidoPaterno}
                        className="w-10 h-10 rounded-xl bg-maroon/10"
                        textoClassName="text-sm font-bold text-maroon"
                      />
                      <View>
                        <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
                          {estudiante.nombre} {estudiante.apellidoPaterno}
                        </Text>
                        <Text className="text-[11px] text-gray-400">
                          Promedio {estudiante.promedio !== null ? estudiante.promedio.toFixed(1) : '—'} ·
                          asistencia {estudiante.asistencia !== null ? `${estudiante.asistencia}%` : '—'}
                        </Text>
                      </View>
                    </View>
                    <View className="items-end gap-1">
                      <StatusBadge
                        label={getRiesgoLabel(estudiante.nivelRiesgo)}
                        variant={getRiesgoVariant(estudiante.nivelRiesgo)}
                      />
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : panelLoading ? (
              <View className="py-8 items-center justify-center">
                <ActivityIndicator color="#801529" style={{ marginVertical: 24 }} />
              </View>
            ) : (
              <Text className="text-sm text-gray-500 py-4 text-center">
                Todavía no hay notas registradas en este curso.
              </Text>
            )}
          </BentoCard>
        </View>
      )}

      {vista === 'estudiante' && (
        <View className="gap-4">
          <TouchableOpacity onPress={volver} className="flex-row items-center gap-1">
            <Ionicons name="arrow-back" size={15} color="#801529" />
            <Text className="text-xs font-bold text-maroon">Volver al curso</Text>
          </TouchableOpacity>

          {/* Panel de rendimiento individual - reutiliza componente de académico */}
          <PanelEstudianteRendimiento panel={panelEstudiante} loading={estudianteLoading} />
        </View>
      )}
    </ScrollView>
  );
}

function Miga({
  label,
  activo,
  onPress,
}: {
  label: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center gap-1">
      <Text
        className={`text-xs font-semibold ${
          activo ? 'text-maroon' : 'text-gray-500'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// helpers -> mapear nivel de riesgo a etiqueta y variante
function getRiesgoLabel(nivel: NivelRiesgo): string {
  const etiquetas: Record<NivelRiesgo, string> = {
    sin_riesgo: 'En regla',
    observacion: 'En observación',
    riesgo: 'En riesgo',
    riesgo_alto: 'Riesgo alto',
  };
  return etiquetas[nivel];
}

function getRiesgoVariant(nivel: NivelRiesgo): 'success' | 'warning' | 'danger' | 'info' {
  const variantes: Record<NivelRiesgo, 'success' | 'warning' | 'danger' | 'info'> = {
    sin_riesgo: 'success',
    observacion: 'info',
    riesgo: 'warning',
    riesgo_alto: 'danger',
  };
  return variantes[nivel];
}