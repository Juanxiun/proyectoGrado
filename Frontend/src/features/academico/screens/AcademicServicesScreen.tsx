import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { Pagination } from '../../../displays/components/Pagination';
import { InAppDocumentViewerModal } from '../../../displays/components/InAppDocumentViewerModal';
import { ConfirmDeleteModal } from '../../../displays/components/ConfirmDeleteModal';
import { academicServicesApi, type ServiceResource } from '../../../api/academicServices.api';
import { usuariosApi } from '../../../api/usuarios.api';
import { useAuth } from '../../../context/AuthContext';
import { BirthDatePicker } from '../../usuarios/components/BirthDatePicker';
import { useRealtimeResource } from '../../../hooks/useRealtimeResource';
import { AcademicManagementPanel } from './AcademicManagementPanel';
import { CoverImagePicker, getFallbackGradient } from '../components/CoverImagePicker';
import { MateriasGradoModal } from '../components/MateriasGradoModal';
import { MayaCurricularScreen } from '../components/MayaCurricularScreen';
import { NIVEL_LABEL, numeroGrado, type Nivel } from '../utils/niveles';
import { Button } from '../../../shared/ui';

type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'choice' | 'image';
type ReferenceSource = 'periodos' | 'cursos' | 'materias' | 'cursos-periodo' | 'asignaciones' | 'encargos' | 'materiales' | 'estudiantes' | 'docentes';
type Field = { key: string; label: string; type?: FieldType; required?: boolean; options?: string[]; hint?: string; reference?: ReferenceSource; multiple?: boolean };
type Definition = { title: string; resource: ServiceResource; fields: Field[]; management?: boolean; bulk?: boolean; withdraw?: boolean; /** No es una tabla CRUD: dibuja un panel propio. */ custom?: boolean };
type Item = Record<string, any>;

