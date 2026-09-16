import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { academicServicesApi, type ServiceResource } from '../../../api/academicServices.api';
import { usuariosApi } from '../../../api/usuarios.api';
import { useAuth } from '../../../context/AuthContext';
import { BirthDatePicker } from '../../usuarios/components/BirthDatePicker';

type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'choice';
type ReferenceSource = 'periodos' | 'cursos' | 'materias' | 'cursos-periodo' | 'asignaciones' | 'encargos' | 'materiales' | 'estudiantes' | 'docentes';
type Field = { key: string; label: string; type?: FieldType; required?: boolean; options?: string[]; hint?: string; reference?: ReferenceSource; multiple?: boolean };
type Definition = { title: string; resource: ServiceResource; fields: Field[]; management?: boolean; bulk?: boolean; withdraw?: boolean };
type Item = Record<string, any>;

const definitions: Definition[] = [
  { title: 'Periodos académicos', resource: 'periodos', management: true, fields: [
    { key: 'anio', label: 'Año lectivo', type: 'number', required: true }, { key: 'nombre', label: 'Nombre del periodo', required: true },
    { key: 'fechaInicio', label: 'Fecha de inicio (AAAA-MM-DD)', type: 'date', required: true }, { key: 'fechaFin', label: 'Fecha de fin (AAAA-MM-DD)', type: 'date', required: true }, { key: 'activo', label: 'Activo', type: 'boolean' },
  ] },
  { title: 'Cursos base', resource: 'cursos', management: true, fields: [
    { key: 'nivel', label: 'Nivel', type: 'choice', required: true, options: ['inicial', 'primaria', 'secundaria', 'bachillerato'] }, { key: 'grado', label: 'Grado', required: true }, { key: 'paralelo', label: 'Paralelo', required: true }, { key: 'capacidadMaxima', label: 'Capacidad máxima', type: 'number' }, { key: 'activo', label: 'Activo', type: 'boolean' },
  ] },
  { title: 'Materias', resource: 'materias', management: true, fields: [
    { key: 'codigo', label: 'Código único', required: true }, { key: 'nombre', label: 'Nombre de la materia', required: true }, { key: 'descripcion', label: 'Descripción' }, { key: 'activo', label: 'Activo', type: 'boolean' },
  ] },
  { title: 'Cursos por periodo', resource: 'cursos-periodo', management: true, fields: [
    { key: 'cursoId', label: 'Curso', required: true, reference: 'cursos' }, { key: 'periodoId', label: 'Periodo académico', required: true, reference: 'periodos' }, { key: 'estado', label: 'Estado', type: 'choice', options: ['activo', 'cerrado', 'cancelado'] },
  ] },
  { title: 'Inscripciones', resource: 'inscripciones', management: true, withdraw: true, fields: [
    { key: 'estudianteId', label: 'Estudiante', required: true, reference: 'estudiantes' }, { key: 'cursoPeriodoId', label: 'Curso y periodo', required: true, reference: 'cursos-periodo' }, { key: 'fechaInscripcion', label: 'Fecha de inscripción (AAAA-MM-DD)', type: 'date' }, { key: 'observacion', label: 'Observación' }, { key: 'estado', label: 'Estado', type: 'choice', options: ['activo', 'retirado', 'finalizado'] }, { key: 'fechaRetiro', label: 'Fecha de retiro (AAAA-MM-DD)', type: 'date' },
  ] },
  { title: 'Asignaciones docentes', resource: 'asignaciones', management: true, fields: [
    { key: 'maestroId', label: 'Docente', required: true, reference: 'docentes' }, { key: 'materiaId', label: 'Materia', required: true, reference: 'materias' }, { key: 'cursoPeriodoId', label: 'Curso y periodo', required: true, reference: 'cursos-periodo' }, { key: 'estado', label: 'Estado', type: 'choice', options: ['activo', 'finalizado', 'cancelado'] }, { key: 'fechaFinalizacion', label: 'Fecha de finalización (AAAA-MM-DD)', type: 'date' },
  ] },
  { title: 'Asesores de curso', resource: 'asesores', management: true, fields: [
    { key: 'cursoPeriodoId', label: 'Curso y periodo', required: true, reference: 'cursos-periodo' }, { key: 'maestroId', label: 'Docente asesor', required: true, reference: 'docentes' }, { key: 'fechaInicio', label: 'Fecha de inicio (AAAA-MM-DD)', type: 'date', required: true }, { key: 'fechaFin', label: 'Fecha de fin (AAAA-MM-DD)', type: 'date' },
  ] },
  { title: 'Materiales de clase', resource: 'materiales', fields: [
    { key: 'asignacionId', label: 'Asignación docente', required: true, reference: 'asignaciones' }, { key: 'titulo', label: 'Título del material', required: true }, { key: 'detalle', label: 'Detalle' }, { key: 'activo', label: 'Activo', type: 'boolean' },
  ] },
  { title: 'Encargos y evaluaciones', resource: 'encargos', fields: [
    { key: 'asignacionId', label: 'Asignación docente', required: true, reference: 'asignaciones' }, { key: 'tipo', label: 'Tipo (tarea, práctica, examen…)', required: true }, { key: 'titulo', label: 'Título', required: true }, { key: 'descripcion', label: 'Descripción' }, { key: 'ponderacion', label: 'Ponderación', type: 'number', required: true }, { key: 'fechaPublicacion', label: 'Fecha de publicación (ISO)', type: 'date' }, { key: 'fechaLimite', label: 'Fecha límite (ISO)', type: 'date' }, { key: 'estado', label: 'Estado', type: 'choice', options: ['borrador', 'publicado', 'cerrado', 'cancelado'] }, { key: 'materialIds', label: 'Materiales relacionados', reference: 'materiales', multiple: true },
  ] },
  { title: 'Calificaciones', resource: 'calificaciones', bulk: true, fields: [
    { key: 'encargoId', label: 'Encargo', required: true, reference: 'encargos' }, { key: 'estudianteId', label: 'Estudiante', required: true, reference: 'estudiantes' }, { key: 'nota', label: 'Nota', type: 'number', required: true }, { key: 'observacion', label: 'Observación' },
  ] },
  { title: 'Asistencia', resource: 'asistencia', bulk: true, fields: [
    { key: 'asignacionId', label: 'Asignación docente', required: true, reference: 'asignaciones' }, { key: 'estudianteId', label: 'Estudiante', required: true, reference: 'estudiantes' }, { key: 'fecha', label: 'Fecha (AAAA-MM-DD)', type: 'date', required: true }, { key: 'estado', label: 'Estado', type: 'choice', required: true, options: ['presente', 'ausente', 'atraso', 'justificado'] }, { key: 'justificacion', label: 'Justificación' },
  ] },
];

const fileTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const managementRoles = ['director', 'gerencia', 'control', 'editor'];
const teachingRoles = ['profesor', 'maestro', 'maestros', 'docente'];

const capitalize = (text?: string) => text ? text.charAt(0).toUpperCase() + text.slice(1) : '';

const formatCursoPeriodo = (item: Item) => {
  const grado = item.curso?.grado ?? '';
  const paralelo = item.curso?.paralelo ?? '';
  const nivel = capitalize(item.curso?.nivel);
  const anio = item.periodo?.anio ?? item.periodo?.nombre ?? '';
  return `${grado} ${paralelo} ${nivel} - Período ${anio}`.trim();
};

const formatCursoBase = (item: Item) => {
  const grado = item.grado ?? '';
  const paralelo = item.paralelo ?? '';
  const nivel = capitalize(item.nivel);
  return `${grado} ${paralelo} - ${nivel}`.trim();
};

const formatAsesor = (item: Item) => {
  const maestroName = item.maestro ? `${item.maestro.nombre ?? ''} ${item.maestro.apellidoPaterno ?? ''}`.trim() : 'Docente';
  const cursoLabel = item.cursoPeriodo?.curso
    ? `${item.cursoPeriodo.curso.grado ?? ''} ${item.cursoPeriodo.curso.paralelo ?? ''} ${capitalize(item.cursoPeriodo.curso.nivel)}`.trim()
    : 'Curso';
  return `${maestroName} - ${cursoLabel}`;
};

const initialValues = (definition: Definition) => {
  const base = Object.fromEntries(definition.fields.map((field) => [field.key, field.type === 'boolean' ? true : '']));
  if (definition.resource === 'inscripciones') {
    base.fechaInscripcion = new Date().toISOString().slice(0, 10);
    base.estado = 'activo';
    base.observacion = 'Sin observación';
  }
  if (definition.resource === 'asesores') {
    base.fechaInicio = new Date().toISOString().slice(0, 10);
  }
  return base;
};

const labelFor = (item: Item, resource?: ServiceResource) => {
  if (resource === 'cursos' || (item.nivel && item.grado && item.paralelo)) return formatCursoBase(item);
  if (resource === 'cursos-periodo' || item.cursoId) return formatCursoPeriodo(item);
  if (resource === 'asesores') return formatAsesor(item);
  return item.nombre ?? item.titulo ?? item.codigo ?? item.id;
};

const referenceLabel = (source: ReferenceSource, item: Item) => {
  if (source === 'estudiantes' || source === 'docentes') return `${item.nombre ?? ''} ${item.apellidoPaterno ?? ''} ${item.apellidoMaterno ?? ''}`.trim();
  if (source === 'periodos') return `${item.nombre} · ${item.anio}`;
  if (source === 'cursos') return formatCursoBase(item);
  if (source === 'cursos-periodo') return formatCursoPeriodo(item);
  if (source === 'asignaciones') return `${item.materia?.nombre ?? 'Materia'} · ${item.maestro?.nombre ?? 'Docente'} ${item.maestro?.apellidoPaterno ?? ''}`;
  return labelFor(item);
};


