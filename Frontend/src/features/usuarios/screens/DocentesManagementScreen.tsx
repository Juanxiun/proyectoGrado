import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { Pagination } from '../../../displays/components/Pagination';
import { useUsuariosList } from '../../../hooks/useUsuarios';
import { usuariosApi } from '../../../api/usuarios.api';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { useAuth } from '../../../context/AuthContext';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { DocumentInput } from '../components/DocumentInput';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { BajaConfirmModal } from '../components/BajaConfirmModal';
import { MateriaSelectorModal } from '../components/MateriaSelectorModal';
import { RemoteImage } from '../../../displays/components/RemoteImage';
import { generateStudentEmail, generateUsername } from '../../../utils/usernameGenerator';
import { getFullName } from '../../../utils/validation';
import { academicServicesApi } from '../../../api/academicServices.api';
import type {
  CreateUsuarioPayload,
  EstadoUsuario,
  UpdateUsuarioPayload,
  Usuario,
  UsuarioDoc,
} from '../../../types';

const DOCENTE_REQUIRED_DOCS = ['CI', 'Diploma de Bachiller', 'Certificado de Egreso'];

const emptyDocenteForm = {
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  nacimiento: '',
  genero: 'masculino' as const,
  especialidad: 'Matemáticas',
  fechaContratacion: new Date().toISOString().split('T')[0],
  username: '',
  email: '',
  password: '',
  zona: '',
  distrito: '',
  calle: '',
  numero: '',
  celular: '',
};

