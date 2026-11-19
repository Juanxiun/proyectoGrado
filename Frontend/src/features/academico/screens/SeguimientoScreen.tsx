import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicServicesApi } from '../../../api/academicServices.api';
import { seguimientoApi, type NivelRiesgo, type PanelCurso, type PanelEstudiante } from '../../../api/seguimiento.api';
import { useAuth } from '../../../context/AuthContext';
import { useRealtimeResource } from '../../../hooks/useRealtimeResource';
import { StatusBadge } from '../../../shared/ui';
import { CursosPorNivel, type CursoHabilitado } from '../components/CursosPorNivel';
import { Miga } from '../components/Miga';
import { PanelCursoRendimiento, ListaEstudiantesCurso } from '../components/PanelCursoRendimiento';
import { PanelEstudianteRendimiento } from '../components/PanelEstudianteRendimiento';
import { RankingRachasCurso } from '../components/RankingRachasCurso';
import { NIVEL_LABEL, nivelDe } from '../utils/niveles';
import {
  ORDEN_RIESGO,
  TRIMESTRES,
  promediar,
  type Periodo,
  type ResumenEstudiante,
  type Vista,
} from '../utils/seguimiento';

// seguimiento -> gestión, curso y estudiante
export function SeguimientoScreen({ initialPeriodoId, teacherMode = false }: { initialPeriodoId?: string; teacherMode?: boolean }) {
  const { user } = useAuth();
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [periodoId, setPeriodoId] = useState(initialPeriodoId ?? '');
  const [trimestre, setTrimestre] = useState<number>(1);

  const [cursos, setCursos] = useState<CursoHabilitado[]>([]);
  const [cursosLoading, setCursosLoading] = useState(false);
  const [asignacionesDocente, setAsignacionesDocente] = useState<Array<{ cursoPeriodoId: string; materiaId: string; materia: string }>>([]);
  const [asignacionesDocenteLoading, setAsignacionesDocenteLoading] = useState(false);
  const [materiaFiltro, setMateriaFiltro] = useState('');

  const [cursoPeriodoId, setCursoPeriodoId] = useState('');
  const [panel, setPanel] = useState<PanelCurso | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [estudiantes, setEstudiantes] = useState<ResumenEstudiante[]>([]);

  const [estudianteId, setEstudianteId] = useState('');
  const [panelEstudiante, setPanelEstudiante] = useState<PanelEstudiante | null>(null);
  const [estudianteLoading, setEstudianteLoading] = useState(false);

  const [vista, setVista] = useState<Vista>('cursos');

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
  }, [initialPeriodoId]);

  const cargarCursos = useCallback(async () => {
    if (!periodoId) {
      setCursos([]);
      return;
    }
    setCursosLoading(true);
    try {
      const res = await academicServicesApi.list('cursos-periodo', {
        periodoId,
        estado: 'activo',
        limit: 200,
      });
      const items = (res.data ?? []) as unknown as Array<Record<string, any>>;
      setCursos(
        items.map((item) => ({
          id: String(item.id),
          grado: String(item.curso?.grado ?? ''),
          paralelo: String(item.curso?.paralelo ?? ''),
          nivel: String(item.curso?.nivel ?? ''),
          capacidadMaxima: item.capacidadMaxima,
          estado: item.estado,
        })),
      );
    } catch {
      setCursos([]);
    } finally {
      setCursosLoading(false);
    }
  }, [periodoId]);

  useEffect(() => {
    void cargarCursos();
  }, [cargarCursos]);

  useRealtimeResource('cursos-periodo', () => {
    void cargarCursos();
  });

  useEffect(() => {
    if (!teacherMode || !user || !periodoId) {
      setAsignacionesDocente([]);
      setAsignacionesDocenteLoading(false);
      return;
    }
    if (cursosLoading) {
      setAsignacionesDocenteLoading(true);
      return;
    }
    if (cursos.length === 0) {
      setAsignacionesDocente([]);
      setAsignacionesDocenteLoading(false);
      return;
    }
    let vigente = true;
    setAsignacionesDocenteLoading(true);
    academicServicesApi.list('asignaciones', { limit: 500 })
      .then((res) => {
        const idsCursoPeriodo = new Set(cursos.map((curso) => String(curso.id)));
        const propias = (res.data ?? []).filter((raw: any) => {
          const maestro = raw.maestro;
          const coincideDocente = user.maestroId && raw.maestroId
            ? String(raw.maestroId) === String(user.maestroId)
            : maestro?.usuarioId
              ? String(maestro.usuarioId) === String(user.id)
              : Boolean(maestro && maestro.nombre === user.nombre && maestro.apellidoPaterno === user.apellidoPaterno);
          const cursoPeriodoId = String(raw.cursoPeriodoId ?? raw.cursoPeriodo?.id ?? '');
          return coincideDocente && idsCursoPeriodo.has(cursoPeriodoId);
        }).map((raw: any) => ({
          cursoPeriodoId: String(raw.cursoPeriodoId ?? raw.cursoPeriodo?.id ?? ''),
          materiaId: String(raw.materia?.id ?? raw.materiaId ?? ''),
          materia: String(raw.materia?.nombre ?? raw.materiaNombre ?? 'Materia'),
        })).filter((item: { cursoPeriodoId: string; materiaId: string; materia: string }) => item.cursoPeriodoId && item.materiaId);
        if (vigente) setAsignacionesDocente(propias);
      })
      .catch(() => { if (vigente) setAsignacionesDocente([]); })
      .finally(() => { if (vigente) setAsignacionesDocenteLoading(false); });
    return () => { vigente = false; };
  }, [teacherMode, user, periodoId, cursos, cursosLoading]);

  const materiasDocente = useMemo(() => {
    const materias = new Map<string, string>();
    asignacionesDocente.forEach((item) => materias.set(item.materiaId, item.materia));
    return [...materias.entries()].map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [asignacionesDocente]);

  const cursosVisibles = useMemo(() => {
    if (!teacherMode) return cursos;
    const ids = new Set(asignacionesDocente
      .filter((item) => !materiaFiltro || item.materiaId === materiaFiltro)
      .map((item) => item.cursoPeriodoId));
    return cursos.filter((curso) => ids.has(String(curso.id)));
  }, [teacherMode, cursos, asignacionesDocente, materiaFiltro]);

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

  // resumen estudiante -> se arma con cada libro
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

  const cursoSeleccionado = useMemo(
    () => cursos.find((c) => String(c.id) === cursoPeriodoId) ?? null,
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
  const nombreNivel = cursoSeleccionado
    ? NIVEL_LABEL[nivelDe(cursoSeleccionado.nivel) ?? 'primaria']
    : '';

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-10">
      <View className="bg-white border border-gray-100 rounded-2xl p-4 gap-3">
        <View className="flex-row items-center gap-2">
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
                  setMateriaFiltro('');
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

        <View className="flex-row items-center gap-2 pt-1 border-t border-gray-100">
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

        {teacherMode ? (
          <View className="gap-2 pt-3 border-t border-gray-100">
            <Text className="text-xs font-bold text-gray-600">Filtrar cursos por materia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                <TouchableOpacity onPress={() => setMateriaFiltro('')} className={`rounded-xl border px-3 py-2 ${!materiaFiltro ? 'border-maroon bg-maroon' : 'border-gray-200 bg-white'}`}>
                  <Text className={`text-xs font-bold ${!materiaFiltro ? 'text-white' : 'text-gray-700'}`}>Todas</Text>
                </TouchableOpacity>
                {materiasDocente.map((materia) => (
                  <TouchableOpacity key={materia.id} onPress={() => setMateriaFiltro(materia.id)} className={`rounded-xl border px-3 py-2 ${materiaFiltro === materia.id ? 'border-maroon bg-maroon' : 'border-gray-200 bg-white'}`}>
                    <Text className={`text-xs font-bold ${materiaFiltro === materia.id ? 'text-white' : 'text-gray-700'}`}>{materia.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            {materiasDocente.length === 0 && !asignacionesDocenteLoading ? <Text className="text-xs text-gray-400">No tienes materias asignadas en esta gestión.</Text> : null}
          </View>
        ) : null}
      </View>

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
              label={`${cursoSeleccionado.grado} ${String(cursoSeleccionado.paralelo).toUpperCase()} · ${nombreNivel}`}
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

      {vista === 'cursos' ? (
        <CursosPorNivel
          cursos={cursosVisibles}
          loading={cursosLoading || (teacherMode && asignacionesDocenteLoading)}
          onSelect={abrirCurso}
          onRefresh={cargarCursos}
          emptyTitle={teacherMode ? 'No hay cursos para este filtro' : undefined}
          emptyDescription={teacherMode ? 'Cambia la materia seleccionada o revisa tus asignaciones de esta gestión.' : undefined}
        />
      ) : null}

      {vista === 'curso' ? (
        <View className="gap-4">
          <View className="flex-row items-center gap-2">
            <TouchableOpacity onPress={volver} className="flex-row items-center gap-1">
              <Ionicons name="arrow-back" size={15} color="#801529" />
              <Text className="text-xs font-bold text-maroon">Volver a los cursos</Text>
            </TouchableOpacity>
            {cursoSeleccionado ? (
              <View className="flex-1 flex-row justify-end">
                <StatusBadge
                  label={`${cursoSeleccionado.grado} ${String(cursoSeleccionado.paralelo).toUpperCase()}`}
                  variant="info"
                />
              </View>
            ) : null}
          </View>

          <PanelCursoRendimiento panel={panel} loading={panelLoading} />

          <View className="bg-white border border-gray-100 rounded-2xl p-4">
            <Text className="text-sm font-bold text-gray-900 mb-3">Participación en la aplicación</Text>
            {cursoPeriodoId ? <RankingRachasCurso cursoPeriodoId={cursoPeriodoId} /> : null}
          </View>

          <View className="bg-white border border-gray-100 rounded-2xl p-4">
            <Text className="text-sm font-bold text-gray-900 mb-1">Estudiantes del curso</Text>
            <Text className="text-xs text-gray-500 mb-2">
              Toque un estudiante para ver su desempeño individual
            </Text>
            {estudiantes.length > 0 ? (
              <ListaEstudiantesCurso estudiantes={estudiantes} onSelect={abrirEstudiante} />
            ) : panelLoading ? (
              <ActivityIndicator color="#801529" style={{ marginVertical: 24 }} />
            ) : (
              <Text className="text-sm text-gray-500 py-4">
                Todavía no hay notas registradas en este curso.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      {vista === 'estudiante' ? (
        <View className="gap-4">
          <TouchableOpacity onPress={volver} className="flex-row items-center gap-1">
            <Ionicons name="arrow-back" size={15} color="#801529" />
            <Text className="text-xs font-bold text-maroon">Volver al curso</Text>
          </TouchableOpacity>
          <PanelEstudianteRendimiento panel={panelEstudiante} loading={estudianteLoading} />
        </View>
      ) : null}
    </ScrollView>
  );
}