const definitions: Definition[] = [
  { title: 'Periodos académicos', resource: 'periodos', management: true, fields: [
    { key: 'anio', label: 'Año lectivo', type: 'number', required: true }, { key: 'nombre', label: 'Nombre del periodo', required: true },
    { key: 'fechaInicio', label: 'Fecha de inicio (AAAA-MM-DD)', type: 'date', required: true }, { key: 'fechaFin', label: 'Fecha de fin (AAAA-MM-DD)', type: 'date', required: true },
    { key: 'inicio1', label: 'Inicio 1er trimestre', type: 'date', required: true }, { key: 'fin1', label: 'Fin 1er trimestre', type: 'date', required: true },
    { key: 'inicio2', label: 'Inicio 2do trimestre', type: 'date', required: true }, { key: 'fin2', label: 'Fin 2do trimestre', type: 'date', required: true },
    { key: 'inicio3', label: 'Inicio 3er trimestre', type: 'date', required: true }, { key: 'fin3', label: 'Fin 3er trimestre', type: 'date', required: true },
    { key: 'activo', label: 'Activo', type: 'boolean' },
  ] },
  { title: 'Cursos base', resource: 'cursos', management: true, fields: [
    { key: 'nivel', label: 'Nivel', type: 'choice', required: true, options: ['inicial', 'primaria', 'secundaria', 'bachillerato'] }, { key: 'grado', label: 'Grado', required: true }, { key: 'paralelo', label: 'Paralelo', required: true }, { key: 'capacidadMaxima', label: 'Capacidad máxima', type: 'number' }, { key: 'activo', label: 'Activo', type: 'boolean' }, { key: 'caratulaUrl', label: 'Carátula / Portada', type: 'image' },
  ] },
  { title: 'Materias', resource: 'materias', management: true, fields: [
    { key: 'codigo', label: 'Código único', required: true }, { key: 'nombre', label: 'Nombre de la materia', required: true }, { key: 'descripcion', label: 'Descripción' },
    { key: 'tipoMateria', label: 'Tipo', type: 'choice', options: ['principal', 'extracurricular'] }, { key: 'cargaHorariaSemanal', label: 'Horas semanales', type: 'number' }, { key: 'pesoSintactico', label: 'Peso sintáctico', type: 'number' }, { key: 'materiaPesada', label: 'Materia pesada', type: 'boolean' }, { key: 'activo', label: 'Activo', type: 'boolean' }, { key: 'caratulaUrl', label: 'Carátula / Portada', type: 'image' },
  ] },
  // Debajo de Materias y a propósito: se apoya en ellas. Reusa el recurso
  // `cursos` porque comparte permisos, pero dibuja su propio panel.
  { title: 'Maya curricular', resource: 'cursos', custom: true, fields: [] },
  { title: 'Cursos por periodo', resource: 'cursos-periodo', management: true, fields: [
    { key: 'cursoId', label: 'Curso', required: true, reference: 'cursos' }, { key: 'periodoId', label: 'Periodo académico', required: true, reference: 'periodos' }, { key: 'capacidadMaxima', label: 'Capacidad máxima', type: 'number', required: true }, { key: 'turnoId', label: 'Turno (ID)', type: 'number' }, { key: 'estado', label: 'Estado', type: 'choice', options: ['activo', 'cerrado', 'cancelado'] },
  ] },
  { title: 'Inscripciones', resource: 'inscripciones', management: true, withdraw: true, fields: [
    { key: 'estudianteId', label: 'Estudiante', required: true, reference: 'estudiantes' }, { key: 'cursoPeriodoId', label: 'Curso y periodo', required: true, reference: 'cursos-periodo' }, { key: 'fechaInscripcion', label: 'Fecha de inscripción (AAAA-MM-DD)', type: 'date' }, { key: 'observacion', label: 'Observación' }, { key: 'estado', label: 'Estado', type: 'choice', options: ['activo', 'retirado', 'finalizado'] }, { key: 'fechaRetiro', label: 'Fecha de retiro (AAAA-MM-DD)', type: 'date' },
  ] },
  { title: 'Asignaciones docentes', resource: 'asignaciones', management: true, fields: [
    { key: 'maestroId', label: 'Docente', required: true, reference: 'docentes' }, { key: 'materiaId', label: 'Materia', required: true, reference: 'materias' }, { key: 'cursoPeriodoId', label: 'Curso y periodo', required: true, reference: 'cursos-periodo' }, { key: 'estado', label: 'Estado', type: 'choice', options: ['activo', 'finalizado', 'cancelado'] }, { key: 'fechaFinalizacion', label: 'Fecha de finalización (AAAA-MM-DD)', type: 'date' },
  ] },
  { title: 'Asesores de curso', resource: 'asesores', management: true, fields: [
    { key: 'cursoPeriodoId', label: 'Curso y periodo', required: true, reference: 'cursos-periodo' }, { key: 'maestroId', label: 'Docente asesor', required: true, reference: 'docentes' }, { key: 'fechaInicio', label: 'Inicio de la gestión', type: 'date' }, { key: 'fechaFin', label: 'Fin de la gestión', type: 'date' },
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

const fileTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const managementRoles = ['director', 'admin', 'administrador', 'gerencia', 'control', 'editor', 'secretaria', 'secretario', 'administrativo'];
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
  if (definition.resource === 'periodos') {
    base.activo = false;
  }
  if (definition.resource === 'inscripciones') {
    base.fechaInscripcion = new Date().toISOString().slice(0, 10);
    base.estado = 'activo';
    base.observacion = 'Sin observación';
  }
  if (definition.resource === 'asesores') {
    base.fechaInicio = '';
    base.fechaFin = '';
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
  const [activeNivelTab, setActiveNivelTab] = useState<'primaria' | 'secundaria'>('primaria');
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (id: string) => {
    if (field.multiple) onChange(selected.includes(id) ? selected.filter((current) => current !== id) : [...selected, id]);
    else { onChange(id); setOpen(false); }
  };
  const selectedLabel = selected.length ? selected.map((id) => referenceLabel(field.reference!, items.find((item) => String(item.id) === id) ?? { id })).join(', ') : `Seleccionar ${field.label.toLowerCase()}`;

  const isCursoReference = field.reference === 'cursos-periodo' || field.reference === 'cursos';

  // Agrupar cursos por nivel y grado
  const cursosPorNivel = useMemo(() => {
    if (!isCursoReference) return null;
    const primariaItems = items.filter((item) => {
      const nivel = String(item.curso?.nivel || item.nivel || '').toLowerCase();
      return nivel.includes('primaria') || nivel.includes('inicial');
    });
    const secundariaItems = items.filter((item) => {
      const nivel = String(item.curso?.nivel || item.nivel || '').toLowerCase();
      return nivel.includes('secundaria') || nivel.includes('bachill');
    });

    const agrupar = (lista: Item[]) => {
      const grupos: Record<string, Item[]> = {};
      for (const item of lista) {
        const grado = String(item.curso?.grado || item.grado || 'Otros');
        if (!grupos[grado]) grupos[grado] = [];
        grupos[grado].push(item);
      }
      return grupos;
    };

    return {
      primaria: agrupar(primariaItems),
      secundaria: agrupar(secundariaItems),
    };
  }, [items, isCursoReference]);

  return (
    <View className="min-w-0">
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        className="bg-gray-100 rounded-xl px-3.5 py-3 flex-row items-center justify-between border border-gray-200"
      >
        <Text className={`flex-1 text-sm ${selected.length ? 'text-gray-900 font-semibold' : 'text-gray-400'}`} numberOfLines={2}>
          {selectedLabel}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#801529" />
      </TouchableOpacity>

      {open && (
        <View className="mt-1.5 rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-lg p-3">
          {items.length === 0 ? (
            <Text className="p-3 text-sm text-gray-500 text-center">No hay registros disponibles.</Text>
          ) : isCursoReference && cursosPorNivel ? (
            <View className="gap-3">
              {/* Selector de Nivel Primaria / Secundaria */}
              <View className="flex-row gap-2 bg-gray-100 p-1 rounded-xl">
                <TouchableOpacity
                  onPress={() => setActiveNivelTab('primaria')}
                  className={`flex-1 py-2 rounded-lg items-center ${activeNivelTab === 'primaria' ? 'bg-maroon shadow-sm' : ''}`}
                >
                  <Text className={`text-xs font-bold ${activeNivelTab === 'primaria' ? 'text-white' : 'text-gray-600'}`}>
                    Primaria
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setActiveNivelTab('secundaria')}
                  className={`flex-1 py-2 rounded-lg items-center ${activeNivelTab === 'secundaria' ? 'bg-maroon shadow-sm' : ''}`}
                >
                  <Text className={`text-xs font-bold ${activeNivelTab === 'secundaria' ? 'text-white' : 'text-gray-600'}`}>
                    Secundaria
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Lista de Grados y Paralelos */}
              <ScrollView nestedScrollEnabled className="max-h-56">
                {Object.keys(cursosPorNivel[activeNivelTab]).length === 0 ? (
                  <Text className="p-3 text-xs text-gray-400 text-center">No hay cursos en este nivel.</Text>
                ) : (
                  <View className="gap-2.5">
                    {Object.entries(cursosPorNivel[activeNivelTab]).map(([grado, cursosDelGrado]) => (
                      <View key={grado} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                        <Text className="text-xs font-bold text-gray-700 mb-1.5">{grado}° Grado</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {cursosDelGrado.map((curso) => {
                            const isSelected = selected.includes(String(curso.id));
                            const paralelo = curso.curso?.paralelo || curso.paralelo || 'A';
                            return (
                              <TouchableOpacity
                                key={curso.id}
                                onPress={() => toggle(String(curso.id))}
                                className={`px-3 py-1.5 rounded-lg border flex-row items-center gap-1.5 ${
                                  isSelected
                                    ? 'bg-maroon border-maroon'
                                    : 'bg-white border-gray-200 hover:border-maroon/40'
                                }`}
                              >
                                <Ionicons
                                  name={isSelected ? 'checkmark-circle' : 'school-outline'}
                                  size={14}
                                  color={isSelected ? '#FFFFFF' : '#801529'}
                                />
                                <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                                  Paralelo {paralelo}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          ) : (
            <ScrollView nestedScrollEnabled className="max-h-48">
              {items.map((item) => {
                const isSelected = selected.includes(String(item.id));
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => toggle(String(item.id))}
                    className={`px-3 py-2.5 border-b border-gray-100 flex-row items-center rounded-lg ${
                      isSelected ? 'bg-maroon/10' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={17} color="#801529" />
                    <Text className="ml-2 text-sm text-gray-700 flex-1">{referenceLabel(field.reference!, item)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Texto en el que se busca dentro de un registro. Se recorren los campos que
 * la persona realmente ve en la tarjeta, no todo el objeto: los ids y las
 * fechas harían que cualquier número pareciera coincidir.
 */
const camposBuscables = [
  'nombre', 'titulo', 'codigo', 'descripcion', 'detalle', 'observacion',
  'anio', 'grado', 'paralelo', 'nivel', 'tipo', 'estado', 'justificacion',
];

const textoBuscable = (item: Item): string =>
  camposBuscables
    .map((campo) => {
      const valor = item[campo];
      return valor === undefined || valor === null ? '' : String(valor);
    })
    .join(' ')
    .toLowerCase();

/**
 * El buscador filtra mientras se escribe, en el cliente: la lista ya está
 * descargada, así que el resultado aparece al instante y no hace falta
 * apretar la lupa. Se posterga un poco para no filtrar en cada tecla.
 */
function useBusquedaEnVivo(rows: Item[], resource: ServiceResource, termino: string) {
  const [aplazado, setAplazado] = useState(termino);

  useEffect(() => {
    const timer = setTimeout(() => setAplazado(termino.trim().toLowerCase()), 200);
    return () => clearTimeout(timer);
  }, [termino]);

  return useMemo(() => {
    if (!aplazado) return rows;
    const terminos = aplazado.split(/\s+/).filter(Boolean);
    return rows.filter((item) => {
      const texto = `${textoBuscable(item)} ${String(labelFor(item, resource)).toLowerCase()}`;
      return terminos.every((parte) => texto.includes(parte));
    });
  }, [rows, resource, aplazado]);
}

export function AcademicServicesScreen({ area = 'academic', onNavigate }: { area?: 'academic' | 'enrollment' | 'learning'; onNavigate?: (route: string, params?: { periodoId?: string }) => void }) {
  const { user } = useAuth();
  const role = user?.rol?.toLowerCase() ?? '';
  // Estudiantes y apoderados pueden consultar el aula; las mutaciones siguen
  // limitadas a docentes y roles de gestión también en la interfaz.
  const allowed = area === 'learning' ? Boolean(role) : managementRoles.includes(role);
  const canWrite = area === 'academic' || area === 'enrollment'
    ? managementRoles.includes(role)
    : teachingRoles.includes(role);
  const available = useMemo(() => definitions.filter((d) => area === 'academic' ? (d.custom || ['periodos', 'cursos', 'materias', 'asesores'].includes(d.resource)) : area === 'enrollment' ? ['cursos-periodo', 'inscripciones'].includes(d.resource) : ['materiales', 'encargos', 'calificaciones', 'asistencia'].includes(d.resource)), [area]);
  const [selected, setSelected] = useState(available[0]);
  // La Maya curricular no es una tabla CRUD: dibuja su propio panel y no pide
  // el listado genérico ni el formulario de alta/edición.
  const esMayaCurricular = Boolean(selected.custom);
  const [rows, setRows] = useState<Item[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(''); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Item | null>(null);
  const [values, setValues] = useState<Record<string, any>>(initialValues(available[0])); const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [bulkStudents, setBulkStudents] = useState<string[]>([]);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkObservation, setBulkObservation] = useState('');
  const [references, setReferences] = useState<Partial<Record<ReferenceSource, Item[]>>>({});

  // Visor de documentos de materiales
  const [viewerMaterial, setViewerMaterial] = useState<Item | null>(null);

  // Estado de eliminación con ConfirmDeleteModal
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Cursos por Periodo: Filtro de periodo (activo vs historico)
  const [periodosList, setPeriodosList] = useState<Item[]>([]);
  const [periodoSeleccionadoFiltro, setPeriodoSeleccionadoFiltro] = useState<string>('activo');
  const [periodoGestionId, setPeriodoGestionId] = useState('');

  // Detalle del Curso (Estudiantes inscritos y Maestros asignados)
  const [cursoPeriodoDetalle, setCursoPeriodoDetalle] = useState<Item | null>(null);
  const [detalleInscritos, setDetalleInscritos] = useState<Item[]>([]);
  const [detalleAsignaciones, setDetalleAsignaciones] = useState<Item[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Materias del GRADO (compartidas por 1°A, 1°B y el resto de paralelos).
  const [gradoMaterias, setGradoMaterias] = useState<{
    nivel: Nivel;
    grado: string;
    paralelos: string[];
  } | null>(null);

  // Asignaciones docentes: Segmentación de nivel educativo
  const [nivelFiltroAsignacion, setNivelFiltroAsignacion] = useState<'todos' | 'primaria' | 'secundaria'>('todos');
  const [cursoNivelTab, setCursoNivelTab] = useState<'primaria' | 'secundaria'>('primaria');
  // Grado con el que se abre la Maya curricular al entrar desde una tarjeta.
  const [gradoMaya, setGradoMaya] = useState<string>('');

  // Paginación Estricta
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // El buscador vive arriba de los filtros de nivel/nivel de asignación.
  const rowsPorBusqueda = useBusquedaEnVivo(rows, selected.resource, search);

  const filteredRows = useMemo(() => {
    return rowsPorBusqueda.filter((item) => {
      if (selected.resource === 'cursos') {
        return String(item.nivel ?? '').toLowerCase() === cursoNivelTab;
      }
      if (selected.resource === 'asignaciones' && nivelFiltroAsignacion !== 'todos') {
        return String(item.cursoPeriodo?.curso?.nivel ?? '').toLowerCase() === nivelFiltroAsignacion;
      }
      return true;
    });
  }, [rowsPorBusqueda, selected.resource, nivelFiltroAsignacion, cursoNivelTab]);

  const displayedPeriod = periodosList.find((period) => String(period.id) === periodoGestionId)
    ?? periodosList.find((period) => period.activo)
    ?? periodosList[0];

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  /**
   * Un bloque por GRADO, no por paralelo: 1°A y 1°B cursan lo mismo, así que
   * se muestran juntos con sus paralelos adentro. Dentro de cada bloque los
   * cursos siguen siendo filas propias porque horarios, inscripciones y
   * asignaciones sí son por paralelo.
   */
  const cursosPorGrado = useMemo(() => {
    const mapa = new Map<string, { nivel: Nivel; grado: string; cursos: Item[] }>();
    for (const item of filteredRows) {
      const nivel = String(item.nivel ?? '').toLowerCase() as Nivel;
      const grado = String(item.grado ?? '').trim();
      const clave = `${nivel}|${grado}`;
      if (!mapa.has(clave)) mapa.set(clave, { nivel, grado, cursos: [] });
      mapa.get(clave)!.cursos.push(item);
    }
    return [...mapa.values()]
      .map((grupo) => ({
        ...grupo,
        cursos: grupo.cursos.slice().sort((a, b) =>
          String(a.paralelo ?? '').localeCompare(String(b.paralelo ?? ''))
        ),
      }))
      .sort((a, b) => {
        const ordenNivel = ['inicial', 'primaria', 'secundaria', 'bachillerato'];
        const porNivel = ordenNivel.indexOf(a.nivel) - ordenNivel.indexOf(b.nivel);
        if (porNivel !== 0) return porNivel;
        return (numeroGrado(a.grado) ?? 99) - (numeroGrado(b.grado) ?? 99);
      });
  }, [filteredRows]);

  const paginatedGrados = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return cursosPorGrado.slice(start, start + pageSize);
  }, [cursosPorGrado, currentPage, pageSize]);

  // Lo que cuenta como "un registro" depende de la pestaña: en Cursos base es
  // un grado con todos sus paralelos, en el resto es una fila.
  const totalRegistros = selected.resource === 'cursos' ? cursosPorGrado.length : filteredRows.length;

  useEffect(() => {
    setCurrentPage(1);
  }, [selected, periodoSeleccionadoFiltro, nivelFiltroAsignacion, cursoNivelTab]);

  // Cargar lista de periodos para el selector de periodos historicos
  useEffect(() => {
    if (['cursos-periodo', 'asesores', 'asignaciones'].includes(selected.resource)) {
      academicServicesApi.list('periodos', { limit: 50 })
        .then((res) => {
          const items = res.data ?? [];
          setPeriodosList(items);
          setPeriodoGestionId((current) => {
            if (current && items.some((item) => String(item.id) === current)) return current;
            const currentYear = new Date().getFullYear();
            return String(items.find((item) => item.anio === currentYear && item.activo)?.id
              ?? items.find((item) => item.anio === currentYear)?.id
              ?? items[0]?.id
              ?? '');
          });
        })
        .catch(() => undefined);
    }
  }, [selected.resource]);

  const load = async () => {
    // La Maya curricular carga sola desde su propio panel.
    if (esMayaCurricular) return;
    setLoading(true);
    try {
      // `buscar` NO se manda al servidor: el filtrado es del cliente y en
      // vivo. Mandarlo además dejaría la lista recortada para siempre, y al
      // borrar el texto no volverían a aparecer los registros.
      const queryParams: Record<string, any> = {};
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

  // Sincronización en tiempo real vía Webhooks/SignalR
  useRealtimeResource(selected.resource, () => {
    void load();
  });

  useEffect(() => { setSelected(available[0]); }, [area]);
  // La búsqueda es por pestaña: un término de "cursos" no debe filtrar
  // "materias" si después se cambia de pestaña.
  useEffect(() => { setSearch(''); }, [selected.title]);
  useEffect(() => {
    setValues(initialValues(selected));
    if (selected.resource === 'cursos') {
      setValues((current) => ({ ...current, nivel: cursoNivelTab }));
    }
    setEditing(null);
    setShowForm(false);
    setFile(null);
    setPeriodoSeleccionadoFiltro('activo');
    setPeriodoGestionId('');
    if (!['cursos-periodo', 'asesores', 'asignaciones'].includes(selected.resource)) {
      setPeriodosList([]);
    }
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
      entries.forEach(([source, items]) => {
        if (source === 'usuarios') {
          const users = items as Item[];
          next.estudiantes = users.filter((item) => ['estudiante', 'alumno'].includes(String(item.rol ?? '').toLowerCase()) || String(item.rolId) === '3');
          next.docentes = users.filter((item) => ['profesor', 'maestro', 'maestros', 'docente'].includes(String(item.rol ?? '').toLowerCase()) || String(item.rolId) === '2');
        } else if (source === 'cursos-periodo' && ['asignaciones', 'asesores'].includes(selected.resource)) {
          const targetPeriodoId = periodoGestionId;
          next['cursos-periodo'] = (items as Item[]).filter((cp) =>
            !targetPeriodoId || String(cp.periodoId ?? cp.periodo?.id ?? '') === targetPeriodoId,
          );
        } else {
          next[source as ReferenceSource] = items as Item[];
        }
      });
      setReferences(next);
    }).catch(() => setReferences({}));
  }, [selected, periodoGestionId]);
  const setValue = (key: string, value: any) => setValues((v) => ({ ...v, [key]: value }));
  useEffect(() => {
    if (selected.resource !== 'asesores' || !values.cursoPeriodoId) return;
    const curso = references['cursos-periodo']?.find((item) => String(item.id) === String(values.cursoPeriodoId));
    const periodo = curso?.periodo;
    const inicio = periodo?.inicioGestion ?? periodo?.fechaInicio;
    const fin = periodo?.finGestion ?? periodo?.fechaFin;
    if (!inicio || !fin) return;
    setValues((current) => {
      if (current.fechaInicio === inicio && current.fechaFin === fin) return current;
      return { ...current, fechaInicio: inicio, fechaFin: fin };
    });
  }, [selected.resource, values.cursoPeriodoId, references]);
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
  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = Object.fromEntries(
        selected.fields.map((f) => [f.key, normalized(f, values[f.key])]).filter(([, v]) => v !== undefined),
      );
      if (selected.resource === 'periodos' && !editing) {
        payload.inicioGestion = payload.fechaInicio;
        payload.finGestion = payload.fechaFin;
        payload.trimestres = [
          { numero: 1, inicio: payload.inicio1, fin: payload.fin1 },
          { numero: 2, inicio: payload.inicio2, fin: payload.fin2 },
          { numero: 3, inicio: payload.inicio3, fin: payload.fin3 },
        ];
        delete payload.inicio1; delete payload.fin1; delete payload.inicio2; delete payload.fin2; delete payload.inicio3; delete payload.fin3;
      }

      if (selected.resource === 'materiales') {
        if (!editing && file) {
          // Creación: siempre multipart
          const data = new FormData();
          Object.entries(payload).forEach(([key, value]) => data.append(key, String(value)));
          data.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
          await academicServicesApi.uploadMaterial(data);
        } else if (editing && file) {
          // Edición con reemplazo de archivo: multipart PUT
          const data = new FormData();
          Object.entries(payload).forEach(([key, value]) => data.append(key, String(value)));
          data.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
          await academicServicesApi.updateMaterialWithFile(String(editing.id), data);
        } else if (editing) {
          // Edición solo de metadatos: JSON
          await academicServicesApi.update(selected.resource, String(editing.id), payload);
        }
      } else if (editing) {
        await academicServicesApi.update(selected.resource, String(editing.id), payload);
      } else {
        await academicServicesApi.create(selected.resource, payload);
      }

      setShowForm(false);
      setEditing(null);
      setFile(null);
      await load();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Revise los datos ingresados.');
    } finally {
      setSaving(false);
    }
  };
  const edit = (item: Item) => { setEditing(item); setValues(Object.fromEntries(selected.fields.map((field) => [field.key, field.key === 'materialIds' && Array.isArray(item[field.key]) ? item[field.key].join(', ') : item[field.key] ?? '']))); setShowForm(true); };
  const remove = (item: Item) => {
    setDeletingItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await academicServicesApi.remove(selected.resource, String(deletingItem.id));
      setDeletingItem(null);
      await load();
    } catch (e) {
      Alert.alert('No se pudo eliminar', e instanceof Error ? e.message : 'Error al procesar la eliminación.');
    } finally {
      setDeleteLoading(false);
    }
  };
  const chooseFile = async () => { const result = await DocumentPicker.getDocumentAsync({ type: fileTypes, copyToCacheDirectory: true }); if (result.canceled) return; const asset = result.assets[0]; if (!fileTypes.includes(asset.mimeType ?? '') || (asset.size ?? 0) > 25 * 1024 * 1024) { Alert.alert('Archivo no permitido', 'Solo PDF, DOCX o Excel de hasta 25 MB.'); return; } setFile(asset); };
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
  return <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8 min-w-0">
    {area === 'academic' && <AcademicManagementPanel onNavigate={onNavigate} />}
    <BentoCard className="p-5"><Text className="text-2xl font-bold text-gray-900">{area === 'academic' ? 'Estructura académica' : area === 'enrollment' ? 'Inscripciones de estudiantes' : 'Aula y seguimiento'}</Text><Text className="text-sm text-gray-500 mt-1">Gestión conectada a los microservicios, con controles de acceso y validación previa.</Text><View className="flex-row flex-wrap gap-2 mt-4">{available.map((d) => <TouchableOpacity key={d.title} onPress={() => setSelected(d)} className={`px-3 py-2 rounded-xl ${selected.title === d.title ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-xs font-bold ${selected.title === d.title ? 'text-white' : 'text-gray-600'}`}>{d.title}</Text></TouchableOpacity>)}</View></BentoCard>

    {esMayaCurricular ? (
      <MayaCurricularScreen
        nivelInicial={cursoNivelTab}
        gradoInicial={gradoMaya || undefined}
        canEdit={canWrite || teachingRoles.includes(role)}
      />
    ) : (
    <>
    <BentoCard className="p-4">
      <View className="flex-row gap-2">
        <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3.5 py-1 border border-gray-200">
          <Ionicons name="search" size={18} color="#801529" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar mientras escribes…"
            className="flex-1 px-2.5 py-3 text-gray-800"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity
              onPress={() => setSearch('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Limpiar búsqueda"
              className="w-6 h-6 rounded-full bg-gray-300 items-center justify-center"
            >
              <Ionicons name="close" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity onPress={load} className="px-4 bg-gray-100 rounded-xl" accessibilityLabel="Recargar">
          <Ionicons name="refresh" size={20} color="#801529" />
        </TouchableOpacity>
        {search ? (
          <View className="px-3 bg-maroon/10 rounded-xl items-center justify-center">
            <Text className="text-xs font-bold text-maroon">{totalRegistros}</Text>
          </View>
        ) : null}
        {canWrite && selected.resource !== 'periodos' && (
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

      {['asesores', 'asignaciones'].includes(selected.resource) && periodosList.length > 0 && (
        <View className="mt-3 pt-3 border-t border-gray-100 gap-2">
          <Text className="text-xs font-bold text-gray-700">Gestión de trabajo para asignaciones</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View className="flex-row gap-2">
              {periodosList.map((periodo) => (
                <TouchableOpacity
                  key={String(periodo.id)}
                  onPress={() => setPeriodoGestionId(String(periodo.id))}
                  className={`px-3 py-1.5 rounded-lg border ${periodoGestionId === String(periodo.id) ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'}`}
                >
                  <Text className={`text-xs font-bold ${periodoGestionId === String(periodo.id) ? 'text-white' : 'text-gray-700'}`}>
                    {periodo.nombre} {periodo.anio}{!periodo.activo ? ' · configuración' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

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
                    {p.estado === 'configuracion' || p.estado === 'borrador' ? 'Configuración' : 'Histórico'} {p.anio}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}

      {/* Cursos base: Segmentación por nivel */}
      {selected.resource === 'cursos' && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">
            Nivel educativo
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {(['primaria', 'secundaria'] as const).map((nivel) => {
              const activo = cursoNivelTab === nivel;
              const total = cursosPorGrado.filter((grupo) => grupo.nivel === nivel).length;
              const sinMaterias = cursosPorGrado.filter(
                (grupo) => grupo.nivel === nivel && Number(grupo.cursos[0]?.totalMaterias ?? 0) === 0,
              ).length;

              return (
                <TouchableOpacity
                  key={nivel}
                  onPress={() => {
                    setCursoNivelTab(nivel);
                    if (!editing && selected.resource === 'cursos') setValue('nivel', nivel);
                  }}
                  activeOpacity={0.8}
                  className={`flex-1 min-w-[150px] rounded-2xl border-2 px-4 py-3 ${
                    activo ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={nivel === 'primaria' ? 'school' : 'library'}
                      size={18}
                      color={activo ? '#FFFFFF' : '#801529'}
                    />
                    <Text
                      className={`text-sm font-bold ${
                        activo ? 'text-white' : 'text-gray-800'
                      }`}
                    >
                      {nivel === 'primaria' ? 'Primaria' : 'Secundaria'}
                    </Text>
                  </View>
                  <Text
                    className={`text-[11px] mt-1 ${
                      activo ? 'text-white/80' : 'text-gray-500'
                    }`}
                  >
                    1° a 6° · {total} {total === 1 ? 'grado' : 'grados'} · {rows.filter((item) => String(item.nivel ?? '').toLowerCase() === nivel).length} paralelos
                  </Text>
                  {sinMaterias > 0 ? (
                    <View className="flex-row items-center gap-1 mt-1.5">
                      <Ionicons
                        name="warning"
                        size={12}
                        color={activo ? '#FFD700' : '#B45309'}
                      />
                      <Text
                        className={`text-[10px] font-bold ${
                          activo ? 'text-white' : 'text-amber-700'
                        }`}
                      >
                        {sinMaterias} sin materias
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
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

    {/* Modal Dialog Overlay para Crear / Editar Registro Académico */}
    <Modal
      visible={showForm}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setShowForm(false);
        setEditing(null);
      }}
    >
      <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
        <View className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex-col">
          <View className="p-5 bg-maroon text-white flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-white">
                {editing ? `Editar ${selected.title}` : `Nuevo registro: ${selected.title}`}
              </Text>
              <Text className="text-xs text-white/80 mt-0.5">
                Complete los campos requeridos para sincronizar con la estructura institucional.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-5 max-h-[75vh]" contentContainerStyle={{ gap: 16 }}>
            <View className="flex-row flex-wrap gap-3">
              {selected.fields
                .filter((field) => {
                  if (selected.resource === 'periodos' && editing && /^(inicio|fin)[123]$/.test(field.key)) return false;
                  if (selected.resource === 'inscripciones' && !editing && field.key === 'fechaRetiro') return false;
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
                      selected.resource === 'asesores' ? (
                        <View className="bg-gray-100 rounded-xl px-3 py-3 min-h-[46px] justify-center">
                          <Text className={`text-sm ${values[field.key] ? 'text-gray-800' : 'text-gray-400'}`}>
                            {values[field.key] ? String(values[field.key]) : 'Se completa al elegir el curso'}
                          </Text>
                        </View>
                      ) : (
                        <BirthDatePicker
                          value={String(values[field.key] ?? '')}
                          onChange={(value) => setValue(field.key, value)}
                          placeholder={field.label}
                          minYear={2020}
                          maxYear={2100}
                        />
                      )
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
                    ) : field.type === 'image' ? (
                      <CoverImagePicker
                        value={values[field.key] ? String(values[field.key]) : null}
                        onChange={(uri) => setValue(field.key, uri ?? '')}
                        label={field.label}
                        fallbackText={String(values.nombre ?? values.grado ?? 'Portada')}
                        levelOrType={String(values.nivel ?? values.tipoMateria ?? values.nombre ?? '')}
                      />
                    ) : (
                      <TextInput
                        value={String(values[field.key] ?? '')}
                        onChangeText={(value) => setValue(field.key, field.type === 'number' ? value.replace(/[^0-9.]/g, '') : value)}
                        placeholder={field.hint ?? field.label}
                        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                        className="bg-gray-100 rounded-xl px-3 py-3 text-gray-800 text-sm"
                      />
                    )}
                    {field.hint ? <Text className="text-xs text-gray-400 mt-1">{field.hint}</Text> : null}
                  </View>
                ))}
            </View>

            {selected.resource === 'materiales' && (
              <TouchableOpacity
                onPress={chooseFile}
                className="mt-4 p-4 border border-dashed border-maroon/40 rounded-xl bg-cream/40 flex-row items-center gap-2"
              >
                <Ionicons name="attach-outline" size={20} color="#801529" />
                <View className="flex-1">
                  <Text className="text-maroon font-semibold" numberOfLines={1}>
                    {file ? file.name : editing?.nombreArchivo ? `📎 ${editing.nombreArchivo}` : 'Adjuntar PDF, DOCX o Excel (máx. 25 MB)'}
                  </Text>
                  {editing && !file && (
                    <Text className="text-xs text-gray-400 mt-0.5">Toca para reemplazar el archivo actual</Text>
                  )}
                  {file && (
                    <Text className="text-xs text-green-600 mt-0.5">✓ Nuevo archivo seleccionado</Text>
                  )}
                </View>
                {file && (
                  <TouchableOpacity
                    onPress={() => setFile(null)}
                    className="p-1"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={save} disabled={saving} className="bg-maroon rounded-xl py-3.5 items-center justify-center mt-4 shadow">
              {saving ? <ActivityIndicator color="#fff" /> : <Text className="font-bold text-white">{editing ? 'Guardar cambios' : 'Registrar'}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>

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
            <View>
              <Text className="text-xs font-semibold text-gray-600 mb-1">Fecha de asistencia *</Text>
              <BirthDatePicker
                value={String(values.fecha ?? '')}
                onChange={(value) => setValue('fecha', value)}
                placeholder="Fecha de asistencia"
                minYear={2020}
                maxYear={2040}
              />
            </View>
          )}
          <ReferencePicker
            field={{ key: 'estudiantes', label: 'Estudiantes', reference: 'estudiantes', multiple: true, required: true }}
            items={references.estudiantes ?? []}
            value={bulkStudents}
            onChange={(value) => setBulkStudents(Array.isArray(value) ? value : [value])}
          />
          {selected.resource === 'calificaciones' ? (
            <TextInput
              value={bulkValue}
              onChangeText={(value) => setBulkValue(value.replace(/[^0-9.]/g, ''))}
              keyboardType="numeric"
              placeholder="Nota para los estudiantes seleccionados *"
              className="bg-gray-100 rounded-xl px-3 py-3"
            />
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

    {/* Materias del GRADO, compartidas por todos sus paralelos */}
    <MateriasGradoModal
      visible={Boolean(gradoMaterias)}
      grado={gradoMaterias}
      paralelos={gradoMaterias?.paralelos}
      canEdit={canWrite}
      onClose={() => setGradoMaterias(null)}
      onChanged={load}
    />

    {/* Modal Flotante para Detalle del Aula */}
    <Modal
      visible={Boolean(cursoPeriodoDetalle)}
      transparent
      animationType="fade"
      onRequestClose={() => setCursoPeriodoDetalle(null)}
    >
      <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
        <View className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex-col">
          <View className="p-5 bg-maroon text-white flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="school" size={20} color="#FFFFFF" />
                <Text className="text-lg font-bold text-white" numberOfLines={1}>
                  {cursoPeriodoDetalle ? formatCursoPeriodo(cursoPeriodoDetalle) : 'Detalle del Aula'}
                </Text>
              </View>
              <Text className="text-xs text-white/80 mt-0.5">
                Capacidad: {cursoPeriodoDetalle?.capacidadMaxima ?? '—'} | Estado: {cursoPeriodoDetalle?.estado ?? 'activo'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCursoPeriodoDetalle(null)}
              className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-5 max-h-[70vh]" contentContainerStyle={{ gap: 16 }}>
            {loadingDetalle ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator color="#801529" size="large" />
                <Text className="text-xs text-gray-500 mt-2 font-medium">Cargando docentes y alumnos...</Text>
              </View>
            ) : (
              <>
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
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>

    {/* Bento Grid de 3 Columnas para Registros Académicos */}
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-lg font-black text-gray-900">
          {selected.resource === 'cursos'
            ? `Grados (${totalRegistros})`
            : `Registros (${totalRegistros})`}
        </Text>
        <View className="bg-gold/20 border border-gold/40 px-3 py-1 rounded-full">
          <Text className="text-xs font-bold text-maroon">
            {displayedPeriod ? `Gestión: ${displayedPeriod.nombre} · ${displayedPeriod.anio}` : 'Gestión: 2026'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="py-16 items-center justify-center bg-white rounded-3xl border border-gray-100 shadow-sm">
          <ActivityIndicator size="large" color="#801529" />
          <Text className="text-xs text-gray-500 mt-3 font-medium">Cargando estructura académica...</Text>
        </View>
      ) : totalRegistros === 0 ? (
        <View className="py-16 items-center justify-center bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Ionicons name={search ? 'search' : 'folder-open-outline'} size={44} color="#D1D5DB" />
          <Text className="text-base font-bold text-gray-700 mt-2">
            {search ? 'Sin coincidencias' : 'No hay registros para mostrar'}
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            {search
              ? `Ningún registro de ${selected.title.toLowerCase()} contiene "${search}".`
              : 'Utilice el botón superior para registrar un nuevo elemento.'}
          </Text>
          {search ? (
            <Button
              label="Limpiar búsqueda"
              icon="close"
              variant="secondary"
              size="sm"
              className="mt-3"
              onPress={() => setSearch('')}
            />
          ) : null}
        </View>
      ) : selected.resource === 'cursos' ? (
        // Un bloque por grado: los paralelos van adentro porque comparten
        // materia y temario.
        <View className="flex-row flex-wrap -mx-2 min-w-0">
          {paginatedGrados.map((grupo) => {
            const paralelos = grupo.cursos
              .map((curso) => String(curso.paralelo ?? '').toUpperCase())
              .filter(Boolean);
            const totalMaterias = grupo.cursos[0]?.totalMaterias ?? 0;
            const sinMaterias = Number(totalMaterias ?? 0) === 0;
            const etiquetaGrado = `${grupo.grado} de ${NIVEL_LABEL[grupo.nivel] ?? grupo.nivel}`;

            return (
              <View key={`${grupo.nivel}|${grupo.grado}`} className="w-full md:w-1/2 lg:w-1/3 p-2 min-w-0">
                <BentoCard className="p-4 bg-white border border-gray-100 shadow-sm h-full justify-between">
                  <View className="min-w-0">
                    <View className="flex-row items-start justify-between gap-2 mb-2.5">
                      <View className="w-10 h-10 rounded-2xl bg-maroon/10 border border-maroon/20 items-center justify-center">
                        <Ionicons name="school-outline" size={20} color="#801529" />
                      </View>
                      <View className="items-end gap-1">
                        {sinMaterias ? (
                          <View className="px-2 py-0.5 bg-amber-100 rounded-md">
                            <Text className="text-[10px] font-bold text-amber-800">Sin materias</Text>
                          </View>
                        ) : (
                          <View className="px-2 py-0.5 bg-green-100 rounded-md">
                            <Text className="text-[10px] font-bold text-green-700">
                              {totalMaterias} materias
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Text className="font-bold text-gray-900 text-sm" numberOfLines={2}>
                      {etiquetaGrado}
                    </Text>

                    {/* Paralelos: siguen siendo cursos aparte para horarios,
                        inscripciones y asignaciones. */}
                    <View className="bg-gray-50 border border-gray-200 rounded-2xl p-3 mt-3">
                      <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">
                        Paralelos · {grupo.cursos.length}
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {grupo.cursos.map((curso) => (
                          <View
                            key={String(curso.id)}
                            className={`flex-1 min-w-[76px] rounded-xl px-3 py-2.5 border-2 items-center ${
                              curso.activo === false
                                ? 'bg-gray-100 border-gray-300'
                                : 'bg-maroon border-maroon'
                            }`}
                          >
                            <Text
                              className={`text-2xl font-black leading-8 ${
                                curso.activo === false ? 'text-gray-500' : 'text-white'
                              }`}
                            >
                              {String(curso.paralelo ?? '—').toUpperCase()}
                            </Text>
                            <Text
                              className={`text-[10px] font-semibold mt-0.5 ${
                                curso.activo === false ? 'text-gray-500' : 'text-white/80'
                              }`}
                            >
                              {curso.activo === false ? 'inactivo' : `${curso.capacidadMaxima ?? 0} cupos`}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Materias y Maya curricular son por grado, no por paralelo. */}
                    <View className="flex-row flex-wrap gap-2 mt-3">
                      <TouchableOpacity
                        onPress={() =>
                          setGradoMaterias({
                            nivel: grupo.nivel,
                            grado: grupo.grado,
                            paralelos,
                          })
                        }
                        className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl flex-row items-center justify-center gap-1.5 ${
                          sinMaterias ? 'bg-amber-50 border border-amber-300' : 'bg-maroon/10'
                        }`}
                      >
                        <Ionicons
                          name={sinMaterias ? 'warning-outline' : 'book-outline'}
                          size={15}
                          color={sinMaterias ? '#B45309' : '#801529'}
                        />
                        <Text
                          className={`text-xs font-bold ${
                            sinMaterias ? 'text-amber-800' : 'text-maroon'
                          }`}
                        >
                          {sinMaterias ? 'Asignar materias' : 'Materias'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          setCursoNivelTab(grupo.nivel === 'secundaria' ? 'secundaria' : 'primaria');
                          setGradoMaya(grupo.grado);
                          setSelected(
                            definitions.find((d) => d.title === 'Maya curricular') ?? selected
                          );
                        }}
                        className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-blue-50 flex-row items-center justify-center gap-1.5"
                      >
                        <Ionicons name="map-outline" size={15} color="#2563EB" />
                        <Text className="text-xs font-bold text-blue-700">Maya curricular</Text>
                      </TouchableOpacity>
                    </View>

                    {canWrite ? (
                      <View className="mt-3 pt-2.5 border-t border-gray-100">
                        <Text className="text-[10px] font-bold text-gray-500 uppercase mb-2">
                          Administrar paralelos
                        </Text>
                        <View className="gap-1.5">
                          {grupo.cursos.map((curso) => (
                            <View
                              key={String(curso.id)}
                              className="flex-row items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2"
                            >
                              <View className="flex-row items-center gap-2 min-w-0">
                                <View className="w-8 h-8 rounded-lg bg-maroon items-center justify-center">
                                  <Text className="text-sm font-black text-white">
                                    {String(curso.paralelo ?? '—').toUpperCase()}
                                  </Text>
                                </View>
                                <Text className="text-xs font-bold text-gray-700" numberOfLines={1}>
                                  Capacidad {curso.capacidadMaxima ?? 0}
                                </Text>
                              </View>
                              <View className="flex-row items-center gap-1">
                                <TouchableOpacity
                                  onPress={() => edit(curso)}
                                  className="px-3 py-2 bg-gray-100 rounded-lg flex-row items-center gap-1"
                                  accessibilityLabel={`Editar paralelo ${curso.paralelo}`}
                                >
                                  <Ionicons name="create-outline" size={15} color="#801529" />
                                  <Text className="text-[11px] font-bold text-maroon">Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => remove(curso)}
                                  className="px-3 py-2 bg-red-50 rounded-lg flex-row items-center gap-1"
                                  accessibilityLabel={`Eliminar paralelo ${curso.paralelo}`}
                                >
                                  <Ionicons name="trash-outline" size={15} color="#DC2626" />
                                  <Text className="text-[11px] font-bold text-red-600">Eliminar</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </BentoCard>
              </View>
            );
          })}
        </View>
      ) : (
        <View className="flex-row flex-wrap -mx-2 min-w-0">
          {paginatedRows.map((item) => {
            const isAsesor = selected.resource === 'asesores';
            const isCursoPeriodo = selected.resource === 'cursos-periodo';
            // Sin materias el curso queda fuera de la próxima gestión; se avisa
            // en la propia tarjeta para que se note antes de generar.
            const sinMaterias = selected.resource === 'cursos' && Number(item.totalMaterias ?? 0) === 0;
            const isVigente = isAsesor && (item.cursoPeriodo?.periodo?.activo === true || item.fechaFin === null || item.fechaFin === undefined || item.fechaFin === '');
            const iconName = selected.resource === 'periodos' ? 'calendar-outline'
              : selected.resource === 'cursos' ? 'school-outline'
              : selected.resource === 'materias' ? 'book-outline'
              : selected.resource === 'cursos-periodo' ? 'easel-outline'
              : selected.resource === 'inscripciones' ? 'person-add-outline'
              : selected.resource === 'asignaciones' ? 'briefcase-outline'
              : selected.resource === 'asesores' ? 'ribbon-outline'
              : selected.resource === 'materiales' ? 'document-attach-outline'
              : selected.resource === 'encargos' ? 'clipboard-outline'
              : selected.resource === 'calificaciones' ? 'star-outline'
              : 'checkmark-circle-outline';

            return (
              <View key={item.id} className="w-full md:w-1/2 lg:w-1/3 p-2 min-w-0">
                <BentoCard className="p-4 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between h-full shadow-sm hover:shadow-md overflow-hidden">
                  <View className="min-w-0">
                    {/* Carátula / Portada para Cursos y Materias */}
                    {(selected.resource === 'cursos' || selected.resource === 'materias') && (
                      <View className="w-full h-24 rounded-2xl overflow-hidden mb-3 relative bg-gray-100 border border-gray-200 shadow-sm">
                        {item.caratulaUrl ? (
                          <Image
                            source={{ uri: item.caratulaUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          (() => {
                            const fallback = getFallbackGradient(item.nivel ?? item.tipoMateria ?? item.nombre);
                            return (
                              <View className={`w-full h-full ${fallback.bg} items-center justify-center p-2`}>
                                <Ionicons name={fallback.icon} size={28} color="#FFFFFF" />
                                <Text className="text-white font-bold text-xs mt-1 text-center" numberOfLines={1}>
                                  {labelFor(item, selected.resource)}
                                </Text>
                              </View>
                            );
                          })()
                        )}
                      </View>
                    )}

                    {/* Header de la Tarjeta Bento */}
                    <View className="flex-row items-start justify-between gap-2 mb-2.5">
                      <View className="w-10 h-10 rounded-2xl bg-maroon/10 border border-maroon/20 items-center justify-center">
                        <Ionicons name={iconName} size={20} color="#801529" />
                      </View>
                      <View className="flex-row items-center gap-1.5 flex-wrap justify-end">
                        {isVigente && (
                          <View className="px-2 py-0.5 bg-green-100 rounded-md">
                            <Text className="text-[10px] font-bold text-green-700">Vigente</Text>
                          </View>
                        )}
                        {item.estado && (
                          <StatusBadge status={item.estado} />
                        )}
                        {item.activo !== undefined && (
                          <View className={`px-2 py-0.5 rounded-md ${item.activo ? 'bg-green-100' : 'bg-red-100'}`}>
                            <Text className={`text-[10px] font-bold ${item.activo ? 'text-green-700' : 'text-red-700'}`}>
                              {item.activo ? 'Activo' : 'Inactivo'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Título Principal */}
                    <Text className="font-bold text-gray-900 text-sm mb-1" numberOfLines={2} ellipsizeMode="tail">
                      {labelFor(item, selected.resource)}
                    </Text>

                    {/* Métricas y Datos Destacados Bento */}
                    {selected.resource === 'materiales' ? (
                      <View className="my-2 gap-1.5">
                        {item.nombreArchivo && (
                          <View className="flex-row items-center gap-1.5 flex-wrap">
                            {(() => {
                              const ext = (item.nombreArchivo?.split('.').pop() || '').toLowerCase();
                              const colorMap: Record<string, string> = {
                                pdf: 'bg-red-100 border-red-200',
                                docx: 'bg-blue-100 border-blue-200',
                                doc: 'bg-blue-100 border-blue-200',
                                xlsx: 'bg-green-100 border-green-200',
                                xls: 'bg-green-100 border-green-200',
                              };
                              const textColorMap: Record<string, string> = {
                                pdf: 'text-red-700',
                                docx: 'text-blue-700',
                                doc: 'text-blue-700',
                                xlsx: 'text-green-700',
                                xls: 'text-green-700',
                              };
                              const bgClass = colorMap[ext] ?? 'bg-gray-100 border-gray-200';
                              const textClass = textColorMap[ext] ?? 'text-gray-700';
                              return (
                                <View className={`px-2 py-0.5 rounded-md border ${bgClass}`}>
                                  <Text className={`text-[10px] font-black uppercase ${textClass}`}>{ext || 'DOC'}</Text>
                                </View>
                              );
                            })()}
                            <Text className="text-xs text-gray-600 flex-1 font-medium" numberOfLines={1}>
                              {item.nombreArchivo}
                            </Text>
                          </View>
                        )}
                        {item.tamanioBytes != null && (
                          <Text className="text-[10px] text-gray-400 font-mono">
                            {item.tamanioBytes > 1024 * 1024
                              ? `${(item.tamanioBytes / (1024 * 1024)).toFixed(2)} MB`
                              : `${(item.tamanioBytes / 1024).toFixed(1)} KB`}
                          </Text>
                        )}
                        {item.detalle ? (
                          <Text className="text-xs text-gray-500" numberOfLines={2}>{item.detalle}</Text>
                        ) : null}
                      </View>
                    ) : (
                      <View className="flex-row flex-wrap gap-1.5 my-2">
                        {selected.fields
                          .filter((f) => !f.key.toLowerCase().endsWith('id') && f.key !== 'activo' && f.key !== 'estado')
                          .slice(0, 4)
                          .map((f) => {
                            const val = item[f.key];
                            if (val === undefined || val === null || val === '') return null;
                            return (
                              <View key={f.key} className="bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 max-w-full min-w-0">
                                <Text className="text-[10px] text-gray-500 font-semibold">{f.label}:</Text>
                                <Text className="text-xs font-bold text-gray-800 flex-1 min-w-0" numberOfLines={1} ellipsizeMode="tail">
                                  {Array.isArray(val) ? val.join(', ') : String(val)}
                                </Text>
                              </View>
                            );
                          })}
                      </View>
                    )}


                    {/* Botón de inspección para aulas */}
                    {isCursoPeriodo && (
                      <TouchableOpacity
                        onPress={() => handleOpenCursoDetalle(item)}
                        className="mt-1 py-2 px-3 bg-maroon/10 hover:bg-maroon/20 rounded-xl flex-row items-center justify-center gap-1.5"
                      >
                        <Ionicons name="people-outline" size={15} color="#801529" />
                        <Text className="text-xs font-bold text-maroon">Ver Estudiantes y Docentes</Text>
                      </TouchableOpacity>
                    )}

                    {/* Botón de vista previa para materiales */}
                    {selected.resource === 'materiales' && item.archivoUrl && (
                      <TouchableOpacity
                        onPress={() => setViewerMaterial(item)}
                        className="mt-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 rounded-xl flex-row items-center justify-center gap-1.5"
                      >
                        <Ionicons name="eye-outline" size={15} color="#2563EB" />
                        <Text className="text-xs font-bold text-blue-700">
                          {(() => {
                            const ext = (item.nombreArchivo?.split('.').pop() || '').toLowerCase();
                            if (ext === 'pdf') return 'Vista previa PDF';
                            if (['docx', 'doc'].includes(ext)) return 'Abrir en Docs';
                            if (['xlsx', 'xls'].includes(ext)) return 'Abrir en Sheets';
                            return 'Ver archivo';
                          })()}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Barra de Acciones */}
                  <View className="flex-row flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-gray-100 min-w-0">
                    <Text className="text-[11px] text-gray-400 font-mono">ID #{item.id}</Text>
                    <View className="flex-row flex-wrap items-center gap-1">
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
                          className="px-2.5 py-1 bg-red-50 rounded-lg mr-1"
                        >
                          <Text className="text-[11px] font-bold text-red-600">Retirar</Text>
                        </TouchableOpacity>
                      )}
                      {canWrite && (
                        <>
                          <TouchableOpacity onPress={() => edit(item)} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg">
                            <Ionicons name="create-outline" size={16} color="#801529" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => remove(item)} className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg">
                            <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                </BentoCard>
              </View>
            );
          })}
        </View>
      )}

      {/* Paginación: en "Cursos base" se pagina por GRADO, no por fila de curso. */}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.max(1, Math.ceil(totalRegistros / pageSize))}
        totalRecords={totalRegistros}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
        className="mt-4"
      />
    </View>

    {/* Visor de documentos de materiales */}
    <InAppDocumentViewerModal
      visible={Boolean(viewerMaterial)}
      onClose={() => setViewerMaterial(null)}
      title={viewerMaterial?.titulo ?? 'Material'}
      url={viewerMaterial?.archivoUrl ?? null}
      fileName={viewerMaterial?.nombreArchivo ?? undefined}
      mimeType={viewerMaterial?.tipoMime ?? undefined}
      fileSize={viewerMaterial?.tamanioBytes ?? undefined}
      uploadedAt={viewerMaterial?.fechaSubida ?? undefined}
    />

    {/* Modal de confirmación de eliminación */}
    <ConfirmDeleteModal
      visible={Boolean(deletingItem)}
      title={`Eliminar ${selected.title.slice(0, -1) || 'registro'}`}
      itemName={deletingItem ? labelFor(deletingItem, selected.resource) : undefined}
      message={`¿Está seguro de que desea eliminar este registro de ${selected.title.toLowerCase()}?`}
      warningNote={selected.resource === 'materiales'
        ? 'Se eliminará el registro y también el archivo físico de MinIO.'
        : selected.resource === 'periodos'
          ? 'Se eliminarán también cursos, inscripciones, datos de estudiantes, pensiones, pagos, horarios, materiales y calificaciones de esta gestión.'
          : undefined}
      loading={deleteLoading}
      onCancel={() => setDeletingItem(null)}
      onConfirm={handleConfirmDelete}
    />
    </>
    )}
  </ScrollView>;
}