export function DocentesManagementScreen() {
  const { user } = useAuth();
  const userRol = user?.rol?.toLowerCase() ?? '';
  const canEdit = userRol === 'director' || userRol === 'control' || userRol === 'gerencia';

  const { data, loading, error, fetchList } = useUsuariosList();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoUsuario | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDocente, setEditingDocente] = useState<Usuario | null>(null);

  const [form, setForm] = useState(emptyDocenteForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [docenteDocs, setDocenteDocs] = useState<UsuarioDoc[]>([
    { tipoDoc: 'CI', numeroDoc: '' },
    { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
    { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
  ]);
  const [docentePhoto, setDocentePhoto] = useState<string | undefined>(undefined);
  const [bajaTarget, setBajaTarget] = useState<Usuario | null>(null);
  const [bajaLoading, setBajaLoading] = useState(false);
  const [selectedDocenteDetail, setSelectedDocenteDetail] = useState<Usuario | null>(null);
  const [docentesListTab, setDocentesListTab] = useState<'enabled' | 'disabled'>('enabled');
  const [materiasDisponibles, setMateriasDisponibles] = useState<Array<{ id: string; nombre: string; codigo: string }>>([]);
  const [cursosPeriodoDisponibles, setCursosPeriodoDisponibles] = useState<Array<any>>([]);
  const [materiasSeleccionadas, setMateriasSeleccionadas] = useState<string[]>([]);
  const [cursosPeriodoSeleccionados, setCursosPeriodoSeleccionados] = useState<string[]>([]);
  const [nivelFiltroCarga, setNivelFiltroCarga] = useState<'primaria' | 'secundaria' | 'todos'>('primaria');

  const refresh = () => {
    fetchList({ buscar: search, estado: statusFilter, limit: 100 }).catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    return connectUsersWebSocket(refresh);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!showModal || !canEdit) return;
    Promise.all([
      academicServicesApi.list('materias', { activo: 'true' }),
      academicServicesApi.list('cursos-periodo', { estado: 'activo' }),
    ]).then(([materias, cursosPeriodo]) => {
      setMateriasDisponibles(materias.data as Array<{ id: string; nombre: string; codigo: string }>);
      setCursosPeriodoDisponibles(cursosPeriodo.data);
    }).catch(() => Alert.alert('No se pudieron cargar las asignaciones', 'Verifique que existan materias y cursos activos antes de registrar al docente.'));
  }, [showModal, canEdit]);

  const resetForm = () => {
    setEditingDocente(null);
    setForm(emptyDocenteForm);
    setFieldErrors({});
    setDocenteDocs([
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
      { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
    ]);
    setDocentePhoto(undefined);
    setMateriasSeleccionadas([]);
    setCursosPeriodoSeleccionados([]);
  };

  // Autogenerar username al cambiar nombre, apellidos o CI si es nuevo registro
  const handleAutoFillUsername = (
    nombre: string,
    paterno: string,
    materno: string,
    ci: string,
  ) => {
    if (!editingDocente) {
      const generated = generateUsername(nombre, paterno, materno, ci);
      if (generated) {
        setForm((f) => ({
          ...f,
          username: f.username && f.username !== generated ? f.username : generated,
          email: f.email && !f.email.includes('@shalom.edu.bo') ? f.email : generateStudentEmail(generated),
        }));
      }
    }
  };

  const handleSaveDocente = async () => {
    setFieldErrors({});
    if (!form.nombre || !form.apellidoPaterno || !form.apellidoMaterno || !form.nacimiento) {
      Alert.alert('Campos requeridos', 'Ingrese los datos personales obligatorios.');
      return;
    }
    const missingRequired = DOCENTE_REQUIRED_DOCS.filter(
      (req) => !docenteDocs.some((d) => d.tipoDoc === req && d.numeroDoc.trim())
    );
    if (missingRequired.length > 0) {
      Alert.alert('Documentos de regularización', `${missingRequired.join(', ')} son obligatorios según la regulación de Bolivia.`);
      return;
    }
    if (!editingDocente && (!form.username || !form.email)) {
      Alert.alert('Cuenta de acceso', 'Ingrese el nombre de usuario y correo para el docente.');
      return;
    }
    if (!editingDocente && !docentePhoto) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil del docente (PNG/JPG).');
      return;
    }

    const ciDoc = docenteDocs.find((d) => d.tipoDoc.toUpperCase() === 'CI');
    const hasCiFile = Boolean(ciDoc?.fileUri || ciDoc?.docUrl);
    if (!hasCiFile) {
      Alert.alert(
        '⚠️ Archivo Crítico CI Faltante',
        'No se ha adjuntado el archivo digital en PDF para la Cédula de Identidad (CI).\n\nEste documento es crítico para el registro docente. ¿Desea guardarlo sin archivo digital o prefiere adjuntarlo ahora?',
        [
          { text: 'Adjuntar ahora', style: 'cancel' },
          { text: 'Guardar sin archivo', style: 'destructive', onPress: () => executeSaveDocente() },
        ],
      );
      return;
    }

    await executeSaveDocente();
  };

  const executeSaveDocente = async () => {
    setSaving(true);
    setFieldErrors({});
    try {
      let maestroUsuarioId: string;
      if (editingDocente) {
        const updatePayload: UpdateUsuarioPayload = {
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          nacimiento: form.nacimiento,
          genero: form.genero,
          maestro: { especialidad: materiasDisponibles.find((materia) => materia.id === materiasSeleccionadas[0])?.nombre ?? form.especialidad },
          documentos: docenteDocs,
          direccion: form.zona ? { zona: form.zona, distrito: form.distrito || undefined, calle: form.calle || undefined, numero: form.numero || undefined } : undefined,
          contactos: form.celular ? [{ tipo: 'Celular', contenido: form.celular }] : undefined,
          cuenta: form.username && form.email ? { username: form.username, email: form.email, password: form.password || undefined } : undefined,
        };

        await usuariosApi.updateWithFiles(editingDocente.id, updatePayload, docentePhoto);
        maestroUsuarioId = editingDocente.id;
        Alert.alert('Éxito', 'Docente actualizado correctamente.');
      } else {
        const createPayload: CreateUsuarioPayload = {
          rolId: '2',
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          nacimiento: form.nacimiento,
          genero: form.genero,
          maestro: { especialidad: materiasDisponibles.find((materia) => materia.id === materiasSeleccionadas[0])?.nombre ?? form.especialidad, fechaContratacion: form.fechaContratacion },
          cuenta: { username: form.username, email: form.email, password: form.password || undefined },
          documentos: docenteDocs,
          direccion: form.zona ? { zona: form.zona, distrito: form.distrito || undefined, calle: form.calle || undefined, numero: form.numero || undefined } : undefined,
          contactos: form.celular ? [{ tipo: 'Celular', contenido: form.celular }] : [],
        };

        const created = await usuariosApi.createWithFiles(createPayload, docentePhoto);
        maestroUsuarioId = String(created.id);
      }

      // El servicio de inscripción acepta el usuario del maestro y lo resuelve
      // a su registro interno. Se crean todas las combinaciones seleccionadas.
      if (materiasSeleccionadas.length && cursosPeriodoSeleccionados.length) {
        const requests = cursosPeriodoSeleccionados.flatMap((cursoPeriodoId) => materiasSeleccionadas.map((materiaId) =>
          academicServicesApi.create('asignaciones', { maestroId: maestroUsuarioId, materiaId, cursoPeriodoId, estado: 'activo' }),
        ));
        const results = await Promise.allSettled(requests);
        const failed = results.filter((result) => result.status === 'rejected').length;
        if (failed) Alert.alert('Docente guardado', `Se registró la ficha, pero ${failed} asignación(es) ya existían o no pudieron crearse.`);
        else Alert.alert('Éxito', `Docente guardado y asignado a ${requests.length} carga(s) académica(s).`);
      } else {
        Alert.alert('Éxito', editingDocente ? 'Docente actualizado correctamente.' : 'Docente registrado correctamente. Credenciales enviadas por correo Brevo.');
      }

      setShowModal(false);
      resetForm();
      refresh();
    } catch (err: any) {
      const msg = err?.message || 'No se pudo guardar el docente';
      const errors: Record<string, string> = {};
      if (err?.field) {
        errors[err.field] = msg;
      }
      if (/username|usuario/i.test(msg)) errors.username = 'El nombre de usuario ya está en uso.';
      if (/email|correo/i.test(msg)) errors.email = 'El correo institucional ya está en uso.';
      if (/documento|numero_doc|ci/i.test(msg)) errors['documento:CI'] = 'La cédula de identidad ya está registrada.';
      
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        Alert.alert('Datos Duplicados', Object.values(errors)[0]);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u: Usuario) => {
    setEditingDocente(u);
    const docs = u.documentos ?? [];
    const nac = u.nacimiento ? String(u.nacimiento).slice(0, 10) : '';

    setForm({
      nombre: u.nombre ?? '',
      apellidoPaterno: u.apellidoPaterno || (u as any).apellido_paterno || '',
      apellidoMaterno: u.apellidoMaterno || (u as any).apellido_materno || '',
      nacimiento: nac,
      genero: (u.genero as any) ?? 'masculino',
      especialidad: (u as any).especialidad || (u as any).maestro?.especialidad || 'Matemáticas',
      fechaContratacion: new Date().toISOString().split('T')[0],
      username: u.username ?? (u as any).cuenta?.username ?? '',
      email: u.email ?? (u as any).cuenta?.email ?? '',
      password: '',
      zona: u.direccion?.zona ?? '',
      distrito: u.direccion?.distrito ?? '',
      calle: u.direccion?.calle ?? '',
      numero: u.direccion?.numero ?? '',
      celular: u.contactos?.[0]?.contenido ?? '',
    });

    const mappedDocs: UsuarioDoc[] = docs.map((d) => ({
      id: d.id,
      tipoDoc: d.tipoDoc || (d as any).tipo_doc,
      numeroDoc: d.numeroDoc || (d as any).numero_doc,
      docUrl: d.docUrl,
      fileUri: undefined,
      fileName: undefined,
    }));
    if (!mappedDocs.some((d) => d.tipoDoc.toUpperCase() === 'CI')) {
      mappedDocs.unshift({ tipoDoc: 'CI', numeroDoc: '' });
    }
    setDocenteDocs(mappedDocs);
    setDocentePhoto(u.fotoUrl ?? undefined);
    // Las asignaciones existentes se conservan; se pueden añadir nuevas desde
    // esta misma ficha mediante materias y cursos-periodo.
    setMateriasSeleccionadas([]);
    setCursosPeriodoSeleccionados([]);

    setShowModal(true);
  };

  const handleToggleState = (u: Usuario) => {
    if (u.estado === 1) {
      setBajaTarget(u);
      return;
    }
    const executeReactivate = async () => {
      try {
        await usuariosApi.update(u.id, { estado: 1 });
        refresh();
      } catch {
        Alert.alert('Error', 'No se pudo modificar el estado del docente');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm(`¿Está seguro de reactivar al docente ${u.nombre} ${u.apellidoPaterno || ''}?`)) {
        executeReactivate();
      }
      return;
    }

    Alert.alert(
      'Reactivar docente',
      `¿Está seguro de reactivar al docente ${u.nombre} ${u.apellidoPaterno || ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reactivar',
          onPress: executeReactivate,
        },
      ],
    );
  };

  const confirmBaja = async (u: Usuario) => {
    setBajaLoading(true);
    try {
      await usuariosApi.baja(u.id);
      setBajaTarget(null);
      refresh();
    } catch {
      Alert.alert('Error', 'No se pudo dar de baja al docente');
    } finally {
      setBajaLoading(false);
    }
  };

  const docentesList = (data?.data ?? []).filter((u) => {
    const r = (u.rol || '').toLowerCase();
    return r === 'profesor' || r === 'maestro' || r === 'maestros' || String(u.rolId) === '2';
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const habilitados = useMemo(
    () => docentesList.filter((u) => u.estado === 1 || u.estado === 'activo'),
    [docentesList]
  );
  const deshabilitados = useMemo(
    () => docentesList.filter((u) => u.estado === 0 || u.estado === 'inactivo' || u.estado === 'bloqueado'),
    [docentesList]
  );

  const currentList = docentesListTab === 'enabled' ? habilitados : deshabilitados;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentList.slice(start, start + pageSize);
  }, [currentList, currentPage, pageSize]);

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-12" showsVerticalScrollIndicator={false}>
      {/* Cabecera Bento */}
      <BentoCard className="p-5 bg-card border-l-4 border-maroon">
        <View className="flex-row items-center justify-between mb-4 flex-wrap gap-3">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-9 h-9 rounded-xl bg-maroon/15 items-center justify-center">
                <Ionicons name="school-outline" size={20} color="#7A1F3D" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Personal Docente</Text>
            </View>
            <Text className="text-gray-500 text-xs">
              Directorio y gestión institucional de maestros con formato Bento Grid y almacenamiento MinIO.
            </Text>
          </View>

          {canEdit && (
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-maroon rounded-xl px-4 py-2.5 flex-row items-center gap-2 shadow"
            >
              <Ionicons name="person-add" color="#FFF" size={18} />
              <Text className="text-white font-bold text-xs">Registrar Docente</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 border border-gray-200">
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={refresh}
              placeholder="Buscar docente por nombre, CI o usuario..."
              className="flex-1 ml-2 text-gray-800 text-sm"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity onPress={refresh} className="bg-maroon/10 rounded-xl px-4 justify-center items-center">
            <Ionicons name="refresh" size={18} color="#7A1F3D" />
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* Modal Dialog Overlay para Registro o Edición */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowModal(false);
          resetForm();
        }}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
          <View className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex-col">
            <View className="p-5 bg-maroon text-white flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-bold text-white">
                  {editingDocente ? 'Editar Ficha del Docente' : 'Registro de Personal Docente'}
                </Text>
                <Text className="text-xs text-white/80 mt-0.5">
                  Completa los datos personales, académicos y documentación regulada.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5 max-h-[75vh]" contentContainerStyle={{ gap: 16 }}>
              <View className="gap-4">
            {/* Foto de Perfil */}
            <BentoCard className="p-4 bg-cream/40 border border-gold/30">
              <Text className="text-xs font-bold text-maroon mb-2 uppercase">Fotografía Oficial (MinIO)</Text>
              <ProfilePhotoPicker photoUri={docentePhoto} onChange={setDocentePhoto} required={!editingDocente} />
            </BentoCard>

            {/* Datos Personales */}
            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Datos Personales</Text>
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={form.nombre}
                  onChangeText={(v) => {
                    setForm((f) => ({ ...f, nombre: v }));
                    const ciDoc = docenteDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                    handleAutoFillUsername(v, form.apellidoPaterno, form.apellidoMaterno, ciDoc);
                  }}
                  placeholder="Nombre *"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.apellidoPaterno}
                  onChangeText={(v) => {
                    setForm((f) => ({ ...f, apellidoPaterno: v }));
                    const ciDoc = docenteDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                    handleAutoFillUsername(form.nombre, v, form.apellidoMaterno, ciDoc);
                  }}
                  placeholder="Apellido Paterno *"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.apellidoMaterno}
                  onChangeText={(v) => {
                    setForm((f) => ({ ...f, apellidoMaterno: v }));
                    const ciDoc = docenteDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                    handleAutoFillUsername(form.nombre, form.apellidoPaterno, v, ciDoc);
                  }}
                  placeholder="Apellido Materno *"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                />
                <BirthDatePicker value={form.nacimiento} onChange={(v) => setForm((f) => ({ ...f, nacimiento: v }))} />
              </View>
            </BentoCard>

            <BentoCard className="p-4 bg-cream/40 border border-gold/30">
              <Text className="text-xs font-bold text-maroon mb-1 uppercase">Carga académica</Text>
              <Text className="text-xs text-gray-500 mb-3">Seleccione las materias y cursos-periodo. Al guardar, el sistema crea automáticamente las asignaciones docentes para cada combinación.</Text>
              <View className="mb-4">
                <MateriaSelectorModal
                  materias={materiasDisponibles}
                  selectedIds={materiasSeleccionadas}
                  onChange={setMateriasSeleccionadas}
                />
              </View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-gray-700">Cursos y periodos activos</Text>
                <View className="flex-row items-center bg-white rounded-lg p-0.5 border border-gray-200">
                  <TouchableOpacity
                    onPress={() => setNivelFiltroCarga('primaria')}
                    className={`px-2.5 py-1 rounded-md ${nivelFiltroCarga === 'primaria' ? 'bg-maroon' : ''}`}
                  >
                    <Text className={`text-[11px] font-bold ${nivelFiltroCarga === 'primaria' ? 'text-white' : 'text-gray-600'}`}>Primaria</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setNivelFiltroCarga('secundaria')}
                    className={`px-2.5 py-1 rounded-md ${nivelFiltroCarga === 'secundaria' ? 'bg-maroon' : ''}`}
                  >
                    <Text className={`text-[11px] font-bold ${nivelFiltroCarga === 'secundaria' ? 'text-white' : 'text-gray-600'}`}>Secundaria</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setNivelFiltroCarga('todos')}
                    className={`px-2 py-1 rounded-md ${nivelFiltroCarga === 'todos' ? 'bg-maroon' : ''}`}
                  >
                    <Text className={`text-[11px] font-bold ${nivelFiltroCarga === 'todos' ? 'text-white' : 'text-gray-600'}`}>Todos</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {(() => {
                  const filteredCursos = cursosPeriodoDisponibles.filter((cp) => {
                    if (nivelFiltroCarga === 'todos') return true;
                    const nivel = String(cp.curso?.nivel ?? '').trim().toLowerCase();
                    return nivel === nivelFiltroCarga;
                  });

                  if (!filteredCursos.length) {
                    return (
                      <Text className="text-xs text-gray-500 py-2">
                        No hay cursos activos disponibles para el nivel {nivelFiltroCarga === 'todos' ? 'seleccionado' : nivelFiltroCarga}.
                      </Text>
                    );
                  }

                  return filteredCursos.map((cursoPeriodo) => {
                    const selected = cursosPeriodoSeleccionados.includes(String(cursoPeriodo.id));
                    const nivel = cursoPeriodo.curso?.nivel ? cursoPeriodo.curso.nivel.charAt(0).toUpperCase() + cursoPeriodo.curso.nivel.slice(1) : '';
                    const label = `${cursoPeriodo.curso?.grado ?? ''} ${cursoPeriodo.curso?.paralelo ?? ''} ${nivel} - ${cursoPeriodo.periodo?.nombre ?? ''}`.trim();
                    return (
                      <TouchableOpacity
                        key={cursoPeriodo.id}
                        onPress={() =>
                          setCursosPeriodoSeleccionados((current) =>
                            selected ? current.filter((id) => id !== String(cursoPeriodo.id)) : [...current, String(cursoPeriodo.id)]
                          )
                        }
                        className={`px-3 py-2 rounded-xl border ${selected ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'}`}
                      >
                        <Text className={`text-xs font-bold ${selected ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
              <View className="flex-row flex-wrap gap-2 items-center"><BirthDatePicker value={form.fechaContratacion} onChange={(value) => setForm((current) => ({ ...current, fechaContratacion: value }))} placeholder="Fecha de contratación" minYear={2000} maxYear={2100} /><Text className="text-xs text-gray-500">{materiasSeleccionadas.length} materia(s) × {cursosPeriodoSeleccionados.length} curso(s) = {materiasSeleccionadas.length * cursosPeriodoSeleccionados.length} asignación(es)</Text></View>
            </BentoCard>


            {/* Documentos */}
            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <DocumentInput
                documents={docenteDocs}
                onChange={(docs) => {
                  setDocenteDocs(docs);
                  const ciDoc = docs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                  handleAutoFillUsername(form.nombre, form.apellidoPaterno, form.apellidoMaterno, ciDoc);
                }}
                requiredTypes={DOCENTE_REQUIRED_DOCS}
                title="Documentos de Regularización (Normativa Bolivia) - PDF"
                showRequiredBadge={true}
              />
            </BentoCard>

            {/* Cuenta de Acceso */}
            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Cuenta de Acceso Institucional</Text>
              {!editingDocente && (
                <View className="flex-row items-center gap-2 p-2.5 mb-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <Ionicons name="mail-unread-outline" size={18} color="#059669" />
                  <Text className="text-xs text-emerald-800 flex-1">
                    La contraseña se generará de forma segura y se enviará automáticamente al correo institucional registrado vía Brevo.
                  </Text>
                </View>
              )}
              <View className="flex-row flex-wrap gap-2">
                <View className="flex-1 min-w-[150px]">
                  <TextInput
                    value={form.username}
                    onChangeText={(v) => {
                      setForm((f) => ({ ...f, username: v }));
                      if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: '' }));
                    }}
                    placeholder="Nombre de Usuario *"
                    autoCapitalize="none"
                    className={`bg-white rounded-xl px-3 py-2.5 border ${fieldErrors.username ? 'border-red-500' : 'border-gray-200'} text-sm`}
                  />
                  {fieldErrors.username ? <Text className="text-[11px] text-red-500 mt-1">{fieldErrors.username}</Text> : null}
                </View>
                <View className="flex-1 min-w-[150px]">
                  <TextInput
                    value={form.email}
                    onChangeText={(v) => {
                      setForm((f) => ({ ...f, email: v }));
                      if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: '' }));
                    }}
                    placeholder="Correo Institucional *"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className={`bg-white rounded-xl px-3 py-2.5 border ${fieldErrors.email ? 'border-red-500' : 'border-gray-200'} text-sm`}
                  />
                  {fieldErrors.email ? <Text className="text-[11px] text-red-500 mt-1">{fieldErrors.email}</Text> : null}
                </View>
                {editingDocente && (
                  <TextInput
                    value={form.password}
                    onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                    placeholder="Nueva Contraseña (Opcional)"
                    secureTextEntry
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                  />
                )}
              </View>
            </BentoCard>

            {/* Contacto y Dirección */}
            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Contacto y Domicilio</Text>
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={form.celular}
                  onChangeText={(v) => setForm((f) => ({ ...f, celular: v.replace(/[^0-9]/g, '').slice(0, 15) }))}
                  placeholder="Celular (dígitos)"
                  keyboardType="numeric"
                  maxLength={15}
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.zona}
                  onChangeText={(v) => setForm((f) => ({ ...f, zona: v }))}
                  placeholder="Zona / Barrio"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.calle}
                  onChangeText={(v) => setForm((f) => ({ ...f, calle: v }))}
                  placeholder="Calle y Número"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                />
              </View>
            </BentoCard>

            <TouchableOpacity
              onPress={handleSaveDocente}
              disabled={saving}
              className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text className="text-white font-bold text-sm">
                    {editingDocente ? 'Guardar Cambios' : 'Registrar Docente'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View className="flex-row items-center gap-2 p-1.5 rounded-xl bg-gray-100 self-start">
        <TouchableOpacity onPress={() => setDocentesListTab('enabled')} className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${docentesListTab === 'enabled' ? 'bg-maroon' : ''}`}>
          <Ionicons name="checkmark-circle-outline" size={16} color={docentesListTab === 'enabled' ? '#FFF' : '#4B5563'} />
          <Text className={`text-xs font-bold ${docentesListTab === 'enabled' ? 'text-white' : 'text-gray-600'}`}>Habilitados ({habilitados.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDocentesListTab('disabled')} className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${docentesListTab === 'disabled' ? 'bg-maroon' : ''}`}>
          <Ionicons name="close-circle-outline" size={16} color={docentesListTab === 'disabled' ? '#FFF' : '#4B5563'} />
          <Text className={`text-xs font-bold ${docentesListTab === 'disabled' ? 'text-white' : 'text-gray-600'}`}>Deshabilitados ({deshabilitados.length})</Text>
        </TouchableOpacity>
      </View>

      {/* GRID DE CARTAS BENTO PARA DOCENTES - HABILITADOS */}
      {docentesListTab === 'enabled' && <BentoCard className="p-5 bg-white">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
            <Text className="text-lg font-bold text-gray-900">Habilitados</Text>
            <View className="bg-green-100 px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-green-700">{habilitados.length}</Text>
            </View>
          </View>
          {loading && <ActivityIndicator color="#7A1F3D" />}
        </View>

        {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

        {habilitados.length > 0 ? (
          <>
            <View className="flex-row flex-wrap gap-4">
              {paginatedList.map((doc) => {
                const docs = doc.documentos ?? [];
                const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ??
                  (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
                const apPat = doc.apellidoPaterno || (doc as any).apellido_paterno || '';
                const apMat = doc.apellidoMaterno || (doc as any).apellido_materno || '';
                const docFullName = getFullName(doc.nombre, apPat, apMat);
                const especialidad = (doc as any).especialidad || (doc as any).maestro?.especialidad || 'Docencia';
                const celular = doc.contactos?.[0]?.contenido || '';
                const isOnline = doc.estado === 1 || doc.estado === 'activo';

                return (
                  <BentoCard
                    key={doc.id}
                    className="w-full md:w-[48%] lg:w-[31.5%] p-5 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between"
                  >
                    {/* Cabecera de la tarjeta con foto MinIO ampliada a 80px e indicador online/offline */}
                    <View>
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="relative">
                          {doc.fotoUrl ? (
                            <RemoteImage
                              uri={doc.fotoUrl}
                              className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-gold/40 shadow-sm"
                              fallbackText={`${doc.nombre?.charAt(0) || 'D'}${apPat?.charAt(0) || ''}`}
                            />
                          ) : (
                            <View className="w-20 h-20 rounded-2xl bg-maroon border-2 border-gold/40 items-center justify-center shadow-sm">
                              <Text className="text-gold font-serif font-bold text-2xl">
                                {doc.nombre?.charAt(0) || 'D'}{apPat?.charAt(0) || ''}
                              </Text>
                            </View>
                          )}
                          <View
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                              isOnline ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          />
                        </View>

                        <StatusBadge status={doc.estado} />
                      </View>

                      {/* Datos del docente */}
                      <Text className="font-bold text-gray-900 text-base" numberOfLines={2}>
                        {docFullName}
                      </Text>
                      <Text className="text-xs font-mono text-maroon mt-0.5">
                        @{doc.username || 'sin-cuenta'}
                      </Text>

                      {/* Píldoras Bento de información */}
                      <View className="flex-row flex-wrap gap-1.5 mt-3">
                        <View className="bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/40">
                          <Text className="text-xs font-bold text-maroon">{especialidad}</Text>
                        </View>
                        <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                          <Text className="text-xs text-gray-700 font-mono">CI: {ciDoc}</Text>
                        </View>
                      </View>

                      {/* Contacto rápido */}
                      <View className="mt-3 pt-3 border-t border-gray-100 gap-1">
                        {doc.email ? (
                          <View className="flex-row items-center gap-1.5">
                            <Ionicons name="mail-outline" size={13} color="#9CA3AF" />
                            <Text className="text-xs text-gray-500" numberOfLines={1}>
                              {doc.email}
                            </Text>
                          </View>
                        ) : null}
                        {celular ? (
                          <View className="flex-row items-center gap-1.5">
                            <Ionicons name="call-outline" size={13} color="#9CA3AF" />
                            <Text className="text-xs text-gray-500">{celular}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Acciones Bento */}
                    {canEdit && (
                      <View className="flex-row items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                        <TouchableOpacity
                          onPress={() => handleEdit(doc)}
                          className="p-2 bg-gray-100 hover:bg-maroon/10 rounded-xl flex-row items-center gap-1.5"
                        >
                          <Ionicons name="create-outline" size={16} color="#7A1F3D" />
                          <Text className="text-xs font-bold text-maroon">Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleToggleState(doc)}
                          className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                        >
                          <Ionicons
                            name={doc.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                            size={16}
                            color={doc.estado === 1 ? '#DC2626' : '#16A34A'}
                          />
                          <Text
                            className={`text-xs font-semibold ${
                              doc.estado === 1 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {doc.estado === 1 ? 'Baja' : 'Activar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </BentoCard>
                );
              })}
            </View>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(habilitados.length / pageSize)}
              totalRecords={habilitados.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setCurrentPage(1);
              }}
              className="mt-4"
            />
          </>
        ) : (
          <View className="items-center justify-center py-12 px-4">
            <Ionicons name="school-outline" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 text-center mt-4 text-sm">No hay docentes habilitados.</Text>
          </View>
        )}
      </BentoCard>}

      {/* GRID DE CARTAS BENTO PARA DOCENTES - DESHABILITADOS */}
      {docentesListTab === 'disabled' && <BentoCard className="p-5 bg-white">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="close-circle" size={20} color="#DC2626" />
            <Text className="text-lg font-bold text-gray-900">Deshabilitados</Text>
            <View className="bg-red-100 px-3 py-1 rounded-full">
              <Text className="text-sm font-bold text-red-700">{deshabilitados.length}</Text>
            </View>
          </View>
        </View>

        {deshabilitados.length > 0 ? (
          <>
            <View className="flex-row flex-wrap gap-4">
              {paginatedList.map((doc) => {
                const docs = doc.documentos ?? [];
                const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ??
                  (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
                const apPat = doc.apellidoPaterno || (doc as any).apellido_paterno || '';
                const apMat = doc.apellidoMaterno || (doc as any).apellido_materno || '';
                const docFullName = getFullName(doc.nombre, apPat, apMat);
                const especialidad = (doc as any).especialidad || (doc as any).maestro?.especialidad || 'Docencia';
                const celular = doc.contactos?.[0]?.contenido || '';
                const isOnline = doc.estado === 1 || doc.estado === 'activo';

                return (
                  <BentoCard
                    key={doc.id}
                    className="w-full md:w-[48%] lg:w-[31.5%] p-5 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between"
                  >
                    {/* Cabecera de la tarjeta con foto MinIO ampliada a 80px e indicador */}
                    <View>
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="relative">
                          {doc.fotoUrl ? (
                            <RemoteImage
                              uri={doc.fotoUrl}
                              className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-gold/40 shadow-sm"
                              fallbackText={`${doc.nombre?.charAt(0) || 'D'}${apPat?.charAt(0) || ''}`}
                            />
                          ) : (
                            <View className="w-20 h-20 rounded-2xl bg-maroon border-2 border-gold/40 items-center justify-center shadow-sm">
                              <Text className="text-gold font-serif font-bold text-2xl">
                                {doc.nombre?.charAt(0) || 'D'}{apPat?.charAt(0) || ''}
                              </Text>
                            </View>
                          )}
                          <View
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                              isOnline ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          />
                        </View>

                        <StatusBadge status={doc.estado} />
                      </View>

                      {/* Datos del docente */}
                      <Text className="font-bold text-gray-900 text-base" numberOfLines={2}>
                        {docFullName}
                      </Text>
                      <Text className="text-xs font-mono text-maroon mt-0.5">
                        @{doc.username || 'sin-cuenta'}
                      </Text>

                      {/* Píldoras Bento de información */}
                      <View className="flex-row flex-wrap gap-1.5 mt-3">
                        <View className="bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/40">
                          <Text className="text-xs font-bold text-maroon">{especialidad}</Text>
                        </View>
                        <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                          <Text className="text-xs text-gray-700 font-mono">CI: {ciDoc}</Text>
                        </View>
                      </View>

                      {/* Contacto rápido */}
                      <View className="mt-3 pt-3 border-t border-gray-100 gap-1">
                        {doc.email ? (
                          <View className="flex-row items-center gap-1.5">
                            <Ionicons name="mail-outline" size={13} color="#9CA3AF" />
                            <Text className="text-xs text-gray-500" numberOfLines={1}>
                              {doc.email}
                            </Text>
                          </View>
                        ) : null}
                        {celular ? (
                          <View className="flex-row items-center gap-1.5">
                            <Ionicons name="call-outline" size={13} color="#9CA3AF" />
                            <Text className="text-xs text-gray-500">{celular}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Acciones Bento */}
                    {canEdit && (
                      <View className="flex-row items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                        <TouchableOpacity
                          onPress={() => handleEdit(doc)}
                          className="p-2 bg-gray-100 hover:bg-maroon/10 rounded-xl flex-row items-center gap-1.5"
                        >
                          <Ionicons name="create-outline" size={16} color="#7A1F3D" />
                          <Text className="text-xs font-bold text-maroon">Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleToggleState(doc)}
                          className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                        >
                          <Ionicons
                            name={doc.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                            size={16}
                            color={doc.estado === 1 ? '#DC2626' : '#16A34A'}
                          />
                          <Text
                            className={`text-xs font-semibold ${
                              doc.estado === 1 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {doc.estado === 1 ? 'Baja' : 'Activar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {(!canEdit) && (
                      <TouchableOpacity
                        onPress={() => setSelectedDocenteDetail(doc)}
                        className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                      >
                        <Ionicons name="eye-outline" size={16} color="#7A1F3D" />
                        <Text className="text-xs font-bold text-maroon">Ver Ficha</Text>
                      </TouchableOpacity>
                    )}
                  </BentoCard>
                );
              })}
            </View>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(deshabilitados.length / pageSize)}
              totalRecords={deshabilitados.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setCurrentPage(1);
              }}
              className="mt-4"
            />
          </>
        ) : (
          <View className="items-center justify-center py-12 px-4">
            <Ionicons name="school-outline" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 text-center mt-4 text-sm">No hay docentes deshabilitados.</Text>
          </View>
        )}
      </BentoCard>}

      <BajaConfirmModal
        user={bajaTarget}
        visible={Boolean(bajaTarget)}
        loading={bajaLoading}
        onCancel={() => setBajaTarget(null)}
        onConfirm={confirmBaja}
      />
    </ScrollView>
  );
}
