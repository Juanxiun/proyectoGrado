import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { academicManagementApi, academicServicesApi } from '../../../api/academicServices.api';
import { seguimientoApi, type LibroNotas, type LineaLibro } from '../../../api/seguimiento.api';
import { gamificacionApi, type RankingEstudiante, type ResumenGamificacionMateria } from '../../../api/gamificacion.api';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { FichaAprendizajeEstudiante } from '../../academico/components/FichaAprendizajeEstudiante';
import { RankingRachasCurso } from '../../academico/components/RankingRachasCurso';
import { NIVEL_LABEL, nivelDe } from '../../academico/utils/niveles';

type Opcion = { id: string; label: string };
type Asignacion = { id: string; materiaId: string; materia: string; cursoPeriodoId: string; curso: string; paralelo: string; nivel: string };
type Estudiante = { id: string; nombre: string };
type Tab = 'estudiantes' | 'asistencia' | 'notas';
type HorarioClase = { diaSemana: number; horaInicio: string; horaFin: string; estado?: string };

const ESTADOS = [
  { key: 'presente', label: 'Presente', color: '#15803D' },
  { key: 'justificado', label: 'Justificado', color: '#B45309' },
  { key: 'ausente', label: 'Ausente', color: '#B91C1C' },
];

function fechaLocal(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function minutosHora(value: string): number {
  const [hora, minuto] = value.split(':').map(Number);
  return (hora || 0) * 60 + (minuto || 0);
}

function contarDiasPlanificados(inicio: string, fin: string, horarios: HorarioClase[]): number {
  const desde = new Date(`${inicio.slice(0, 10)}T12:00:00`);
  const hasta = new Date(`${fin.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return 0;
  let total = 0;
  for (const fecha = new Date(desde); fecha <= hasta; fecha.setDate(fecha.getDate() + 1)) {
    const dia = fecha.getDay() || 7;
    total += horarios.filter((item) => Number(item.diaSemana) === dia).length;
  }
  return total;
}

function etiquetaTrimestre(numero: number): string {
  return `${numero}° trimestre`;
}

function notaTexto(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(1);
}

function GraficoRiesgo({ riesgo, observacion, sinRiesgo, total }: { riesgo: number; observacion: number; sinRiesgo: number; total: number }) {
  const segmentos = [
    { label: 'En riesgo', value: riesgo, color: '#DC2626' },
    { label: 'En observación', value: observacion, color: '#D97706' },
    { label: 'Sin riesgo', value: sinRiesgo, color: '#16A34A' },
  ];
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  let offset = 0;
  return <View className="flex-row flex-wrap items-center gap-4">
    <View className="w-28 h-28 items-center justify-center">
      <Svg width={112} height={112} viewBox="0 0 112 112"><Circle cx="56" cy="56" r={radio} fill="none" stroke="#F3F4F6" strokeWidth="13" />{total > 0 ? segmentos.map((item) => {
        const longitud = item.value / total * circunferencia;
        const circle = <Circle key={item.label} cx="56" cy="56" r={radio} fill="none" stroke={item.color} strokeWidth="13" strokeDasharray={`${longitud} ${circunferencia - longitud}`} strokeDashoffset={-offset} transform="rotate(-90 56 56)" />;
        offset += longitud;
        return circle;
      }) : null}</Svg>
      <View className="absolute items-center"><Text className="text-xl font-black text-gray-900">{total}</Text><Text className="text-[9px] text-gray-500">estudiantes</Text></View>
    </View>
    <View className="flex-1 min-w-[160px] gap-2">{segmentos.map((item) => <View key={item.label} className="flex-row items-center gap-2"><View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} /><Text className="flex-1 text-xs text-gray-600">{item.label}</Text><Text className="text-xs font-bold text-gray-900">{item.value}</Text></View>)}</View>
  </View>;
}

function BarraCurso({ etiqueta, porcentaje, color }: { etiqueta: string; porcentaje: number; color: string }) {
  const valor = Math.max(0, Math.min(100, porcentaje));
  return <View className="gap-1.5"><View className="flex-row items-center justify-between"><Text className="text-xs font-medium text-gray-600">{etiqueta}</Text><Text className="text-xs font-bold text-gray-900">{Math.round(valor)}%</Text></View><View className="h-2.5 rounded-full bg-gray-100 overflow-hidden"><View className="h-full rounded-full" style={{ width: `${valor}%`, backgroundColor: color }} /></View></View>;
}

export function MaestroSeguimientoScreen() {
  const { user } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [materiaId, setMateriaId] = useState('');
  const [curso, setCurso] = useState('');
  const [paralelo, setParalelo] = useState('');
  const [tab, setTab] = useState<Tab>('estudiantes');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [fecha, setFecha] = useState(fechaLocal());
  const [ahora, setAhora] = useState(new Date());
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [trimestre, setTrimestre] = useState(1);
  const [libro, setLibro] = useState<LibroNotas | null>(null);
  const [librosGlobales, setLibrosGlobales] = useState<LibroNotas[]>([]);
  const [libroCargando, setLibroCargando] = useState(false);
  const [horarios, setHorarios] = useState<HorarioClase[]>([]);
  const [horariosCargando, setHorariosCargando] = useState(false);
  const [clasesPlanificadas, setClasesPlanificadas] = useState(0);
  const [clasesRealizadas, setClasesRealizadas] = useState(0);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [guardandoNota, setGuardandoNota] = useState('');
  const [estudianteSeleccionado, setEstudianteSeleccionado] = useState('');
  const [rankingGamificacion, setRankingGamificacion] = useState<RankingEstudiante[]>([]);
  const [entregasPorEstudiante, setEntregasPorEstudiante] = useState<Record<string, number>>({});
  const [totalEntregas, setTotalEntregas] = useState(0);
  const [gamificacionIndividual, setGamificacionIndividual] = useState<ResumenGamificacionMateria | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);

  const cargarAsignaciones = useCallback(async () => {
    if (!user) return;
    setCargando(true);
    try {
      const res = await academicServicesApi.listAll('asignaciones');
      const propias = res.filter((raw: any) => {
        if (user.maestroId && String(raw.maestroId) === String(user.maestroId)) return true;
        if (String(raw.maestro?.usuarioId ?? '') === String(user.id)) return true;
        return Boolean(raw.maestro && raw.maestro.nombre === user.nombre && raw.maestro.apellidoPaterno === user.apellidoPaterno);
      });
      setAsignaciones(propias.map((raw: any) => ({
        id: String(raw.id),
        materiaId: String(raw.materia?.id ?? raw.materiaId ?? ''),
        materia: String(raw.materia?.nombre ?? raw.materiaNombre ?? 'Materia'),
        cursoPeriodoId: String(raw.cursoPeriodoId ?? raw.cursoPeriodo?.id ?? ''),
        curso: String(raw.cursoPeriodo?.curso?.grado ?? raw.grado ?? ''),
        paralelo: String(raw.cursoPeriodo?.curso?.paralelo ?? raw.paralelo ?? ''),
        nivel: String(raw.cursoPeriodo?.curso?.nivel ?? raw.nivel ?? ''),
      })).filter((item: Asignacion) => item.id && item.cursoPeriodoId && item.materiaId));
    } catch {
      setAsignaciones([]);
    } finally {
      setCargando(false);
    }
  }, [user]);

  useEffect(() => { void cargarAsignaciones(); }, [cargarAsignaciones]);
  useEffect(() => {
    const timer = setInterval(() => {
      const current = new Date();
      setAhora(current);
      setFecha(fechaLocal(current));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const asignacion = asignaciones.find((a) => a.materiaId === materiaId && a.curso === curso && a.paralelo === paralelo);
  const materiasConCursos = useMemo(() => {
    const grupos = new Map<string, { materia: string; cursos: Asignacion[] }>();
    for (const item of asignaciones) {
      const grupo = grupos.get(item.materiaId) ?? { materia: item.materia, cursos: [] };
      if (!grupo.cursos.some((cursoItem) => cursoItem.cursoPeriodoId === item.cursoPeriodoId)) grupo.cursos.push(item);
      grupos.set(item.materiaId, grupo);
    }
    return [...grupos.entries()].map(([materiaId, grupo]) => ({
      materiaId,
      ...grupo,
      cursos: grupo.cursos.sort((a, b) =>
        a.curso.localeCompare(b.curso, 'es') || a.paralelo.localeCompare(b.paralelo, 'es')
      ),
    })).sort((a, b) => a.materia.localeCompare(b.materia, 'es'));
  }, [asignaciones]);

  useEffect(() => { setEstudianteSeleccionado(''); }, [asignacion?.id]);

  const cargarEstudiantes = useCallback(async () => {
    if (!asignacion) { setEstudiantes([]); return; }
    try {
      const res = await academicServicesApi.listAll('inscripciones', { cursoPeriodoId: asignacion.cursoPeriodoId });
      setEstudiantes(res.map((row: any) => ({
        id: String(row.estudianteId ?? row.estudiante?.id ?? ''),
        nombre: `${row.estudiante?.apellidoPaterno ?? row.apellidoPaterno ?? ''} ${row.estudiante?.apellidoMaterno ?? ''} ${row.estudiante?.nombre ?? row.nombre ?? 'Estudiante'}`.trim(),
      })).filter((row: Estudiante) => row.id));
    } catch { setEstudiantes([]); }
  }, [asignacion]);

  useEffect(() => { void cargarEstudiantes(); }, [cargarEstudiantes]);

  useEffect(() => {
    if (!asignacion) {
      setLibro(null);
      setLibrosGlobales([]);
      setHorarios([]);
      setClasesPlanificadas(0);
      setClasesRealizadas(0);
      return;
    }
    let vigente = true;
    setLibroCargando(true);
    seguimientoApi.libro({ cursoPeriodoId: asignacion.cursoPeriodoId, materiaId: asignacion.materiaId, trimestre })
      .then((data) => { if (vigente) setLibro(data); })
      .catch(() => { if (vigente) setLibro(null); })
      .finally(() => { if (vigente) setLibroCargando(false); });
    return () => { vigente = false; };
  }, [asignacion, trimestre]);

  useEffect(() => {
    if (!asignacion || !libro?.periodo.id) { setLibrosGlobales([]); return; }
    let vigente = true;
    Promise.all([1, 2, 3].map((numero) => seguimientoApi.libro({
      cursoPeriodoId: asignacion.cursoPeriodoId,
      materiaId: asignacion.materiaId,
      trimestre: numero,
    }).catch(() => null)))
      .then((res) => { if (vigente) setLibrosGlobales(res.filter((item): item is LibroNotas => Boolean(item))); });
    return () => { vigente = false; };
  }, [asignacion, libro?.periodo.id]);

  useEffect(() => {
    if (!asignacion || !libro?.periodo.id) { setHorarios([]); return; }
    let vigente = true;
    setHorariosCargando(true);
    academicManagementApi.listSchedules(libro.periodo.id, { cursoPeriodoId: asignacion.cursoPeriodoId })
      .then((rows) => {
        const sesiones = (rows as any[]).filter((row) =>
          String(row.materiaId ?? row.materia?.id ?? '') === asignacion.materiaId &&
          (!user?.maestroId || String(row.maestroId ?? row.maestro?.id ?? '') === String(user.maestroId)) &&
          row.estado !== 'cancelado',
        ).map((row) => ({ diaSemana: Number(row.diaSemana), horaInicio: String(row.horaInicio ?? ''), horaFin: String(row.horaFin ?? ''), estado: String(row.estado ?? '') }));
        if (vigente) setHorarios(sesiones);
      })
      .catch(() => { if (vigente) setHorarios([]); })
      .finally(() => { if (vigente) setHorariosCargando(false); });
    return () => { vigente = false; };
  }, [asignacion, libro?.periodo.id, user?.maestroId]);

  useEffect(() => {
    if (!asignacion) { setRankingGamificacion([]); return; }
    let vigente = true;
    gamificacionApi.getRanking(asignacion.cursoPeriodoId)
      .then((grupos) => {
        if (!vigente) return;
        const grupo = grupos.find((item) => String(item.paralelo).toUpperCase() === String(asignacion.paralelo).toUpperCase());
        setRankingGamificacion([...(grupo?.estudiantes ?? [])].sort((a, b) => b.puntosIndividuales - a.puntosIndividuales));
      })
      .catch(() => { if (vigente) setRankingGamificacion([]); });
    return () => { vigente = false; };
  }, [asignacion]);

  useEffect(() => {
    if (!libro || !asignacion) { setEntregasPorEstudiante({}); setTotalEntregas(0); return; }
    let vigente = true;
    Promise.all(libro.encargos.map((encargo) => academicServicesApi.listAll('entregas', { encargoId: encargo.id }).catch(() => [])))
      .then((grupos) => {
        if (!vigente) return;
        const conteo: Record<string, number> = {};
        let total = 0;
        grupos.flat().forEach((raw: any) => {
          const id = String(raw.estudianteId ?? '');
          if (!id) return;
          conteo[id] = (conteo[id] ?? 0) + 1;
          total++;
        });
        setEntregasPorEstudiante(conteo);
        setTotalEntregas(total);
      });
    return () => { vigente = false; };
  }, [libro, asignacion]);

  useEffect(() => {
    if (!estudianteSeleccionado || !asignacion) {
      setGamificacionIndividual(null);
      return;
    }
    const linea = libro?.lineas.find((item) => item.estudianteId === estudianteSeleccionado);
    if (!linea) return;
    let vigente = true;
    setDetalleCargando(true);
    gamificacionApi.getResumenEstudianteMateria({ estudianteId: estudianteSeleccionado, usuarioId: linea.usuarioId, cursoPeriodoId: asignacion.cursoPeriodoId, materiaId: asignacion.materiaId }).catch(() => null).then((gamificacion) => {
      if (!vigente) return;
      setGamificacionIndividual(gamificacion);
    }).finally(() => { if (vigente) setDetalleCargando(false); });
    return () => { vigente = false; };
  }, [estudianteSeleccionado, asignacion, libro]);

  useEffect(() => {
    if (!asignacion || !libro?.trimestre) { setClasesPlanificadas(0); setClasesRealizadas(0); return; }
    let vigente = true;
    const { inicio, fin } = libro.trimestre;
    const limite = fechaLocal();
    const finHastaHoy = fin.slice(0, 10) < limite ? fin : limite;
    setClasesPlanificadas(contarDiasPlanificados(inicio, fin, horarios));
    academicServicesApi.listAll('asistencia', { asignacionId: asignacion.id })
      .then((rows) => {
        const dias = new Set(rows.map((row: any) => String(row.fecha ?? '').slice(0, 10))
          .filter((dia) => dia >= inicio.slice(0, 10) && dia <= finHastaHoy));
        if (vigente) setClasesRealizadas(dias.size);
      })
      .catch(() => { if (vigente) setClasesRealizadas(0); });
    return () => { vigente = false; };
  }, [asignacion, libro?.trimestre, horarios, fecha]);

  useEffect(() => {
    if (!asignacion || tab !== 'asistencia') return;
    setEstados({});
    setMensaje('');
    academicServicesApi.list('asistencia', { asignacionId: asignacion.id, fecha, limit: 200 })
      .then((res) => {
        const inicial: Record<string, string> = {};
        (res.data as any[]).forEach((row) => { inicial[String(row.estudianteId)] = String(row.estado); });
        setEstados(inicial);
      }).catch(() => setEstados({}));
  }, [asignacion, fecha, tab]);

  useEffect(() => {
    if (!libro || tab !== 'notas') return;
    let vigente = true;
    Promise.all(libro.encargos.map((encargo) => academicServicesApi.listAll('calificaciones', { encargoId: encargo.id })
      .then((rows) => rows.map((row: any) => ({ key: `${encargo.id}:${row.estudianteId}`, nota: String(row.nota ?? '') })))
      .catch(() => [])))
      .then((results) => {
        if (!vigente) return;
        setNotas(Object.fromEntries(results.flat().map((row) => [row.key, row.nota])));
      });
    return () => { vigente = false; };
  }, [libro, tab]);

  const sesionesAhora = useMemo(() => {
    const dia = ahora.getDay() || 7;
    const minutoActual = ahora.getHours() * 60 + ahora.getMinutes();
    return horarios.filter((item) => item.diaSemana === dia && minutoActual >= minutosHora(item.horaInicio) && minutoActual < minutosHora(item.horaFin));
  }, [ahora, horarios]);

  const lineasPorEstudiante = useMemo(() => new Map((libro?.lineas ?? []).map((linea) => [linea.estudianteId, linea])), [libro]);
  const rankingPorEstudiante = useMemo(() => new Map(rankingGamificacion.map((item) => [item.estudianteId, item])), [rankingGamificacion]);
  const resumenCurso = useMemo(() => {
    const lineas = libro?.lineas ?? [];
    const promedios = lineas.map((item) => item.promedio).filter((item): item is number => item !== null);
    const asistencias = lineas.map((item) => item.asistencia.tasa).filter((item): item is number => item !== null);
    const presentados = lineas.filter((item) => (entregasPorEstudiante[item.estudianteId] ?? 0) > 0).length;
    return {
      promedio: promedios.length ? promedios.reduce((sum, item) => sum + item, 0) / promedios.length : null,
      asistencia: asistencias.length ? asistencias.reduce((sum, item) => sum + item, 0) / asistencias.length : null,
      riesgo: lineas.filter((item) => item.nivelRiesgo === 'riesgo' || item.nivelRiesgo === 'riesgo_alto').length,
      observacion: lineas.filter((item) => item.nivelRiesgo === 'observacion').length,
      sinRiesgo: lineas.filter((item) => item.nivelRiesgo === 'sin_riesgo').length,
      presentados,
      totalEstudiantes: lineas.length,
      totalActividadesPublicadas: libro?.encargos.length ?? 0,
      totalActividadesGamificadas: rankingGamificacion.reduce((sum, item) => sum + item.actividadesCompletadas, 0),
      estudiantesGamificados: rankingGamificacion.filter((item) => item.actividadesCompletadas > 0).length,
    };
  }, [libro, entregasPorEstudiante, rankingGamificacion]);
  const notasGlobales = useMemo(() => {
    const sumas = new Map<string, { total: number; peso: number }>();
    librosGlobales.forEach((item) => item.lineas.forEach((linea) => {
      if (linea.promedio === null || linea.pesoAcumulado <= 0) return;
      const actual = sumas.get(linea.estudianteId) ?? { total: 0, peso: 0 };
      actual.total += linea.promedio * linea.pesoAcumulado;
      actual.peso += linea.pesoAcumulado;
      sumas.set(linea.estudianteId, actual);
    }));
    return new Map([...sumas].map(([id, value]) => [id, value.peso ? value.total / value.peso : null]));
  }, [librosGlobales]);

  const guardarAsistencia = async () => {
    if (!asignacion || estudiantes.length === 0 || sesionesAhora.length === 0) return;
    if (estudiantes.some((student) => !estados[student.id])) {
      setMensaje('Marca la asistencia de cada estudiante antes de guardar.');
      return;
    }
    setGuardando(true);
    setMensaje('');
    try {
      await academicServicesApi.bulk('asistencia', { asignacionId: asignacion.id, fecha, asistencias: estudiantes.map((student) => ({ estudianteId: student.id, estado: estados[student.id] })) });
      setMensaje('Asistencia guardada correctamente.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo guardar la asistencia.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarNota = async (encargoId: string, estudiante: Estudiante) => {
    const key = `${encargoId}:${estudiante.id}`;
    const nota = Number(notas[key]);
    if (!Number.isFinite(nota) || nota < 0 || nota > 100 || !asignacion) return;
    setGuardandoNota(key);
    try {
      await academicServicesApi.bulk('calificaciones', { encargoId, calificaciones: [{ estudianteId: estudiante.id, nota }] });
      const actualizado = await seguimientoApi.libro({ cursoPeriodoId: asignacion.cursoPeriodoId, materiaId: asignacion.materiaId, trimestre });
      setLibro(actualizado);
    } finally {
      setGuardandoNota('');
    }
  };

  const elegirTab = (value: Tab) => {
    setTab(value);
    setMensaje('');
  };

  const abrirAsignacion = (item: Asignacion, vista: Tab) => {
    setMateriaId(item.materiaId);
    setCurso(item.curso);
    setParalelo(item.paralelo);
    setTab(vista);
    setEstudianteSeleccionado('');
  };

  const volverCursos = () => {
    setMateriaId('');
    setCurso('');
    setParalelo('');
    setEstudianteSeleccionado('');
    setTab('estudiantes');
  };

  if (cargando) return <View className="py-16 items-center"><ActivityIndicator size="large" color="#801529" /><Text className="text-sm text-gray-500 mt-3">Cargando tus cursos…</Text></View>;

  return <ScrollView className="flex-1" contentContainerClassName="gap-4 p-4 pb-8">
    <View className="gap-1"><Text className="text-xl font-black text-gray-900">Seguimiento académico</Text><Text className="text-sm text-gray-500">Tus cursos, asistencia, calificaciones y progreso.</Text></View>

    <View className="gap-4">
      {materiasConCursos.length ? materiasConCursos.map((grupo) => <BentoCard key={grupo.materiaId} className="p-5 bg-white border border-gray-100 shadow-sm">
        <View className="mb-4 flex-row items-center justify-between border-b border-gray-100 pb-3">
          <View className="flex-row items-center gap-2.5"><View className="h-8 w-8 items-center justify-center rounded-lg bg-maroon/10"><Ionicons name="book-outline" size={16} color="#801529" /></View><Text className="text-base font-bold text-gray-900">{grupo.materia}</Text></View>
          <Text className="text-xs font-semibold text-gray-400">{grupo.cursos.length} {grupo.cursos.length === 1 ? 'curso' : 'cursos'}</Text>
        </View>
        <View className="flex-row flex-wrap gap-3.5">
          {grupo.cursos.map((item) => {
            const par = item.paralelo.toUpperCase();
            const nombreNivel = NIVEL_LABEL[nivelDe(item.nivel) ?? 'primaria'];
            return <TouchableOpacity key={item.cursoPeriodoId} onPress={() => abrirAsignacion(item, 'estudiantes')} activeOpacity={0.7} className="flex-1 min-w-[245px] max-w-[380px] justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <View className="flex-row items-start justify-between"><View className="h-11 w-11 items-center justify-center rounded-2xl bg-maroon shadow-sm"><Text className="text-lg font-black text-white">{par}</Text></View><View className="rounded-md bg-maroon/10 px-2 py-0.5"><Text className="text-[10px] font-bold uppercase text-maroon">Paralelo {par}</Text></View></View>
              <View><Text className="text-base font-bold text-gray-900">{item.curso}° Paralelo "{par}"</Text><Text className="mt-0.5 text-xs text-gray-500">Nivel {nombreNivel}</Text></View>
              <View className="flex-row items-center justify-between border-t border-gray-200/70 pt-2"><Text className="text-[11px] font-medium text-gray-500">{nombreNivel}</Text><View className="flex-row items-center gap-1"><Text className="text-xs font-bold text-maroon">Ver seguimiento</Text><Ionicons name="arrow-forward" size={13} color="#801529" /></View></View>
            </TouchableOpacity>;
          })}
        </View>
      </BentoCard>) : <BentoCard className="items-center p-8"><Ionicons name="school-outline" size={34} color="#9CA3AF" /><Text className="mt-3 text-center text-sm font-bold text-gray-800">No tienes cursos asignados</Text><Text className="mt-1 text-center text-xs text-gray-500">Cuando te asignen materias, aparecerán aquí.</Text></BentoCard>}
    </View>

    {asignacion ? <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={volverCursos}>
      <View className="flex-1 justify-end bg-black/50 md:justify-center md:p-5">
        <View className="w-full max-h-[94%] overflow-hidden rounded-t-3xl bg-[#F8F7F6] md:max-w-5xl md:self-center md:rounded-3xl">
          <View className="flex-row items-center justify-between border-b border-gray-100 bg-white p-4">
            <View className="flex-1 pr-3"><Text className="text-[10px] font-bold uppercase text-maroon">{asignacion.materia}</Text><Text className="mt-1 text-base font-black text-gray-900">{asignacion.curso}° · {(NIVEL_LABEL[nivelDe(asignacion.nivel) ?? 'primaria']).toUpperCase()} · Paralelo {asignacion.paralelo}</Text></View>
            <TouchableOpacity onPress={volverCursos} className="h-9 w-9 items-center justify-center rounded-full bg-gray-100"><Ionicons name="close" size={19} color="#4B5563" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerClassName="gap-4 p-4 pb-8" keyboardShouldPersistTaps="handled">
      <BentoCard className="p-2">
        <View className="flex-row gap-2">{([
          ['estudiantes', 'Estudiantes', 'people-outline'],
          ['asistencia', 'Llamar asistencia', 'checkmark-done-outline'],
          ['notas', 'Notas y casillero', 'reader-outline'],
        ] as const).map(([value, label, icon]) => <TouchableOpacity key={value} onPress={() => elegirTab(value)} className={`flex-1 items-center justify-center gap-1.5 py-3 rounded-xl ${tab === value ? 'bg-maroon' : 'bg-gray-100'}`}><Ionicons name={icon} size={18} color={tab === value ? '#fff' : '#4B5563'} /><Text className={`text-[11px] text-center font-bold ${tab === value ? 'text-white' : 'text-gray-700'}`}>{label}</Text></TouchableOpacity>)}</View>
      </BentoCard>

      {tab === 'estudiantes' ? <BentoCard className="p-5">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1"><Text className="text-lg font-bold text-gray-900">Estudiantes</Text><Text className="text-xs text-gray-500 mt-1">{asignacion.materia} · {asignacion.curso}° {asignacion.nivel} · Paralelo {asignacion.paralelo}</Text></View>
          <TouchableOpacity onPress={() => elegirTab('asistencia')} className="flex-row items-center gap-2 bg-maroon px-3 py-2.5 rounded-xl"><Ionicons name="clipboard-outline" size={16} color="#fff" /><Text className="text-xs text-white font-bold">Llamar asistencia</Text></TouchableOpacity>
        </View>
        <View className="flex-row gap-2 mt-5">{[1, 2, 3].map((n) => <TouchableOpacity key={n} onPress={() => setTrimestre(n)} className={`flex-1 items-center py-2.5 rounded-xl ${trimestre === n ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-xs font-bold ${trimestre === n ? 'text-white' : 'text-gray-600'}`}>{etiquetaTrimestre(n)}</Text></TouchableOpacity>)}</View>
        {libroCargando ? <ActivityIndicator className="my-8" color="#801529" /> : null}
        {!libroCargando && libro ? <View className="gap-3 mt-4">
          <View className="flex-row flex-wrap gap-2.5">
            <View className="flex-1 min-w-[135px] bg-gray-50 rounded-xl p-3"><Text className="text-[10px] font-bold uppercase text-gray-500">Promedio del curso</Text><Text className="text-xl font-black text-gray-900 mt-1">{notaTexto(resumenCurso.promedio)}</Text><Text className="text-[10px] text-gray-500">{etiquetaTrimestre(trimestre)}</Text></View>
            <View className="flex-1 min-w-[135px] bg-blue-50 rounded-xl p-3"><Text className="text-[10px] font-bold uppercase text-blue-700">Asistencia</Text><Text className="text-xl font-black text-blue-900 mt-1">{resumenCurso.asistencia === null ? '—' : `${Math.round(resumenCurso.asistencia)}%`}</Text><Text className="text-[10px] text-blue-700">promedio del curso</Text></View>
            <View className="flex-1 min-w-[135px] bg-amber-50 rounded-xl p-3"><Text className="text-[10px] font-bold uppercase text-amber-700">Actividades presentadas</Text><Text className="text-xl font-black text-amber-900 mt-1">{totalEntregas}/{resumenCurso.totalEstudiantes * resumenCurso.totalActividadesPublicadas}</Text><Text className="text-[10px] text-amber-700">{resumenCurso.presentados} estudiantes con entregas</Text></View>
          </View>
          <View className="flex-row flex-wrap gap-2"><View className="bg-red-50 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-red-700">En riesgo: {resumenCurso.riesgo}</Text></View><View className="bg-blue-50 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-blue-700">En observación: {resumenCurso.observacion}</Text></View><View className="bg-green-50 px-3 py-2 rounded-lg"><Text className="text-xs font-bold text-green-700">Sin riesgo: {resumenCurso.sinRiesgo}</Text></View></View>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 min-w-[250px] rounded-2xl border border-gray-100 bg-white p-4"><Text className="mb-3 text-sm font-bold text-gray-900">Riesgo académico</Text><GraficoRiesgo riesgo={resumenCurso.riesgo} observacion={resumenCurso.observacion} sinRiesgo={resumenCurso.sinRiesgo} total={resumenCurso.totalEstudiantes} /></View>
            <View className="flex-1 min-w-[250px] rounded-2xl border border-gray-100 bg-white p-4"><Text className="mb-4 text-sm font-bold text-gray-900">Avance de {etiquetaTrimestre(trimestre)}</Text><View className="gap-4"><BarraCurso etiqueta="Promedio de notas" porcentaje={resumenCurso.promedio ?? 0} color="#801529" /><BarraCurso etiqueta="Asistencia" porcentaje={resumenCurso.asistencia ?? 0} color="#2563EB" /><BarraCurso etiqueta="Entregas presentadas" porcentaje={resumenCurso.totalEstudiantes * resumenCurso.totalActividadesPublicadas ? totalEntregas / (resumenCurso.totalEstudiantes * resumenCurso.totalActividadesPublicadas) * 100 : 0} color="#D97706" /></View></View>
          </View>
          <View className="rounded-2xl border border-violet-100 bg-violet-50 p-4"><View className="mb-3 flex-row items-center gap-2"><Ionicons name="trophy-outline" size={19} color="#6D28D9" /><Text className="text-sm font-bold text-violet-950">Puntos conseguidos</Text></View><RankingRachasCurso cursoPeriodoId={asignacion.cursoPeriodoId} /></View>
        </View> : null}
        {estudianteSeleccionado ? (() => {
          const student = estudiantes.find((item) => item.id === estudianteSeleccionado);
          const linea = lineasPorEstudiante.get(estudianteSeleccionado);
          if (!student || !linea) return null;
          const juego = rankingPorEstudiante.get(estudianteSeleccionado);
          const rachaActual = Math.max(juego?.rachaActual ?? 0, gamificacionIndividual?.rachaActual ?? 0);
          const mejorRacha = Math.max(juego?.mejorRacha ?? 0, gamificacionIndividual?.mejorRacha ?? 0);
          const puntosCurso = Math.max(juego?.puntosIndividuales ?? 0, gamificacionIndividual?.puntosCurso ?? 0);
          return <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={() => setEstudianteSeleccionado('')}>
            <View className="flex-1 justify-end bg-black/50 md:justify-center md:p-5">
              <View className="w-full max-h-[92%] overflow-hidden rounded-t-3xl bg-[#F8F7F6] md:max-w-3xl md:self-center md:rounded-3xl">
                <View className="flex-row items-center justify-between border-b border-gray-100 bg-white p-4">
                  <View className="flex-1 pr-3"><Text className="text-lg font-bold text-gray-900">{student.nombre}</Text><Text className="text-xs text-gray-500 mt-1">{asignacion.materia} · {asignacion.curso}° {asignacion.nivel} · Paralelo {asignacion.paralelo} · {etiquetaTrimestre(trimestre)}</Text></View>
                  <TouchableOpacity onPress={() => setEstudianteSeleccionado('')} className="w-9 h-9 items-center justify-center rounded-full bg-gray-100"><Ionicons name="close" size={19} color="#4B5563" /></TouchableOpacity>
                </View>
                <ScrollView contentContainerClassName="gap-3 p-4" showsVerticalScrollIndicator={false}>
                  <View className="flex-row flex-wrap gap-2">
                    <View className="flex-1 min-w-[120px] rounded-xl bg-white p-3"><Text className="text-[10px] font-bold uppercase text-gray-500">Nota del trimestre</Text><Text className="mt-1 text-lg font-black text-maroon">{notaTexto(linea.promedio)}</Text></View>
                    <View className="flex-1 min-w-[120px] rounded-xl bg-white p-3"><Text className="text-[10px] font-bold uppercase text-gray-500">Promedio global</Text><Text className="mt-1 text-lg font-black text-gray-900">{notaTexto(notasGlobales.get(student.id))}</Text></View>
                    <View className="flex-1 min-w-[120px] rounded-xl bg-white p-3"><Text className="text-[10px] font-bold uppercase text-gray-500">Asistencia</Text><Text className="mt-1 text-lg font-black text-gray-900">{linea.asistencia.tasa === null ? '—' : `${linea.asistencia.tasa}%`}</Text><Text className="text-[10px] text-gray-500">{linea.asistencia.presentes} presentes · {linea.asistencia.ausentes} ausencias</Text></View>
                    <View className="flex-1 min-w-[120px] rounded-xl bg-white p-3"><Text className="text-[10px] font-bold uppercase text-gray-500">Actividades de materia</Text><Text className="mt-1 text-lg font-black text-gray-900">{entregasPorEstudiante[student.id] ?? 0}/{libro?.encargos.length ?? 0}</Text><Text className="text-[10px] text-gray-500">entregadas / publicadas</Text></View>
                  </View>
                  <View className="rounded-2xl border border-violet-100 bg-white p-4"><View className="mb-3 flex-row items-center gap-2"><Ionicons name="trophy-outline" size={18} color="#6D28D9" /><Text className="text-sm font-bold text-gray-900">Gamificación</Text></View><View className="flex-row flex-wrap gap-2"><View className="flex-1 min-w-[120px] rounded-xl bg-violet-50 p-3"><Text className="text-[10px] font-bold uppercase text-violet-700">Puntos del curso</Text><Text className="mt-1 text-lg font-black text-violet-950">{puntosCurso}</Text></View><View className="flex-1 min-w-[120px] rounded-xl bg-amber-50 p-3"><Text className="text-[10px] font-bold uppercase text-amber-700">Racha actual</Text><Text className="mt-1 text-lg font-black text-amber-950">{rachaActual} días</Text><Text className="text-[10px] text-amber-800">{gamificacionIndividual?.rachaCompletadaHoy ? gamificacionIndividual.rachaSalvadaConPuntos ? 'salvada hoy' : 'activada hoy' : rachaActual > 0 ? 'racha registrada' : 'sin racha activa'}</Text></View><View className="flex-1 min-w-[120px] rounded-xl bg-gray-50 p-3"><Text className="text-[10px] font-bold uppercase text-gray-500">Mejor racha</Text><Text className="mt-1 text-lg font-black text-gray-900">{mejorRacha} días</Text></View></View><View className="mt-3 rounded-xl bg-gray-50 p-3"><Text className="text-xs font-bold text-gray-800">Actividades gamificadas de {asignacion.materia}</Text>{detalleCargando ? <ActivityIndicator className="my-2" color="#801529" /> : gamificacionIndividual ? <View className="mt-2 flex-row flex-wrap gap-x-5 gap-y-2"><Text className="text-xs text-gray-600">Completadas: <Text className="font-bold text-gray-900">{gamificacionIndividual.actividadesCompletadas}</Text></Text><Text className="text-xs text-gray-600">Acierto promedio: <Text className="font-bold text-gray-900">{gamificacionIndividual.promedioAcierto === null ? '—' : `${Math.round(gamificacionIndividual.promedioAcierto)}%`}</Text></Text><Text className="text-xs text-gray-600">Puntos de actividades: <Text className="font-bold text-gray-900">{gamificacionIndividual.puntosGanados}</Text></Text></View> : <Text className="mt-1 text-xs text-gray-500">No hay actividades gamificadas registradas en esta materia.</Text>}</View>{juego ? <Text className="mt-2 text-[10px] text-violet-700">Nivel {juego.nivel} · rango {juego.rango} · {juego.insigniasCount} insignias</Text> : null}<Text className="mt-2 text-[10px] leading-4 text-gray-400">Los puntos y la racha corresponden al curso. Las actividades y su acierto corresponden a esta materia.</Text></View>
                  <FichaAprendizajeEstudiante usuarioId={linea.usuarioId} modoDocente />
                </ScrollView>
              </View>
            </View>
          </Modal>;
        })() : null}
        <View className="mt-4">
          {estudiantes.length ? estudiantes.map((student) => {
            const linea = lineasPorEstudiante.get(student.id);
            const riesgo = linea?.nivelRiesgo;
            return <TouchableOpacity key={student.id} activeOpacity={0.75} onPress={() => setEstudianteSeleccionado(student.id)} className="flex-row flex-wrap items-center gap-3 py-3 border-b border-gray-100">
              <View className="w-10 h-10 rounded-xl bg-rose-50 items-center justify-center"><Text className="text-sm font-bold text-maroon">{student.nombre.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</Text></View>
              <View className="flex-1 min-w-[145px]"><Text className="text-sm font-semibold text-gray-800">{student.nombre}</Text><Text className="text-[11px] text-gray-500 mt-1">{entregasPorEstudiante[student.id] ?? 0} actividades entregadas · {linea?.tareasCalificadas ?? 0}/{linea?.tareasPublicadas ?? 0} notas</Text></View>
              <View className="items-end"><Text className="text-[10px] uppercase font-bold text-gray-400">Promedio del trimestre</Text><Text className="text-base font-bold text-maroon">{notaTexto(linea?.promedio)}</Text></View>
              <View className="items-end min-w-[74px]"><Text className="text-[10px] uppercase font-bold text-gray-400">Asistencia</Text><Text className="text-sm font-bold text-gray-800">{linea?.asistencia.tasa === null || linea?.asistencia.tasa === undefined ? '—' : `${linea.asistencia.tasa}%`}</Text></View>
              <View className="min-w-[76px] items-end"><Text className={`text-[10px] font-bold ${riesgo === 'riesgo_alto' || riesgo === 'riesgo' ? 'text-red-700' : riesgo === 'observacion' ? 'text-amber-700' : 'text-green-700'}`}>{riesgo === 'riesgo_alto' ? 'Riesgo alto' : riesgo === 'riesgo' ? 'En riesgo' : riesgo === 'observacion' ? 'Observar' : 'Sin riesgo'}</Text></View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>;
          }) : <Text className="text-sm text-gray-500 text-center py-8">No hay estudiantes inscritos en este paralelo.</Text>}
        </View>
      </BentoCard> : null}

      {tab === 'asistencia' ? <BentoCard className="p-5">
        <View><Text className="text-lg font-bold text-gray-900">Asistencia de hoy</Text><Text className="text-xs text-gray-500 mt-1">{asignacion.materia} · {asignacion.curso}° {asignacion.nivel} · Paralelo {asignacion.paralelo} · {fecha}</Text></View>
        {horariosCargando ? <View className="py-8 items-center"><ActivityIndicator color="#801529" /><Text className="text-xs text-gray-500 mt-2">Revisando el horario…</Text></View> : sesionesAhora.length === 0 ? <View className="items-center rounded-2xl bg-amber-50 border border-amber-100 p-6 mt-4"><Ionicons name="time-outline" size={30} color="#B45309" /><Text className="text-sm font-bold text-amber-900 text-center mt-2">No tienes clases de esta materia con este curso ahora.</Text><Text className="text-xs text-amber-800 text-center mt-1">La asistencia solo se habilita durante el horario asignado.</Text></View> : <>
          <View className="flex-row flex-wrap items-center gap-2 rounded-xl bg-green-50 border border-green-100 p-3 mt-4"><Ionicons name="time-outline" size={17} color="#15803D" /><Text className="text-xs font-bold text-green-800">Clase en curso · {sesionesAhora.map((item) => `${item.horaInicio.slice(0, 5)}–${item.horaFin.slice(0, 5)}`).join(', ')}</Text></View>
          <View className="flex-row flex-wrap gap-2 mt-4">{ESTADOS.map((state) => <View key={state.key} className="flex-row items-center gap-1.5 bg-gray-50 px-2.5 py-2 rounded-lg"><View className="w-2 h-2 rounded-full" style={{ backgroundColor: state.color }} /><Text className="text-[11px] text-gray-600">{state.label}</Text></View>)}</View>
          <View className="gap-2 mt-3">{estudiantes.map((student) => <View key={student.id} className="gap-3 p-3 bg-gray-50 rounded-xl"><Text className="text-sm font-semibold text-gray-800">{student.nombre}</Text><View className="flex-row flex-wrap gap-2">{ESTADOS.map((state) => <TouchableOpacity key={state.key} onPress={() => setEstados((prev) => ({ ...prev, [student.id]: state.key }))} className={`px-3 py-2 rounded-lg border ${estados[student.id] === state.key ? 'bg-white border-gray-300' : 'border-transparent'}`}><Text style={{ color: state.color }} className="text-xs font-semibold">{state.label}</Text></TouchableOpacity>)}</View></View>)}</View>
          {estudiantes.length === 0 ? <Text className="text-sm text-gray-500 py-6 text-center">No hay estudiantes inscritos en este paralelo.</Text> : <TouchableOpacity disabled={guardando} onPress={() => void guardarAsistencia()} className="mt-4 bg-maroon rounded-xl py-3.5 items-center"><Text className="text-white font-bold">{guardando ? 'Guardando…' : 'Guardar asistencia'}</Text></TouchableOpacity>}
          {mensaje ? <Text className="text-sm text-center text-gray-600 mt-2">{mensaje}</Text> : null}
        </>}
      </BentoCard> : null}

      {tab === 'notas' ? <BentoCard className="p-5">
        <View className="flex-row flex-wrap items-center justify-between gap-3"><View><Text className="text-lg font-bold text-gray-900">Notas y casillero</Text><Text className="text-xs text-gray-500 mt-1">Resumen de calificaciones y asistencia por estudiante.</Text></View><View className="flex-row gap-1.5">{[1, 2, 3].map((n) => <TouchableOpacity key={n} onPress={() => setTrimestre(n)} className={`px-3 py-2 rounded-lg ${trimestre === n ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-xs font-bold ${trimestre === n ? 'text-white' : 'text-gray-700'}`}>{n}° trim.</Text></TouchableOpacity>)}</View></View>
        {libro?.trimestre ? <View className="flex-row flex-wrap gap-3 mt-4"><View className="flex-1 min-w-[140px] rounded-xl bg-gray-50 p-3"><Text className="text-[10px] font-bold uppercase text-gray-500">Clases planificadas</Text><Text className="text-lg font-bold text-gray-900 mt-1">{clasesPlanificadas}</Text></View><View className="flex-1 min-w-[140px] rounded-xl bg-green-50 p-3"><Text className="text-[10px] font-bold uppercase text-green-700">Clases realizadas</Text><Text className="text-lg font-bold text-green-800 mt-1">{clasesRealizadas}</Text></View></View> : null}
        {libroCargando ? <ActivityIndicator className="my-8" color="#801529" /> : !libro ? <Text className="py-8 text-center text-sm text-gray-500">No se pudo cargar el casillero.</Text> : <ScrollView horizontal className="mt-4"><View>
          <View className="flex-row bg-gray-100 rounded-t-xl">{['Estudiante', 'Global', etiquetaTrimestre(trimestre), 'Asistencia', ...libro.encargos.map((item) => item.titulo)].map((title, index) => <View key={`${title}-${index}`} className={`${index === 0 ? 'w-52' : 'w-36'} min-h-14 p-3 border-r border-white justify-center`}><Text className="text-xs font-bold text-gray-700">{title}</Text></View>)}</View>
          {libro.lineas.map((linea: LineaLibro) => {
            const student = estudiantes.find((item) => item.id === linea.estudianteId) ?? { id: linea.estudianteId, nombre: `${linea.apellidoPaterno} ${linea.nombre}`.trim() };
            const asistencia = linea.asistencia.total ? `${linea.asistencia.presentes}/${linea.asistencia.total} · ${linea.asistencia.tasa ?? 0}%` : 'Sin registros';
            return <View key={linea.estudianteId} className="flex-row border-b border-gray-100">
              <View className="w-52 p-3 justify-center"><Text className="text-xs font-semibold text-gray-800">{student.nombre}</Text></View>
              <View className="w-36 p-3 justify-center bg-gray-50"><Text className="text-sm font-bold text-gray-800">{notaTexto(notasGlobales.get(linea.estudianteId))}</Text></View>
              <View className="w-36 p-3 justify-center bg-rose-50"><Text className="text-sm font-bold text-maroon">{notaTexto(linea.promedio)}</Text></View>
              <View className="w-36 p-3 justify-center"><Text className="text-xs font-semibold text-gray-700">{asistencia}</Text><Text className="text-[10px] text-gray-400 mt-1">{linea.asistencia.ausentes} ausencias</Text></View>
              {libro.encargos.map((encargo) => {
                const key = `${encargo.id}:${student.id}`;
                return <View key={encargo.id} className="w-36 p-2 border-l border-gray-100 justify-center"><View className="flex-row items-center gap-1"><TextInput accessibilityLabel={`Nota ${encargo.titulo} ${student.nombre}`} keyboardType="numeric" value={notas[key] ?? ''} onChangeText={(value) => setNotas((prev) => ({ ...prev, [key]: value }))} placeholder="—" className="flex-1 min-w-0 px-2 py-2 border border-gray-300 rounded-lg text-xs" /><TouchableOpacity disabled={guardandoNota === key} onPress={() => void guardarNota(encargo.id, student)} className="px-2.5 py-2 rounded-lg bg-maroon"><Text className="text-white text-xs font-bold">{guardandoNota === key ? '…' : 'OK'}</Text></TouchableOpacity></View></View>;
              })}
            </View>;
          })}
          {libro.lineas.length === 0 ? <Text className="py-8 text-center text-sm text-gray-500">No hay estudiantes para mostrar en este trimestre.</Text> : null}
        </View></ScrollView>}
        <Text className="text-[11px] text-gray-400 mt-3">Global: promedio ponderado de los trimestres con notas registradas. Trimestre: promedio de {etiquetaTrimestre(trimestre)}.</Text>
      </BentoCard> : null}
          </ScrollView>
        </View>
      </View>
    </Modal> : null}
  </ScrollView>;
}