function ReferencePicker({ field, items, value, onChange }: { field: Field; items: Item[]; value: string | string[]; onChange: (value: string | string[]) => void }) {
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (id: string) => {
    if (field.multiple) onChange(selected.includes(id) ? selected.filter((current) => current !== id) : [...selected, id]);
    else { onChange(id); setOpen(false); }
  };
  const selectedLabel = selected.length ? selected.map((id) => referenceLabel(field.reference!, items.find((item) => String(item.id) === id) ?? { id })).join(', ') : `Seleccionar ${field.label.toLowerCase()}`;
  return <View><TouchableOpacity onPress={() => setOpen(!open)} className="bg-gray-100 rounded-xl px-3 py-3 flex-row items-center justify-between"><Text className={`flex-1 ${selected.length ? 'text-gray-800' : 'text-gray-400'}`} numberOfLines={2}>{selectedLabel}</Text><Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#801529" /></TouchableOpacity>{open && <View className="mt-1 max-h-48 rounded-xl border border-gray-200 bg-white overflow-hidden">{items.length ? <ScrollView nestedScrollEnabled>{items.map((item) => { const isSelected = selected.includes(String(item.id)); return <TouchableOpacity key={item.id} onPress={() => toggle(String(item.id))} className={`px-3 py-2.5 border-b border-gray-100 flex-row items-center ${isSelected ? 'bg-maroon/10' : ''}`}><Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={17} color="#801529" /><Text className="ml-2 text-sm text-gray-700 flex-1">{referenceLabel(field.reference!, item)}</Text></TouchableOpacity>; })}</ScrollView> : <Text className="p-3 text-sm text-gray-500">No hay registros disponibles. Complete primero el paso anterior.</Text>}</View>}</View>;
}

