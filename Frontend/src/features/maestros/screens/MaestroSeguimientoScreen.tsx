import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicManagementApi, academicServicesApi } from '../../../api/academicServices.api';
import { seguimientoApi, type LibroNotas } from '../../../api/seguimiento.api';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';

type Opcion = { id: string; label: string };
type Asignacion = { id: string; materiaId: string; materia: string; cursoPeriodoId: string; curso: string; paralelo: string; nivel: string };
type Estudiante = { id: string; nombre: string };
type Tab = 'asistencia' | 'notas';

const ESTADOS = [
  { key: 'presente', label: 'Asistió', icon: 'checkmark-circle' as const, color: '#15803D' },
  { key: 'justificado', label: 'Licencia', icon: 'document-text' as const, color: '#B45309' },
  { key: 'ausente', label: 'No asistió', icon: 'close-circle' as const, color: '#B91C1C' },
];

export function MaestroSeguimientoScreen() {
  const { user } = useAuth();
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [materiaId, setMateriaId] = useState('');
  const [curso, setCurso] = useState('');
  const [paralelo, setParalelo] = useState('');
  const [tab, setTab] = useState<Tab>('asistencia');
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [trimestre, setTrimestre] = useState(1);
  const [libro, setLibro] = useState<LibroNotas | null>(null);
  const [fechasClases, setFechasClases] = useState<string[]>([]);
  const [libroCargando, setLibroCargando] = useState(false);
  const [estudianteId, setEstudianteId] = useState('');
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [guardandoNota, setGuardandoNota] = useState('');

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

  const materias = useMemo<Opcion[]>(() => [...new Map(asignaciones.map((a) => [a.materiaId, { id: a.materiaId, label: a.materia }])).values()], [asignaciones]);
  const cursos = useMemo<Opcion[]>(() => [...new Map(asignaciones.filter((a) => a.materiaId === materiaId).map((a) => [a.curso, { id: a.curso, label: `${a.curso}° ${a.nivel}` }])).values()], [asignaciones, materiaId]);
  const paralelos = useMemo<Opcion[]>(() => [...new Map(asignaciones.filter((a) => a.materiaId === materiaId && a.curso === curso).map((a) => [a.paralelo, { id: a.paralelo, label: `Paralelo ${a.paralelo}` }])).values()], [asignaciones, materiaId, curso]);
  const asignacion = asignaciones.find((a) => a.materiaId === materiaId && a.curso === curso && a.paralelo === paralelo);

  const cargarEstudiantes = useCallback(async () => {
    if (!asignacion) { setEstudiantes([]); return; }
    try {
      const res = await academicServicesApi.listAll('inscripciones', { cursoPeriodoId: asignacion.cursoPeriodoId });
      setEstudiantes(res.map((row: any) => ({ id: String(row.estudianteId ?? row.estudiante?.id ?? ''), nombre: `${row.estudiante?.apellidoPaterno ?? row.apellidoPaterno ?? ''} ${row.estudiante?.apellidoMaterno ?? ''} ${row.estudiante?.nombre ?? row.nombre ?? 'Estudiante'}`.trim() })).filter((row: Estudiante) => row.id));
    } catch { setEstudiantes([]); }
  }, [asignacion]);

  useEffect(() => { void cargarEstudiantes(); }, [cargarEstudiantes]);

  useEffect(() => {
    if (!asignacion || tab !== 'notas') return;
    let vigente = true;
    setLibroCargando(true);
    seguimientoApi.libro({ cursoPeriodoId: asignacion.cursoPeriodoId, materiaId: asignacion.materiaId, trimestre })
      .then((data) => { if (vigente) setLibro(data); })
      .finally(() => { if (vigente) setLibroCargando(false); });
    return () => { vigente = false; };
  }, [asignacion, tab, trimestre]);

  useEffect(() => {
    if (!asignacion || tab !== 'asistencia') return;
    academicServicesApi.list('asistencia', { asignacionId: asignacion.id, fecha, limit: 200 })
      .then((res) => {
        const inicial: Record<string, string> = {};
        (res.data as any[]).forEach((row) => { inicial[String(row.estudianteId)] = String(row.estado); });
        setEstados(inicial);
      }).catch(() => setEstados({}));
  }, [asignacion, fecha, tab]);

  useEffect(() => {
    if (!libro || !asignacion || tab !== 'notas' || !libro.trimestre) { setFechasClases([]); return; }
    let vigente = true;
    academicManagementApi.listSchedules(libro.periodo.id, { cursoPeriodoId: asignacion.cursoPeriodoId })
      .then((rows) => {
        const sesiones = (rows as any[]).filter((row) =>
          String(row.materiaId ?? row.materia?.id ?? '') === asignacion.materiaId &&
          (!user?.maestroId || String(row.maestroId ?? row.maestro?.id ?? '') === String(user.maestroId)),
        );
        const inicio = new Date(`${libro.trimestre!.inicio.slice(0, 10)}T00:00:00`);
        const fin = new Date(`${libro.trimestre!.fin.slice(0, 10)}T00:00:00`);
        const fechas = new Set<string>();
        sesiones.forEach((sesion) => {
          const fechaClase = new Date(inicio);
          while (fechaClase <= fin) {
            const dia = fechaClase.getDay() === 0 ? 7 : fechaClase.getDay();
            if (dia === Number(sesion.diaSemana)) fechas.add(fechaClase.toISOString().slice(0, 10));
            fechaClase.setDate(fechaClase.getDate() + 1);
          }
        });
        if (vigente) setFechasClases([...fechas].sort());
      })
      .catch(() => { if (vigente) setFechasClases([]); });
    return () => { vigente = false; };
  }, [libro, asignacion, tab, user?.maestroId]);

  useEffect(() => {
    if (!libro || tab !== 'notas') return;
    let vigente = true;
    Promise.all(libro.encargos.map((encargo) => academicServicesApi.listAll('calificaciones', { encargoId: encargo.id })
      .then((rows) => rows.map((row: any) => ({ key: `${encargo.id}:${row.estudianteId}`, nota: String(row.nota ?? '') })))
      .catch(() => [])))
      .then((results) => {
        if (!vigente) return;
        const guardadas = Object.fromEntries(results.flat().map((row) => [row.key, row.nota]));
        setNotas((actuales) => ({ ...guardadas, ...actuales }));
      });
    return () => { vigente = false; };
  }, [libro, tab]);

  const guardarAsistencia = async () => {
    if (!asignacion || estudiantes.length === 0) return;
    if (estudiantes.some((student) => !estados[student.id])) {
      setMensaje('Selecciona un estado para cada estudiante antes de guardar.');
      return;
    }
    setGuardando(true); setMensaje('');
    try {
      await academicServicesApi.bulk('asistencia', { asignacionId: asignacion.id, fecha, asistencias: estudiantes.map((student) => ({ estudianteId: student.id, estado: estados[student.id] })) });
      setMensaje('Asistencia guardada.');
    } catch (error) { setMensaje(error instanceof Error ? error.message : 'No se pudo guardar la asistencia.'); }
    finally { setGuardando(false); }
  };

  const guardarNota = async (encargoId: string, estudiante: Estudiante) => {
    const nota = Number(notas[`${encargoId}:${estudiante.id}`]);
    if (!Number.isFinite(nota) || nota < 0 || nota > 100) return;
    setGuardandoNota(`${encargoId}:${estudiante.id}`);
    try {
      await academicServicesApi.bulk('calificaciones', { encargoId, calificaciones: [{ estudianteId: estudiante.id, nota }] });
      const actualizado = await seguimientoApi.libro({ cursoPeriodoId: asignacion!.cursoPeriodoId, materiaId: asignacion!.materiaId, trimestre });
      setLibro(actualizado);
    } finally { setGuardandoNota(''); }
  };

  const selector = (titulo: string, valor: string, opciones: Opcion[], cambiar: (value: string) => void) => (
    <View className="flex-1 min-w-[150px]">
      <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">{titulo}</Text>
      <View className="flex-row flex-wrap gap-2">{opciones.map((opcion) => <TouchableOpacity key={opcion.id} onPress={() => cambiar(opcion.id)} className={`px-3 py-2 rounded-xl border ${valor === opcion.id ? 'bg-maroon border-maroon' : 'bg-gray-50 border-gray-200'}`}><Text className={`text-xs font-semibold ${valor === opcion.id ? 'text-white' : 'text-gray-700'}`}>{opcion.label}</Text></TouchableOpacity>)}</View>
    </View>
  );

  if (cargando) return <View className="py-16 items-center"><ActivityIndicator size="large" color="#801529" /><Text className="text-sm text-gray-500 mt-3">Cargando tus materias…</Text></View>;

  return <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
    <BentoCard className="p-5"><Text className="text-2xl font-bold text-gray-900">Seguimiento de mis cursos</Text><Text className="text-sm text-gray-500 mt-1">Asistencia diaria y casillero trimestral de tus estudiantes.</Text>
      <View className="flex-row flex-wrap gap-5 mt-5">{selector('Materia', materiaId, materias, (value) => { setMateriaId(value); setCurso(''); setParalelo(''); setEstudianteId(''); })}{selector('Curso', curso, cursos, (value) => { setCurso(value); setParalelo(''); setEstudianteId(''); })}{selector('Paralelo', paralelo, paralelos, (value) => { setParalelo(value); setEstudianteId(''); })}</View>
    </BentoCard>
    {asignacion ? <>
      <BentoCard className="p-3"><View className="flex-row gap-2">{(['asistencia', 'notas'] as Tab[]).map((value) => <TouchableOpacity key={value} onPress={() => setTab(value)} className={`flex-1 flex-row justify-center items-center gap-2 py-3 rounded-xl ${tab === value ? 'bg-maroon' : 'bg-gray-100'}`}><Ionicons name={value === 'asistencia' ? 'calendar-outline' : 'grid-outline'} size={17} color={tab === value ? '#fff' : '#4B5563'} /><Text className={`text-sm font-bold ${tab === value ? 'text-white' : 'text-gray-700'}`}>{value === 'asistencia' ? 'Listado de estudiantes · Asistencia' : 'Notas y casillero'}</Text></TouchableOpacity>)}</View></BentoCard>
      {tab === 'asistencia' ? <BentoCard className="p-5"><View className="flex-row flex-wrap items-center justify-between gap-3"><View><Text className="text-lg font-bold text-gray-900">Asistencia diaria</Text><Text className="text-xs text-gray-500">{asignacion.materia} · {asignacion.curso}° {asignacion.paralelo}</Text></View><View className="flex-row items-center gap-2"><Text className="text-xs text-gray-600">Fecha</Text><TextInput value={fecha} onChangeText={setFecha} placeholder="AAAA-MM-DD" className="px-3 py-2 rounded-lg border border-gray-300 text-sm" /></View></View>
        <View className="gap-2 mt-4">{estudiantes.map((student) => <View key={student.id} className="flex-row flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-xl"><Text className="flex-1 min-w-[180px] text-sm font-semibold text-gray-800">{student.nombre}</Text><View className="flex-row gap-1">{ESTADOS.map((state) => <TouchableOpacity key={state.key} onPress={() => setEstados((prev) => ({ ...prev, [student.id]: state.key }))} className={`px-2.5 py-2 rounded-lg border ${ estados[student.id] === state.key ? 'bg-white border-gray-300' : 'border-transparent'}`}><Text style={{ color: state.color }} className="text-xs font-semibold">{state.label}</Text></TouchableOpacity>)}</View></View>)}</View>
        {estudiantes.length === 0 ? <Text className="text-sm text-gray-500 py-6 text-center">No hay estudiantes inscritos en este paralelo.</Text> : <TouchableOpacity disabled={guardando} onPress={() => void guardarAsistencia()} className="mt-4 bg-maroon rounded-xl py-3 items-center"><Text className="text-white font-bold">{guardando ? 'Guardando…' : 'Guardar asistencia'}</Text></TouchableOpacity>}{mensaje ? <Text className="text-sm text-center text-gray-600 mt-2">{mensaje}</Text> : null}
      </BentoCard> : <BentoCard className="p-5"><View className="flex-row items-center justify-between flex-wrap gap-3"><View><Text className="text-lg font-bold text-gray-900">Casillero trimestral</Text><Text className="text-xs text-gray-500">Las notas y promedios se recalculan con el libro académico.</Text></View><View className="flex-row gap-2">{[1, 2, 3].map((n) => <TouchableOpacity key={n} onPress={() => setTrimestre(n)} className={`px-3 py-2 rounded-lg ${trimestre === n ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-xs font-bold ${trimestre === n ? 'text-white' : 'text-gray-700'}`}>{n}° trimestre</Text></TouchableOpacity>)}</View></View>
        {libro?.trimestre ? <View className="mt-4 p-3 bg-gray-50 rounded-xl"><Text className="text-xs font-bold text-gray-700">Clases planificadas · {fechasClases.length} sesiones</Text><Text className="text-[11px] text-gray-500 mt-1">{fechasClases.length ? fechasClases.map((date) => new Date(`${date}T00:00:00`).toLocaleDateString('es-BO')).join(' · ') : 'No se encontraron sesiones de esta materia en el horario del trimestre.'}</Text></View> : null}
        {libroCargando ? <ActivityIndicator className="my-8" color="#801529" /> : !libro ? <Text className="py-8 text-center text-sm text-gray-500">No se pudo cargar el libro de notas.</Text> : <ScrollView horizontal className="mt-4"><View><View className="flex-row bg-gray-100 rounded-t-xl">{['Estudiante', ...libro.encargos.map((item) => `${item.titulo} · ${item.fechaLimite?.slice(0, 10) ?? 'Sin fecha'}`), 'Promedio'].map((title, index) => <View key={`${title}-${index}`} className="w-44 min-h-14 p-3 border-r border-white justify-center"><Text className="text-xs font-bold text-gray-700">{title}</Text></View>)}</View>{libro.lineas.map((linea) => <View key={linea.estudianteId} className="flex-row border-b border-gray-100">{<TouchableOpacity onPress={() => setEstudianteId(estudianteId === linea.estudianteId ? '' : linea.estudianteId)} className="w-44 p-3 justify-center"><Text className="text-xs font-semibold text-gray-800">{linea.apellidoPaterno} {linea.nombre}</Text></TouchableOpacity>}{libro.encargos.map((encargo) => { const student = estudiantes.find((item) => item.id === linea.estudianteId) ?? { id: linea.estudianteId, nombre: linea.nombre }; const key = `${encargo.id}:${student.id}`; return <View key={encargo.id} className="w-44 p-2 border-l border-gray-100"><View className="flex-row gap-1"><TextInput accessibilityLabel={`Nota ${encargo.titulo} ${student.nombre}`} keyboardType="numeric" value={notas[key] ?? ''} onChangeText={(value) => setNotas((prev) => ({ ...prev, [key]: value }))} className="w-[72px] px-1.5 py-1.5 border border-gray-300 rounded-md text-xs" /><TouchableOpacity disabled={guardandoNota === key} onPress={() => void guardarNota(encargo.id, student)} className="px-2 py-1 rounded-md bg-maroon"><Text className="text-white text-xs">{guardandoNota === key ? '…' : 'OK'}</Text></TouchableOpacity></View></View>; })}<View className="w-44 p-3 justify-center bg-rose-50"><Text className="text-sm font-bold text-maroon">{linea.promedio === null ? '—' : linea.promedio.toFixed(1)}</Text></View></View>)}</View></ScrollView>}
        {estudianteId && libro ? <View className="mt-4 p-4 rounded-xl bg-rose-50"><Text className="text-sm font-bold text-gray-900">Casillero de {libro.lineas.find((item) => item.estudianteId === estudianteId)?.nombre}</Text><Text className="text-xs text-gray-600 mt-1">Promedio actual: {libro.lineas.find((item) => item.estudianteId === estudianteId)?.promedio?.toFixed(1) ?? 'Sin notas'}</Text><View className="gap-2 mt-3">{libro.encargos.map((encargo) => <View key={encargo.id} className="flex-row justify-between gap-3 py-2 border-b border-rose-100"><Text className="flex-1 text-xs text-gray-700">{encargo.titulo} · {encargo.fechaLimite?.slice(0, 10) ?? 'Sin fecha de entrega'}</Text><Text className="text-xs font-bold text-maroon">{notas[`${encargo.id}:${estudianteId}`] || 'Pendiente'}</Text></View>)}</View></View> : null}
      </BentoCard>}
    </> : <BentoCard className="p-8 items-center"><Ionicons name="filter-outline" size={34} color="#9CA3AF" /><Text className="text-sm text-gray-600 mt-2">Selecciona materia, curso y paralelo para ver su seguimiento.</Text></BentoCard>}
  </ScrollView>;
}