export function AcademicServicesScreen({ area = 'academic' }: { area?: 'academic' | 'enrollment' | 'learning' }) {
  const { user } = useAuth();
  const role = user?.rol?.toLowerCase() ?? '';
  // Estudiantes y apoderados pueden consultar el aula; las mutaciones siguen
  // limitadas a docentes y roles de gestión también en la interfaz.
  const allowed = area === 'learning' ? Boolean(role) : managementRoles.includes(role);
  const canWrite = area === 'academic' || area === 'enrollment'
    ? managementRoles.includes(role)
    : teachingRoles.includes(role);
  const available = useMemo(() => definitions.filter((d) => area === 'academic' ? ['periodos', 'cursos', 'materias'].includes(d.resource) : area === 'enrollment' ? ['cursos-periodo', 'inscripciones', 'asignaciones', 'asesores'].includes(d.resource) : ['materiales', 'encargos', 'calificaciones', 'asistencia'].includes(d.resource)), [area]);
  const [selected, setSelected] = useState(available[0]);
  const [rows, setRows] = useState<Item[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(''); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Item | null>(null);
  const [values, setValues] = useState<Record<string, any>>(initialValues(available[0])); const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [bulkStudents, setBulkStudents] = useState<string[]>([]);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkObservation, setBulkObservation] = useState('');
  const [references, setReferences] = useState<Partial<Record<ReferenceSource, Item[]>>>({});

  // Cursos por Periodo: Filtro de periodo (activo vs historico)
  const [periodosList, setPeriodosList] = useState<Item[]>([]);
  const [periodoSeleccionadoFiltro, setPeriodoSeleccionadoFiltro] = useState<string>('activo'); // 'activo' o id de periodo historico

  // Detalle del Curso (Estudiantes inscritos y Maestros asignados)
  const [cursoPeriodoDetalle, setCursoPeriodoDetalle] = useState<Item | null>(null);
  const [detalleInscritos, setDetalleInscritos] = useState<Item[]>([]);
  const [detalleAsignaciones, setDetalleAsignaciones] = useState<Item[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Asignaciones docentes: Segmentación de nivel educativo
  const [nivelFiltroAsignacion, setNivelFiltroAsignacion] = useState<'todos' | 'primaria' | 'secundaria'>('todos');

  // Cargar lista de periodos para el selector de periodos historicos
  useEffect(() => {
    if (selected.resource === 'cursos-periodo') {
      academicServicesApi.list('periodos', { limit: 50 })
        .then((res) => setPeriodosList(res.data ?? []))
        .catch(() => undefined);
    }
  }, [selected.resource]);

  const load = async () => {
    setLoading(true);
    try {
      const queryParams: Record<string, any> = { buscar: search };
      if (selected.resource === 'cursos-periodo') {
        if (periodoSeleccionadoFiltro === 'activo') {
          // El microservicio filtra por periodo activo si periodoId o anio no se especifica, pero lo forzamos con estado activo
          queryParams.estado = 'activo';
        } else {
          queryParams.periodoId = periodoSeleccionadoFiltro;
        }
      }
      const data = await academicServicesApi.list(selected.resource, queryParams);
      let loadedRows = data.data ?? [];

      // Si estamos en cursos-periodo y el filtro es "activo", filtramos en cliente que pertenezcan al periodo activo
      if (selected.resource === 'cursos-periodo' && periodoSeleccionadoFiltro === 'activo') {
        loadedRows = loadedRows.filter((row: any) => row.periodo?.activo === true || row.periodo?.activo === undefined);
      }


      setRows(loadedRows);
    } catch (e) {
      Alert.alert('No se pudo cargar', e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCursoDetalle = async (cp: Item) => {
    setCursoPeriodoDetalle(cp);
    setLoadingDetalle(true);
    try {
      const [inscritosRes, asignacionesRes] = await Promise.all([
        academicServicesApi.list('inscripciones', { cursoPeriodoId: cp.id, limit: 100 }),
        academicServicesApi.list('asignaciones', { cursoPeriodoId: cp.id, limit: 100 }),
      ]);
      setDetalleInscritos(inscritosRes.data ?? []);
      setDetalleAsignaciones(asignacionesRes.data ?? []);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar los detalles del aula.');
    } finally {
      setLoadingDetalle(false);
    }
  };

  const autogenerarPeriodo = () => {
    const nextYear = new Date().getFullYear() + 1;
    setValues({
      anio: nextYear,
      nombre: `Gestión Escolar ${nextYear}`,
      fechaInicio: `${nextYear}-02-02`,
      fechaFin: `${nextYear}-12-18`,
      activo: false,
    });
  };

  useEffect(() => { setSelected(available[0]); }, [area]);
  useEffect(() => {
    setValues(initialValues(selected));
    setEditing(null);
    setShowForm(false);
    setFile(null);
    setPeriodoSeleccionadoFiltro('activo');
    setCursoPeriodoDetalle(null);
    load();
  }, [selected]);
  useEffect(() => {
    if (selected.resource === 'cursos-periodo') {
      load();
    }
  }, [periodoSeleccionadoFiltro]);

  useEffect(() => {
    const sources = [...new Set(selected.fields.flatMap((field) => field.reference ? [field.reference] : []))];
    if (!sources.length) { setReferences({}); return; }
    const serviceSources = sources.filter((source) => source !== 'estudiantes' && source !== 'docentes') as ServiceResource[];
    Promise.all([
      ...serviceSources.map(async (source) => [source, (await academicServicesApi.list(source)).data] as const),
      ...(sources.includes('estudiantes') || sources.includes('docentes') ? [usuariosApi.list({ limit: 100 }).then((page) => ['usuarios', page.data] as const)] : []),
    ]).then((entries) => {
      const next: Partial<Record<ReferenceSource, Item[]>> = {};
      entries.forEach(([source, items]) => { if (source === 'usuarios') { const users = items as Item[]; next.estudiantes = users.filter((item) => ['estudiante', 'alumno'].includes(String(item.rol ?? '').toLowerCase()) || String(item.rolId) === '3'); next.docentes = users.filter((item) => ['profesor', 'maestro', 'maestros', 'docente'].includes(String(item.rol ?? '').toLowerCase()) || String(item.rolId) === '2'); } else next[source as ReferenceSource] = items as Item[]; });
      setReferences(next);
    }).catch(() => setReferences({}));
  }, [selected]);
  const setValue = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));
  const normalized = (field: Field, value: any) => field.type === 'number' && value !== '' ? Number(value) : field.multiple ? (Array.isArray(value) ? value : []) : value === '' ? undefined : value;
  const validate = () => {
    for (const field of selected.fields) if (field.required && (values[field.key] === '' || values[field.key] === undefined)) { Alert.alert('Dato requerido', `${field.label} es obligatorio.`); return false; }
    if (selected.resource === 'materiales' && !editing && !file) { Alert.alert('Archivo requerido', 'Seleccione un PDF, Word o Excel para el material.'); return false; }
    if (selected.resource === 'encargos' && values.ponderacion !== '' && (Number(values.ponderacion) < 0 || Number(values.ponderacion) > 100)) { Alert.alert('Ponderación inválida', 'La ponderación debe estar entre 0 y 100.'); return false; }
    if (!editing) {
      const keys: Record<ServiceResource, string[]> = {
        periodos: ['anio'], cursos: ['nivel', 'grado', 'paralelo'], materias: ['codigo'], 'cursos-periodo': ['cursoId', 'periodoId'], inscripciones: ['estudianteId', 'cursoPeriodoId'], asignaciones: ['maestroId', 'materiaId', 'cursoPeriodoId'], asesores: ['maestroId', 'cursoPeriodoId'], materiales: ['asignacionId', 'titulo'], encargos: ['asignacionId', 'titulo'], calificaciones: ['encargoId', 'estudianteId'], asistencia: ['asignacionId', 'estudianteId', 'fecha'], entregas: ['encargoId', 'estudianteId'],
      };
      const duplicate = rows.some((row) => keys[selected.resource].every((key) => String(row[key] ?? '').trim().toLowerCase() === String(values[key] ?? '').trim().toLowerCase()));
      if (duplicate) { Alert.alert('Registro duplicado', 'Ya existe un registro con esos datos clave.'); return false; }
    }
    return true;
  };
  const save = async () => { if (!validate()) return; setSaving(true); try { const payload = Object.fromEntries(selected.fields.map((f) => [f.key, normalized(f, values[f.key])]).filter(([, v]) => v !== undefined)); if (selected.resource === 'materiales' && file && !editing) { const data = new FormData(); Object.entries(payload).forEach(([key, value]) => data.append(key, String(value))); data.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any); await academicServicesApi.uploadMaterial(data); } else if (editing) await academicServicesApi.update(selected.resource, String(editing.id), payload); else await academicServicesApi.create(selected.resource, payload); setShowForm(false); setEditing(null); setFile(null); await load(); } catch (e) { Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Revise los datos ingresados.'); } finally { setSaving(false); } };
  const edit = (item: Item) => { setEditing(item); setValues(Object.fromEntries(selected.fields.map((field) => [field.key, field.key === 'materialIds' && Array.isArray(item[field.key]) ? item[field.key].join(', ') : item[field.key] ?? '']))); setShowForm(true); };
  const remove = (item: Item) => Alert.alert('Eliminar registro', `¿Desea eliminar “${labelFor(item)}”?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await academicServicesApi.remove(selected.resource, String(item.id)); await load(); } catch (e) { Alert.alert('No se pudo eliminar', e instanceof Error ? e.message : 'Error'); } } }]);
  const chooseFile = async () => { const result = await DocumentPicker.getDocumentAsync({ type: fileTypes, copyToCacheDirectory: true }); if (result.canceled) return; const asset = result.assets[0]; if (!fileTypes.includes(asset.mimeType ?? '') || (asset.size ?? 0) > 150 * 1024 * 1024) { Alert.alert('Archivo no permitido', 'Solo PDF, Word o Excel de hasta 150 MB.'); return; } setFile(asset); };
  const saveBulk = async () => {
    if (!values[selected.resource === 'calificaciones' ? 'encargoId' : 'asignacionId'] || (selected.resource === 'asistencia' && !values.fecha) || !bulkStudents.length || !bulkValue) { Alert.alert('Lote incompleto', 'Seleccione el encargo o la asignación, estudiantes y el valor a registrar.'); return; }
    try {
      const payload = selected.resource === 'calificaciones'
        ? { encargoId: values.encargoId, calificaciones: bulkStudents.map((estudianteId) => ({ estudianteId, nota: Number(bulkValue), observacion: bulkObservation || null })) }
        : { asignacionId: values.asignacionId, fecha: values.fecha, asistencias: bulkStudents.map((estudianteId) => ({ estudianteId, estado: bulkValue, justificacion: bulkObservation || null })) };
      if (selected.resource === 'calificaciones' && (Number.isNaN(Number(bulkValue)) || Number(bulkValue) < 0 || Number(bulkValue) > 100)) { Alert.alert('Nota inválida', 'La nota debe estar entre 0 y 100.'); return; }
      setSaving(true); await academicServicesApi.bulk(selected.resource as 'calificaciones' | 'asistencia', payload); setBulkStudents([]); setBulkValue(''); setBulkObservation(''); await load();
    } catch (e) { Alert.alert('No se pudo guardar el lote', e instanceof Error ? e.message : 'Error'); } finally { setSaving(false); }
  };

  if (!allowed) return <BentoCard className="p-6 items-center"><Ionicons name="lock-closed-outline" size={38} color="#801529" /><Text className="text-lg font-bold text-gray-800 mt-3">Acceso de consulta restringido</Text><Text className="text-center text-gray-500 mt-1">Su rol no tiene permisos para administrar esta sección.</Text></BentoCard>;
  return <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
    <BentoCard className="p-5"><Text className="text-2xl font-bold text-gray-900">{area === 'academic' ? 'Estructura académica' : area === 'enrollment' ? 'Inscripciones y asignaciones' : 'Aula y seguimiento'}</Text><Text className="text-sm text-gray-500 mt-1">Gestión conectada a los microservicios, con controles de acceso y validación previa.</Text><View className="flex-row flex-wrap gap-2 mt-4">{available.map((d) => <TouchableOpacity key={d.resource} onPress={() => setSelected(d)} className={`px-3 py-2 rounded-xl ${selected.resource === d.resource ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-xs font-bold ${selected.resource === d.resource ? 'text-white' : 'text-gray-600'}`}>{d.title}</Text></TouchableOpacity>)}</View></BentoCard>
    <BentoCard className="p-4">
      <View className="flex-row gap-2">
        <TextInput value={search} onChangeText={setSearch} onSubmitEditing={load} placeholder="Buscar registros" className="flex-1 bg-gray-100 rounded-xl px-4 py-3" />
        <TouchableOpacity onPress={load} className="p-3 bg-gray-100 rounded-xl">
          <Ionicons name="search" size={20} color="#801529" />
        </TouchableOpacity>
        {selected.resource === 'periodos' && canWrite && (
          <TouchableOpacity
            onPress={() => {
              autogenerarPeriodo();
              setEditing(null);
              setShowForm(true);
            }}
            className="px-3 py-3 bg-gold/20 border border-gold/40 rounded-xl flex-row items-center gap-1"
          >
            <Ionicons name="sparkles" size={17} color="#B45309" />
            <Text className="text-xs font-bold text-amber-800">Autogenerar</Text>
          </TouchableOpacity>
        )}
        {canWrite && (
          <TouchableOpacity
            onPress={() => {
              setEditing(null);
              setValues(initialValues(selected));
              setFile(null);
              setShowForm(!showForm);
            }}
            className="p-3 bg-maroon rounded-xl"
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Cursos por periodo: Filtro de Periodo Activo vs Periodos Históricos */}
      {selected.resource === 'cursos-periodo' && (
        <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center justify-between flex-wrap gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="filter-outline" size={16} color="#801529" />
            <Text className="text-xs font-bold text-gray-700">Filtrar por período:</Text>
          </View>
          <View className="flex-row flex-wrap gap-1.5 items-center">
            <TouchableOpacity
              onPress={() => setPeriodoSeleccionadoFiltro('activo')}
              className={`px-3 py-1.5 rounded-lg border ${
                periodoSeleccionadoFiltro === 'activo'
                  ? 'bg-maroon border-maroon'
                  : 'bg-white border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${periodoSeleccionadoFiltro === 'activo' ? 'text-white' : 'text-gray-700'}`}>
                ★ Período Activo
              </Text>
            </TouchableOpacity>

            {periodosList
              .filter((p) => p.activo === false)
              .map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setPeriodoSeleccionadoFiltro(String(p.id))}
                  className={`px-2.5 py-1.5 rounded-lg border ${
                    periodoSeleccionadoFiltro === String(p.id)
                      ? 'bg-maroon border-maroon'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      periodoSeleccionadoFiltro === String(p.id) ? 'text-white font-bold' : 'text-gray-600'
                    }`}
                  >
                    Histórico {p.anio}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}

      {/* Asignaciones docentes: Segmentación Primaria / Secundaria */}
      {selected.resource === 'asignaciones' && (
        <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center justify-between flex-wrap gap-2">
          <Text className="text-xs font-bold text-gray-700">Nivel educativo:</Text>
          <View className="flex-row items-center bg-gray-100 rounded-lg p-0.5">
            {(['todos', 'primaria', 'secundaria'] as const).map((lvl) => (
              <TouchableOpacity
                key={lvl}
                onPress={() => setNivelFiltroAsignacion(lvl)}
                className={`px-3 py-1 rounded-md ${nivelFiltroAsignacion === lvl ? 'bg-maroon' : ''}`}
              >
                <Text className={`text-xs font-bold ${nivelFiltroAsignacion === lvl ? 'text-white' : 'text-gray-600'}`}>
                  {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </BentoCard>

    {showForm && <BentoCard className="p-5">
      <Text className="text-lg font-bold text-maroon mb-4">
        {editing ? `Editar ${selected.title}` : `Nuevo registro: ${selected.title}`}
      </Text>
      <View className="flex-row flex-wrap gap-3">
        {selected.fields
          .filter((field) => {
            // Ocultar fechaRetiro en alta de inscripción
            if (selected.resource === 'inscripciones' && !editing && field.key === 'fechaRetiro') return false;
            // Ocultar fechaFin en alta de asesor
            if (selected.resource === 'asesores' && !editing && field.key === 'fechaFin') return false;
            return true;
          })
          .map((field) => (
            <View key={field.key} className="min-w-[190px] flex-1">
              <Text className="text-xs font-semibold text-gray-600 mb-1">
                {field.label}{field.required ? ' *' : ''}
              </Text>
              {field.reference ? (
                <ReferencePicker
                  field={field}
                  items={references[field.reference] ?? []}
                  value={values[field.key] ?? (field.multiple ? [] : '')}
                  onChange={(value) => setValue(field.key, value)}
                />
              ) : field.type === 'date' ? (
                <BirthDatePicker
                  value={String(values[field.key] ?? '')}
                  onChange={(value) => setValue(field.key, value)}
                  placeholder={field.label}
                  minYear={2020}
                  maxYear={2100}
                />
              ) : field.type === 'boolean' ? (
                <TouchableOpacity
                  onPress={() => setValue(field.key, !values[field.key])}
                  className={`rounded-xl px-3 py-3 ${values[field.key] ? 'bg-green-100' : 'bg-gray-100'}`}
                >
                  <Text className="font-semibold text-gray-700">{values[field.key] ? 'Sí' : 'No'}</Text>
                </TouchableOpacity>
              ) : field.type === 'choice' ? (
                <View className="flex-row flex-wrap gap-1">
                  {field.options?.map((option) => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setValue(field.key, option)}
                      className={`px-2.5 py-2 rounded-lg ${values[field.key] === option ? 'bg-maroon' : 'bg-gray-100'}`}
                    >
                      <Text className={`text-xs ${values[field.key] === option ? 'text-white' : 'text-gray-600'}`}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TextInput
                  value={String(values[field.key] ?? '')}
                  onChangeText={(value) => setValue(field.key, value)}
                  placeholder={field.hint ?? field.label}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                  className="bg-gray-100 rounded-xl px-3 py-3 text-gray-800"
                />
              )}
              {field.hint ? <Text className="text-xs text-gray-400 mt-1">{field.hint}</Text> : null}
            </View>
          ))}
      </View>
      {selected.resource === 'materiales' && !editing && (
        <TouchableOpacity
          onPress={chooseFile}
          className="mt-4 p-4 border border-dashed border-maroon/40 rounded-xl bg-cream/40 flex-row items-center gap-2"
        >
          <Ionicons name="attach-outline" size={20} color="#801529" />
          <Text className="text-maroon font-semibold">{file ? file.name : 'Adjuntar PDF, Word o Excel (máx. 150 MB)'}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={save} disabled={saving} className="bg-maroon rounded-xl py-3 items-center mt-5">
        {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-bold text-white">{editing ? 'Guardar cambios' : 'Registrar'}</Text>}
      </TouchableOpacity>
    </BentoCard>}

    {selected.bulk && canWrite && (
      <BentoCard className="p-5">
        <Text className="font-bold text-maroon">Registro masivo</Text>
        <Text className="text-xs text-gray-500 mt-1">Seleccione los registros existentes. Para notas o estados diferentes por estudiante, use el registro individual.</Text>
        <View className="gap-3 mt-3">
          <ReferencePicker
            field={{ key: selected.resource === 'calificaciones' ? 'encargoId' : 'asignacionId', label: selected.resource === 'calificaciones' ? 'Encargo' : 'Asignación docente', reference: selected.resource === 'calificaciones' ? 'encargos' : 'asignaciones', required: true }}
            items={references[selected.resource === 'calificaciones' ? 'encargos' : 'asignaciones'] ?? []}
            value={values[selected.resource === 'calificaciones' ? 'encargoId' : 'asignacionId'] ?? ''}
            onChange={(value) => setValue(selected.resource === 'calificaciones' ? 'encargoId' : 'asignacionId', value)}
          />
          {selected.resource === 'asistencia' && (
            <TextInput value={String(values.fecha ?? '')} onChangeText={(value) => setValue('fecha', value)} placeholder="Fecha AAAA-MM-DD *" className="bg-gray-100 rounded-xl px-3 py-3" />
          )}
          <ReferencePicker
            field={{ key: 'estudiantes', label: 'Estudiantes', reference: 'estudiantes', multiple: true, required: true }}
            items={references.estudiantes ?? []}
            value={bulkStudents}
            onChange={(value) => setBulkStudents(Array.isArray(value) ? value : [value])}
          />
          {selected.resource === 'calificaciones' ? (
            <TextInput value={bulkValue} onChangeText={setBulkValue} keyboardType="numeric" placeholder="Nota para los estudiantes seleccionados *" className="bg-gray-100 rounded-xl px-3 py-3" />
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {['presente', 'ausente', 'atraso', 'justificado'].map((state) => (
                <TouchableOpacity key={state} onPress={() => setBulkValue(state)} className={`px-3 py-2 rounded-xl ${bulkValue === state ? 'bg-maroon' : 'bg-gray-100'}`}>
                  <Text className={bulkValue === state ? 'text-white text-xs font-bold' : 'text-gray-600 text-xs'}>{state}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput value={bulkObservation} onChangeText={setBulkObservation} placeholder="Observación o justificación opcional" className="bg-gray-100 rounded-xl px-3 py-3" />
        </View>
        <TouchableOpacity onPress={saveBulk} disabled={saving} className="bg-maroon rounded-xl py-3 items-center mt-3">
          <Text className="text-white font-bold">Guardar lote</Text>
        </TouchableOpacity>
      </BentoCard>
    )}

    {/* Detalle del Curso (Modal o Tarjeta Desplegable al hacer click) */}
    {cursoPeriodoDetalle && (
      <BentoCard className="p-5 bg-card border-2 border-gold/40">
        <View className="flex-row items-center justify-between mb-3 pb-2 border-b border-gray-100">
          <View>
            <View className="flex-row items-center gap-2">
              <Ionicons name="school" size={20} color="#801529" />
              <Text className="text-lg font-bold text-gray-900">
                Detalle del Aula: {formatCursoPeriodo(cursoPeriodoDetalle)}
              </Text>
            </View>
            <Text className="text-xs text-gray-500 mt-0.5">
              Capacidad: {cursoPeriodoDetalle.capacidadMaxima} | Estado: {cursoPeriodoDetalle.estado}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setCursoPeriodoDetalle(null)} className="p-1">
            <Ionicons name="close-circle" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {loadingDetalle ? (
          <ActivityIndicator color="#801529" className="py-6" />
        ) : (
          <View className="gap-4">
            {/* Maestros Asignados */}
            <View>
              <Text className="text-xs font-bold text-maroon uppercase mb-2">
                Maestros Asignados ({detalleAsignaciones.length})
              </Text>
              {!detalleAsignaciones.length ? (
                <Text className="text-xs text-gray-500 py-1 italic">No hay maestros asignados a este curso.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {detalleAsignaciones.map((asig) => {
                    const prof = asig.maestro
                      ? `${asig.maestro.nombre ?? ''} ${asig.maestro.apellidoPaterno ?? ''}`.trim()
                      : 'Docente';
                    const mat = asig.materia?.nombre ?? 'Materia';
                    return (
                      <View key={asig.id} className="bg-gray-100 px-3 py-2 rounded-xl border border-gray-200">
                        <Text className="text-xs font-bold text-gray-800">{prof}</Text>
                        <Text className="text-[10px] text-maroon font-semibold">{mat}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Estudiantes Inscritos */}
            <View>
              <Text className="text-xs font-bold text-maroon uppercase mb-2">
                Estudiantes Inscritos ({detalleInscritos.length})
              </Text>
              {!detalleInscritos.length ? (
                <Text className="text-xs text-gray-500 py-1 italic">No hay estudiantes matriculados en este curso.</Text>
              ) : (
                <View className="gap-1.5 max-h-56">
                  <ScrollView nestedScrollEnabled>
                    {detalleInscritos.map((ins, idx) => {
                      const est = ins.estudiante
                        ? `${ins.estudiante.nombre ?? ''} ${ins.estudiante.apellidoPaterno ?? ''} ${ins.estudiante.apellidoMaterno ?? ''}`.trim()
                        : 'Estudiante';
                      return (
                        <View key={ins.id} className="py-1.5 px-2 border-b border-gray-100 flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <Text className="text-xs text-gray-400 w-5">{idx + 1}.</Text>
                            <Text className="text-xs font-semibold text-gray-800">{est}</Text>
                          </View>
                          <View className="flex-row items-center gap-2">
                            {ins.observacion ? (
                              <Text className="text-[10px] text-gray-500 italic" numberOfLines={1}>
                                {ins.observacion}
                              </Text>
                            ) : null}
                            <View className={`px-2 py-0.5 rounded ${ins.estado === 'activo' ? 'bg-green-100' : 'bg-gray-100'}`}>
                              <Text className={`text-[10px] font-bold ${ins.estado === 'activo' ? 'text-green-700' : 'text-gray-600'}`}>
                                {ins.estado}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
        )}
      </BentoCard>
    )}

    {/* Tabla / Tarjetas de Registros */}
    <BentoCard className="p-5">
      <Text className="text-lg font-bold text-gray-900 mb-3">
        Registros ({(() => {
          if (selected.resource === 'asignaciones' && nivelFiltroAsignacion !== 'todos') {
            return rows.filter((r) => String(r.cursoPeriodo?.curso?.nivel ?? '').toLowerCase() === nivelFiltroAsignacion).length;
          }
          return rows.length;
        })()})
      </Text>

      {loading ? (
        <ActivityIndicator color="#801529" />
      ) : rows.length === 0 ? (
        <Text className="text-center text-gray-500 py-8">No hay registros para mostrar.</Text>
      ) : (
        rows
          .filter((item) => {
            if (selected.resource === 'asignaciones' && nivelFiltroAsignacion !== 'todos') {
              return String(item.cursoPeriodo?.curso?.nivel ?? '').toLowerCase() === nivelFiltroAsignacion;
            }
            return true;
          })
          .map((item) => {
            const isAsesor = selected.resource === 'asesores';
            const isCursoPeriodo = selected.resource === 'cursos-periodo';
            const isVigente = isAsesor && (item.fechaFin === null || item.fechaFin === undefined || item.fechaFin === '');

            return (
              <View key={item.id} className="py-3 border-b border-gray-100">
                <View className="flex-row items-center">
                  <TouchableOpacity
                    disabled={!isCursoPeriodo}
                    onPress={() => isCursoPeriodo && handleOpenCursoDetalle(item)}
                    className="w-9 h-9 rounded-xl bg-maroon/10 items-center justify-center mr-3"
                  >
                    <Ionicons
                      name={isCursoPeriodo ? 'eye-outline' : 'document-text-outline'}
                      size={18}
                      color="#801529"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={!isCursoPeriodo}
                    onPress={() => isCursoPeriodo && handleOpenCursoDetalle(item)}
                    className="flex-1"
                  >
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="font-bold text-gray-800">{labelFor(item, selected.resource)}</Text>
                      {isVigente && (
                        <View className="px-2 py-0.5 bg-green-100 rounded-md">
                          <Text className="text-[10px] font-bold text-green-700">Vigente</Text>
                        </View>
                      )}
                      {isCursoPeriodo && (
                        <View className="px-2 py-0.5 bg-maroon/10 rounded-md">
                          <Text className="text-[10px] font-bold text-maroon">Ver estudiantes y maestros</Text>
                        </View>
                      )}
                    </View>

                    {/* Atributos legibles (ocultando IDs) */}
                    <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>
                      {selected.fields
                        .filter((f) => !f.key.toLowerCase().endsWith('id'))
                        .map((f) => {
                          const val = item[f.key];
                          if (f.key === 'fechaFin' && isAsesor && (val === null || val === undefined || val === '')) {
                            return `${f.label}: Vigente`;
                          }
                          return `${f.label}: ${Array.isArray(val) ? val.join(', ') : val ?? '—'}`;
                        })
                        .join(' · ')}
                    </Text>
                  </TouchableOpacity>

                  {canWrite && (
                    <View className="flex-row gap-2">
                      <TouchableOpacity onPress={() => edit(item)} className="p-2">
                        <Ionicons name="create-outline" size={19} color="#801529" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => remove(item)} className="p-2">
                        <Ionicons name="trash-outline" size={19} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {selected.withdraw && item.estado === 'activo' && canWrite && (
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await academicServicesApi.withdraw(String(item.id), {
                          estado: 'retirado',
                          fechaRetiro: new Date().toISOString().slice(0, 10),
                        });
                        await load();
                      } catch (e) {
                        Alert.alert('No se pudo retirar', e instanceof Error ? e.message : 'Error');
                      }
                    }}
                    className="self-start mt-2 px-3 py-1 bg-red-50 rounded-lg"
                  >
                    <Text className="text-xs font-bold text-red-600">Retirar inscripción</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
      )}
    </BentoCard>
  </ScrollView>;
}

