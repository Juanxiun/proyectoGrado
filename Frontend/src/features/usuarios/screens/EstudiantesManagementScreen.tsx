import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { useUsuariosList } from '../../../hooks/useUsuarios';
import { usuariosApi } from '../../../api/usuarios.api';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { useAuth } from '../../../context/AuthContext';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { DocumentInput } from '../components/DocumentInput';
import { BajaConfirmModal } from '../components/BajaConfirmModal';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { RemoteImage } from '../../../displays/components/RemoteImage';
import { generateStudentEmail, generateUsername } from '../../../utils/usernameGenerator';
import { getFullName } from '../../../utils/validation';
import type {
  CreateUsuarioPayload,
  EstadoUsuario,
  UpdateUsuarioPayload,
  Usuario,
  UsuarioDoc,
} from '../../../types';

const TUTOR_REQUIRED_DOCS = ['CI'];
const STUDENT_REQUIRED_DOCS = ['CI', 'RUDE'];

const emptyTutorForm = {
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  nacimiento: '',
  genero: 'masculino' as const,
  ci: '',
  celular: '',
  email: '',
  zona: '',
  distrito: '',
  calle: '',
  numero: '',
  referencia: '',
  parentesco: 'Padre',
};

const emptyStudentForm = {
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  nacimiento: '',
  genero: 'masculino' as const,
  username: '',
  email: '',
  password: '',
  zona: '',
  distrito: '',
  calle: '',
  numero: '',
  referencia: '',
};

function InlineInput({ error, className = '', ...props }: ComponentProps<typeof TextInput> & { error?: string }) {
  return (
    <View className="flex-1 min-w-[150px]">
      <TextInput {...props} className={`bg-white rounded-xl px-3 py-2.5 border text-sm ${error ? 'border-red-500' : 'border-gray-200'} ${className}`} />
      {error ? <Text className="text-xs text-red-600 mt-1">{error}</Text> : null}
    </View>
  );
}

export function EstudiantesManagementScreen() {
  const { user } = useAuth();
  const userRol = user?.rol?.toLowerCase() ?? '';
  const canEdit = userRol === 'director' || userRol === 'control' || userRol === 'gerencia';

  const { data, loading, error, fetchList } = useUsuariosList();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoUsuario | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingStudent, setEditingStudent] = useState<Usuario | null>(null);
  const [editingTutorId, setEditingTutorId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<'student' | 'tutor'>('student');
  const [studentsListTab, setStudentsListTab] = useState<'enabled' | 'disabled'>('enabled');

  const [tutorForm, setTutorForm] = useState(emptyTutorForm);
  const [tutorDocs, setTutorDocs] = useState<UsuarioDoc[]>([{ tipoDoc: 'CI', numeroDoc: '' }]);
  const [tutorPhoto, setTutorPhoto] = useState<string | undefined>(undefined);
  const [createdTutorId, setCreatedTutorId] = useState<string | null>(null);
  const [tutorSummary, setTutorSummary] = useState<string | null>(null);

  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [studentDocs, setStudentDocs] = useState<UsuarioDoc[]>([
    { tipoDoc: 'CI', numeroDoc: '' },
    { tipoDoc: 'RUDE', numeroDoc: '' },
  ]);
  const [studentPhoto, setStudentPhoto] = useState<string | undefined>(undefined);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Usuario | null>(null);
  const [bajaTarget, setBajaTarget] = useState<Usuario | null>(null);
  const [bajaLoading, setBajaLoading] = useState(false);

  const refresh = () => {
    fetchList({ buscar: search, estado: statusFilter, limit: 100 }).catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    return connectUsersWebSocket(refresh);
  }, [search, statusFilter]);

  const resetForms = () => {
    setFieldErrors({});
    setStep(1);
    setEditingStudent(null);
    setEditingTutorId(null);
    setEditTab('student');
    setCreatedTutorId(null);
    setTutorSummary(null);
    setTutorForm(emptyTutorForm);
    setTutorDocs([{ tipoDoc: 'CI', numeroDoc: '' }]);
    setTutorPhoto(undefined);
    setStudentForm(emptyStudentForm);
    setStudentDocs([
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'RUDE', numeroDoc: '' },
    ]);
    setStudentPhoto(undefined);
  };

  const clearFieldError = (field: string) => setFieldErrors((current) => {
    const { [field]: _, ...remaining } = current;
    return remaining;
  });

  const validateStudent = () => {
    const errors: Record<string, string> = {};
    if (!studentForm.nombre.trim()) errors.studentNombre = 'El nombre es obligatorio.';
    if (!studentForm.apellidoPaterno.trim()) errors.studentApellidoPaterno = 'El apellido paterno es obligatorio.';
    if (!studentForm.apellidoMaterno.trim()) errors.studentApellidoMaterno = 'El apellido materno es obligatorio.';
    if (!studentForm.nacimiento) errors.studentNacimiento = 'La fecha de nacimiento es obligatoria.';
    const ci = studentDocs.find((doc) => doc.tipoDoc.toUpperCase() === 'CI');
    const rude = studentDocs.find((doc) => doc.tipoDoc.toUpperCase() === 'RUDE');
    if (!ci?.numeroDoc?.trim()) errors['documento:CI'] = 'El CI es obligatorio.';
    if (!rude?.numeroDoc?.trim()) errors['documento:RUDE'] = 'El RUDE es obligatorio.';
    if (!editingStudent) {
      if (!studentForm.username.trim()) errors.studentUsername = 'El usuario es obligatorio.';
      if (!studentForm.email.trim()) errors.studentEmail = 'El correo institucional es obligatorio.';
      else if (!/^\S+@\S+\.\S+$/.test(studentForm.email)) errors.studentEmail = 'Ingrese un correo válido.';
      if (!studentForm.password) errors.studentPassword = 'La contraseña es obligatoria.';
      else if (studentForm.password.length < 8) errors.studentPassword = 'Debe tener al menos 8 caracteres.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyServerFieldErrors = (err: unknown, prefix: 'student' | 'tutor') => {
    const message = err instanceof Error ? err.message : 'No se pudo guardar la información.';
    const normalized = message.toLowerCase();
    const errors: Record<string, string> = {};
    if (/username|usuario/.test(normalized)) {
      if (prefix === 'student') errors.studentUsername = 'Este nombre de usuario ya está registrado.';
      else errors['documento:CI'] = 'No se pudo registrar el tutor porque ya existe una cuenta generada con estos datos. Revise el CI.';
    }
    if (/email|correo/.test(normalized)) errors[`${prefix}Email`] = 'Este correo ya está registrado.';
    if (/numero_doc|número de documento|numero de documento|documento/.test(normalized)) errors['documento:CI'] = 'Este número de documento ya está registrado.';
    if (Object.keys(errors).length) setFieldErrors(errors);
    return { message, handled: Object.keys(errors).length > 0 };
  };

  // Autogenerar username al cambiar datos del estudiante si es nuevo
  const handleAutoFillStudentUsername = (
    nombre: string,
    paterno: string,
    materno: string,
    ci: string,
  ) => {
    if (!editingStudent) {
      const generated = generateUsername(nombre, paterno, materno, ci);
      if (generated) {
        setStudentForm((f) => ({
          ...f,
          username: f.username && f.username !== generated ? f.username : generated,
          email: f.email && !f.email.includes('@shalom.edu.bo') ? f.email : generateStudentEmail(generated),
        }));
      }
    }
  };

  const handleSaveTutor = async () => {
    if (!tutorForm.nombre || !tutorForm.apellidoPaterno || !tutorForm.apellidoMaterno || !tutorForm.nacimiento) {
      Alert.alert('Datos incompletos', 'Complete los datos obligatorios del Tutor (Nombre, Apellidos, Nacimiento).');
      return;
    }
    const ciDoc = tutorDocs.find((d) => d.tipoDoc === 'CI');
    if (!ciDoc?.numeroDoc) {
      Alert.alert('Documento requerido', 'El Carnet de Identidad (CI) es obligatorio para el tutor.');
      return;
    }
    if (!tutorPhoto) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil del tutor (PNG/JPG).');
      return;
    }

    setSaving(true);
    try {
      const payload: CreateUsuarioPayload = {
        rolId: '5',
        nombre: tutorForm.nombre,
        apellidoPaterno: tutorForm.apellidoPaterno,
        apellidoMaterno: tutorForm.apellidoMaterno,
        nacimiento: tutorForm.nacimiento,
        genero: tutorForm.genero,
        documentos: tutorDocs,
        contactos: tutorForm.celular ? [{ tipo: 'Celular', contenido: tutorForm.celular }] : [],
        direccion: tutorForm.zona
          ? {
              zona: tutorForm.zona,
              distrito: tutorForm.distrito || undefined,
              calle: tutorForm.calle || undefined,
              numero: tutorForm.numero || undefined,
              referencia: tutorForm.referencia || undefined,
            }
          : undefined,
      };

      const res = await usuariosApi.createWithFiles(payload, tutorPhoto);
      setCreatedTutorId(res.id);
      setTutorSummary(`${tutorForm.nombre} ${tutorForm.apellidoPaterno} (CI: ${ciDoc.numeroDoc})`);

      setStudentForm((prev) => ({
        ...prev,
        apellidoPaterno: prev.apellidoPaterno || tutorForm.apellidoPaterno,
        zona: tutorForm.zona,
        distrito: tutorForm.distrito,
        calle: tutorForm.calle,
        numero: tutorForm.numero,
        referencia: tutorForm.referencia,
      }));

      setStep(2);
    } catch (err) {
      const result = applyServerFieldErrors(err, 'tutor');
      if (!result.handled) Alert.alert('Error al registrar tutor', result.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStudent = async () => {
    if (!validateStudent()) return;
    const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI');
    const rudeDoc = studentDocs.find((d) => d.tipoDoc === 'RUDE');
    if (!editingStudent && !studentPhoto) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil del estudiante (PNG/JPG).');
      return;
    }

    const hasCiFile = Boolean(ciDoc?.fileUri || ciDoc?.docUrl);
    if (!hasCiFile) {
      Alert.alert(
        '⚠️ Archivo Crítico CI Faltante',
        'No se ha adjuntado el archivo digital en PDF para la Cédula de Identidad (CI).\n\nEste documento es de archivo crítico para la institución. ¿Desea guardarlo sin archivo digital o prefiere adjuntarlo ahora?',
        [
          { text: 'Adjuntar ahora', style: 'cancel' },
          { text: 'Guardar sin archivo', style: 'destructive', onPress: () => executeSaveStudent() },
        ],
      );
      return;
    }

    await executeSaveStudent();
  };

  const executeSaveStudent = async () => {
    setSaving(true);
    try {
      if (editingStudent) {
        const updatePayload: UpdateUsuarioPayload = {
          nombre: studentForm.nombre,
          apellidoPaterno: studentForm.apellidoPaterno,
          apellidoMaterno: studentForm.apellidoMaterno,
          nacimiento: studentForm.nacimiento,
          genero: studentForm.genero,
          documentos: studentDocs,
          direccion: studentForm.zona
            ? {
                zona: studentForm.zona,
                distrito: studentForm.distrito || undefined,
                calle: studentForm.calle || undefined,
                numero: studentForm.numero || undefined,
                referencia: studentForm.referencia || undefined,
              }
            : undefined,
          cuenta:
            studentForm.username && studentForm.email
              ? {
                  username: studentForm.username,
                  email: studentForm.email,
                  password: studentForm.password || undefined,
                }
              : undefined,
        };

        await usuariosApi.updateWithFiles(editingStudent.id, updatePayload, studentPhoto);
        Alert.alert('Éxito', 'Información del estudiante actualizada correctamente.');
      } else {
        const createPayload: CreateUsuarioPayload = {
          rolId: '3',
          nombre: studentForm.nombre,
          apellidoPaterno: studentForm.apellidoPaterno,
          apellidoMaterno: studentForm.apellidoMaterno,
          nacimiento: studentForm.nacimiento,
          genero: studentForm.genero,
          cuenta: {
            username: studentForm.username,
            email: studentForm.email,
            password: studentForm.password,
          },
          documentos: studentDocs,
          direccion: studentForm.zona
            ? {
                zona: studentForm.zona,
                distrito: studentForm.distrito || undefined,
                calle: studentForm.calle || undefined,
                numero: studentForm.numero || undefined,
                referencia: studentForm.referencia || undefined,
              }
            : undefined,
          apoderadoId: createdTutorId || undefined,
          parentesco: tutorForm.parentesco,
        };

        await usuariosApi.createWithFiles(createPayload, studentPhoto);
        Alert.alert('Éxito', 'Estudiante registrado y vinculado correctamente al Tutor.');
      }

      setShowModal(false);
      resetForms();
      refresh();
    } catch (err) {
      const result = applyServerFieldErrors(err, 'student');
      if (!result.handled) Alert.alert('Error', result.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (u: Usuario) => {
    try {
      // La lista contiene un resumen; se cargan ambas fichas completas antes de editar.
      const student = await usuariosApi.getById(u.id);
      setEditingStudent(student);
      const docs = student.documentos ?? [];
      const nac = student.nacimiento ? String(student.nacimiento).slice(0, 10) : '';

      setStudentForm({
      nombre: student.nombre ?? '',
      apellidoPaterno: student.apellidoPaterno || (student as any).apellido_paterno || '',
      apellidoMaterno: student.apellidoMaterno || (student as any).apellido_materno || '',
      nacimiento: nac,
      genero: (student.genero as any) ?? 'masculino',
      username: student.username ?? (student as any).cuenta?.username ?? '',
      email: student.email ?? (student as any).cuenta?.email ?? '',
      password: '',
      zona: student.direccion?.zona ?? '',
      distrito: student.direccion?.distrito ?? '',
      calle: student.direccion?.calle ?? '',
      numero: student.direccion?.numero ?? '',
      referencia: student.direccion?.referencia ?? '',
    });

    const mappedDocs: UsuarioDoc[] = docs.map((d) => ({
      id: d.id,
      tipoDoc: d.tipoDoc || (d as any).tipo_doc,
      numeroDoc: d.numeroDoc || (d as any).numero_doc,
      docUrl: d.docUrl,
      fileUri: undefined,
      fileName: undefined,
    }));
    if (!mappedDocs.some((d) => d.tipoDoc === 'CI')) {
      mappedDocs.unshift({ tipoDoc: 'CI', numeroDoc: '' });
    }
    if (!mappedDocs.some((d) => d.tipoDoc === 'RUDE')) {
      mappedDocs.push({ tipoDoc: 'RUDE', numeroDoc: '' });
    }
    setStudentDocs(mappedDocs);
      setStudentPhoto(student.fotoUrl ?? undefined);

      const tutorLink = student.apoderados?.[0];
      if (tutorLink) {
        const tutor = await usuariosApi.getById(tutorLink.apoderadoId);
        const tutorCi = tutor.documentos?.map((doc) => ({ ...doc, fileUri: undefined, fileName: undefined })) ?? [];
        setEditingTutorId(tutor.id);
        setTutorForm({
          nombre: tutor.nombre ?? '', apellidoPaterno: tutor.apellidoPaterno ?? '', apellidoMaterno: tutor.apellidoMaterno ?? '',
          nacimiento: tutor.nacimiento ? String(tutor.nacimiento).slice(0, 10) : '', genero: (tutor.genero as any) ?? 'masculino',
          ci: tutorCi.find((doc) => doc.tipoDoc === 'CI')?.numeroDoc ?? '',
          celular: tutor.contactos?.find((contacto) => contacto.tipo === 'Celular')?.contenido ?? '',
          email: tutor.cuenta?.email ?? tutor.email ?? '', zona: tutor.direccion?.zona ?? '', distrito: tutor.direccion?.distrito ?? '',
          calle: tutor.direccion?.calle ?? '', numero: tutor.direccion?.numero ?? '', referencia: tutor.direccion?.referencia ?? '',
          parentesco: tutorLink.parentesco ?? 'Tutor',
        });
        setTutorDocs(tutorCi);
        setTutorPhoto(tutor.fotoUrl ?? undefined);
        setTutorSummary(`${tutor.nombre} ${tutor.apellidoPaterno} (${tutorLink.parentesco})`);
      } else {
        setEditingTutorId(null);
        setTutorSummary(null);
      }

      setStep(2);
      setEditTab('student');
      setShowModal(true);
    } catch (err) {
      Alert.alert('Error al cargar', err instanceof Error ? err.message : 'No se pudo cargar la ficha del estudiante.');
    }
  };

  const handleUpdateTutor = async () => {
    if (!editingTutorId) return;
    if (!tutorForm.nombre || !tutorForm.apellidoPaterno || !tutorForm.apellidoMaterno || !tutorForm.nacimiento) {
      Alert.alert('Datos incompletos', 'Complete los datos obligatorios del tutor.');
      return;
    }
    setSaving(true);
    try {
      await usuariosApi.updateWithFiles(editingTutorId, {
        nombre: tutorForm.nombre,
        apellidoPaterno: tutorForm.apellidoPaterno,
        apellidoMaterno: tutorForm.apellidoMaterno,
        nacimiento: tutorForm.nacimiento,
        genero: tutorForm.genero,
        cuenta: tutorForm.email ? { email: tutorForm.email } : undefined,
        documentos: tutorDocs,
        contactos: tutorForm.celular ? [{ tipo: 'Celular', contenido: tutorForm.celular }] : [],
        direccion: tutorForm.zona ? {
          zona: tutorForm.zona, distrito: tutorForm.distrito || undefined, calle: tutorForm.calle || undefined,
          numero: tutorForm.numero || undefined, referencia: tutorForm.referencia || undefined,
        } : undefined,
      }, tutorPhoto);
      Alert.alert('Éxito', 'Datos del tutor actualizados correctamente.');
      refresh();
    } catch (err) {
      const result = applyServerFieldErrors(err, 'tutor');
      if (!result.handled) Alert.alert('Error', result.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleState = (u: Usuario) => {
    if (u.estado === 1) {
      setBajaTarget(u);
      return;
    }
    Alert.alert(
      'Reactivar estudiante',
      `¿Está seguro de reactivar a ${u.nombre} ${u.apellidoPaterno || ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reactivar',
          onPress: async () => {
            try {
              await usuariosApi.update(u.id, { estado: 1 });
              refresh();
            } catch {
              Alert.alert('Error', 'No se pudo modificar el estado del usuario');
            }
          },
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
      Alert.alert('Error', 'No se pudo dar de baja al usuario');
    } finally {
      setBajaLoading(false);
    }
  };

  const estudiantesList = (data?.data ?? []).filter((u) => {
    const r = (u.rol || '').toLowerCase();
    return r === 'estudiante' || String(u.rolId) === '3';
  });

  const habilitados = useMemo(
    () => estudiantesList.filter((u) => u.estado === 1),
    [estudiantesList]
  );
  const deshabilitados = useMemo(
    () => estudiantesList.filter((u) => u.estado === 0),
    [estudiantesList]
  );

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-12" showsVerticalScrollIndicator={false}>
      {/* Cabecera Bento */}
      <BentoCard className="p-5 bg-card border-l-4 border-maroon">
        <View className="flex-row items-center justify-between mb-4 flex-wrap gap-3">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-9 h-9 rounded-xl bg-maroon/15 items-center justify-center">
                <Ionicons name="people-outline" size={20} color="#7A1F3D" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Personal Estudiantil</Text>
            </View>
            <Text className="text-gray-500 text-xs">
              Gestión y registro de estudiantes con tutores vinculados, fotos MinIO y diseño Bento Grid.
            </Text>
          </View>

          {canEdit && (
            <TouchableOpacity
              onPress={() => {
                resetForms();
                setShowModal(true);
              }}
              className="bg-maroon rounded-xl px-4 py-2.5 flex-row items-center gap-2 shadow"
            >
              <Ionicons name="person-add" color="#FFF" size={18} />
              <Text className="text-white font-bold text-xs">Registrar Estudiante</Text>
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
              placeholder="Buscar por nombre, CI, RUDE o usuario..."
              className="flex-1 ml-2 text-gray-800 text-sm"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity onPress={refresh} className="bg-maroon/10 rounded-xl px-4 justify-center items-center">
            <Ionicons name="refresh" size={18} color="#7A1F3D" />
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* Modal / Formulario en Bento Grid */}
      {showModal && (
        <BentoCard className="p-6 border border-gold/40 bg-white shadow-md">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <View>
              <Text className="text-xl font-bold text-maroon">
                {editingStudent ? 'Editar Estudiante' : 'Registro de Estudiante y Tutor'}
              </Text>
              <Text className="text-xs text-gray-500">
                {editingStudent
                  ? (editTab === 'student' ? 'Datos del estudiante y documentación' : 'Datos completos del tutor o apoderado')
                  : (step === 1 ? 'Paso 1 de 2: Registrar Tutor Apoderado' : 'Paso 2 de 2: Datos del Estudiante y Documentación')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowModal(false);
                resetForms();
              }}
              className="p-1"
            >
              <Ionicons name="close-circle" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {!editingStudent && (
            <View className="flex-row items-center justify-center gap-4 mb-5">
              <TouchableOpacity
                onPress={() => setStep(1)}
                className={`flex-row items-center px-4 py-2 rounded-xl gap-2 ${step === 1 ? 'bg-maroon' : 'bg-gray-100'}`}
              >
                <Text className={`font-bold text-xs ${step === 1 ? 'text-white' : 'text-gray-600'}`}>1. Tutor Apoderado</Text>
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              <TouchableOpacity
                onPress={() => createdTutorId && setStep(2)}
                className={`flex-row items-center px-4 py-2 rounded-xl gap-2 ${step === 2 ? 'bg-maroon' : 'bg-gray-100'}`}
              >
                <Text className={`font-bold text-xs ${step === 2 ? 'text-white' : 'text-gray-600'}`}>2. Estudiante</Text>
              </TouchableOpacity>
            </View>
          )}

          {editingStudent && (
            <View className="flex-row items-center gap-2 mb-5 p-1.5 rounded-xl bg-gray-100 self-start">
              <TouchableOpacity
                onPress={() => setEditTab('student')}
                className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${editTab === 'student' ? 'bg-maroon' : ''}`}
              >
                <Ionicons name="school-outline" size={16} color={editTab === 'student' ? '#FFF' : '#4B5563'} />
                <Text className={`text-xs font-bold ${editTab === 'student' ? 'text-white' : 'text-gray-600'}`}>Datos del estudiante</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => editingTutorId && setEditTab('tutor')}
                disabled={!editingTutorId}
                className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${editTab === 'tutor' ? 'bg-maroon' : ''} ${!editingTutorId ? 'opacity-50' : ''}`}
              >
                <Ionicons name="people-outline" size={16} color={editTab === 'tutor' ? '#FFF' : '#4B5563'} />
                <Text className={`text-xs font-bold ${editTab === 'tutor' ? 'text-white' : 'text-gray-600'}`}>Datos del tutor</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 1 && !editingStudent && (
            <View className="gap-4">
              <BentoCard className="p-4 bg-cream/40 border border-gold/30">
                <Text className="text-xs font-bold text-maroon mb-2 uppercase">Fotografía del Tutor (MinIO)</Text>
                <ProfilePhotoPicker photoUri={tutorPhoto} onChange={setTutorPhoto} required={true} />
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Datos del Tutor o Apoderado</Text>
                <View className="flex-row flex-wrap gap-2">
                  <TextInput
                    value={tutorForm.nombre}
                    onChangeText={(v) => setTutorForm((f) => ({ ...f, nombre: v }))}
                    placeholder="Nombre del Tutor *"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={tutorForm.apellidoPaterno}
                    onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoPaterno: v }))}
                    placeholder="Apellido Paterno *"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={tutorForm.apellidoMaterno}
                    onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoMaterno: v }))}
                    placeholder="Apellido Materno *"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                  />
                  <BirthDatePicker value={tutorForm.nacimiento} onChange={(v) => setTutorForm((f) => ({ ...f, nacimiento: v }))} />
                </View>
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <DocumentInput
                  documents={tutorDocs}
                  onChange={setTutorDocs}
                  requiredTypes={TUTOR_REQUIRED_DOCS}
                  title="Documentos del Tutor (CI Obligatorio)"
                  showRequiredBadge={true}
                  fieldErrors={fieldErrors}
                />
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Contacto y Domicilio</Text>
                <View className="flex-row flex-wrap gap-2">
                  <TextInput
                    value={tutorForm.celular}
                    onChangeText={(v) => setTutorForm((f) => ({ ...f, celular: v }))}
                    placeholder="Celular *"
                    keyboardType="phone-pad"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={tutorForm.zona}
                    onChangeText={(v) => setTutorForm((f) => ({ ...f, zona: v }))}
                    placeholder="Zona *"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={tutorForm.calle}
                    onChangeText={(v) => setTutorForm((f) => ({ ...f, calle: v }))}
                    placeholder="Calle y Número"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                  />
                </View>
              </BentoCard>

              <TouchableOpacity
                onPress={handleSaveTutor}
                disabled={saving}
                className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-sm">Guardar Tutor y Continuar</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {editingStudent && editTab === 'tutor' && (
            <View className="gap-4">
              <BentoCard className="p-4 bg-cream/40 border border-gold/30">
                <Text className="text-xs font-bold text-maroon mb-2 uppercase">Fotografía del Tutor (MinIO)</Text>
                <ProfilePhotoPicker photoUri={tutorPhoto} onChange={setTutorPhoto} required={false} />
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Datos personales del tutor o apoderado</Text>
                <View className="flex-row flex-wrap gap-2">
                  <TextInput value={tutorForm.nombre} onChangeText={(v) => setTutorForm((f) => ({ ...f, nombre: v }))} placeholder="Nombre *" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm" />
                  <TextInput value={tutorForm.apellidoPaterno} onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoPaterno: v }))} placeholder="Apellido paterno *" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm" />
                  <TextInput value={tutorForm.apellidoMaterno} onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoMaterno: v }))} placeholder="Apellido materno *" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm" />
                  <BirthDatePicker value={tutorForm.nacimiento} onChange={(v) => setTutorForm((f) => ({ ...f, nacimiento: v }))} />
                </View>
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <DocumentInput documents={tutorDocs} onChange={setTutorDocs} requiredTypes={TUTOR_REQUIRED_DOCS} title="Documentos del Tutor (CI obligatorio)" showRequiredBadge fieldErrors={fieldErrors} />
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Contacto y domicilio del tutor</Text>
                <View className="flex-row flex-wrap gap-2">
                  <InlineInput value={tutorForm.email} onChangeText={(v) => { clearFieldError('tutorEmail'); setTutorForm((f) => ({ ...f, email: v })); }} placeholder="Correo electrónico" keyboardType="email-address" error={fieldErrors.tutorEmail} />
                  <TextInput value={tutorForm.celular} onChangeText={(v) => setTutorForm((f) => ({ ...f, celular: v }))} placeholder="Celular" keyboardType="phone-pad" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm" />
                  <TextInput value={tutorForm.zona} onChangeText={(v) => setTutorForm((f) => ({ ...f, zona: v }))} placeholder="Zona" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm" />
                  <TextInput value={tutorForm.distrito} onChangeText={(v) => setTutorForm((f) => ({ ...f, distrito: v }))} placeholder="Distrito" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm" />
                  <TextInput value={tutorForm.calle} onChangeText={(v) => setTutorForm((f) => ({ ...f, calle: v }))} placeholder="Calle" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm" />
                  <TextInput value={tutorForm.numero} onChangeText={(v) => setTutorForm((f) => ({ ...f, numero: v }))} placeholder="Número" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm" />
                  <TextInput value={tutorForm.referencia} onChangeText={(v) => setTutorForm((f) => ({ ...f, referencia: v }))} placeholder="Referencia" className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm" />
                </View>
              </BentoCard>

              <TouchableOpacity onPress={handleUpdateTutor} disabled={saving} className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow">
                {saving ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="save-outline" size={18} color="#FFF" /><Text className="text-white font-bold text-sm">Guardar datos del tutor</Text></>}
              </TouchableOpacity>
            </View>
          )}

          {(step === 2 || editingStudent) && (!editingStudent || editTab === 'student') && (
            <View className="gap-4">
              {tutorSummary && (
                <View className="bg-gold/15 border border-gold/40 rounded-xl p-3 flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs font-bold text-maroon">Tutor Vinculado:</Text>
                    <Text className="text-xs text-gray-800">{tutorSummary}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color="#7A1F3D" />
                </View>
              )}

              <BentoCard className="p-4 bg-cream/40 border border-gold/30">
                <Text className="text-xs font-bold text-maroon mb-2 uppercase">Fotografía del Estudiante (MinIO)</Text>
                <ProfilePhotoPicker photoUri={studentPhoto} onChange={setStudentPhoto} required={!editingStudent} />
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Datos Personales del Estudiante</Text>
                <View className="flex-row flex-wrap gap-2">
                  <InlineInput
                    value={studentForm.nombre}
                    onChangeText={(v) => {
                      clearFieldError('studentNombre');
                      setStudentForm((f) => ({ ...f, nombre: v }));
                      const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                      handleAutoFillStudentUsername(v, studentForm.apellidoPaterno, studentForm.apellidoMaterno, ciDoc);
                    }}
                    placeholder="Nombre *"
                    error={fieldErrors.studentNombre}
                  />
                  <InlineInput
                    value={studentForm.apellidoPaterno}
                    onChangeText={(v) => {
                      clearFieldError('studentApellidoPaterno');
                      setStudentForm((f) => ({ ...f, apellidoPaterno: v }));
                      const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                      handleAutoFillStudentUsername(studentForm.nombre, v, studentForm.apellidoMaterno, ciDoc);
                    }}
                    placeholder="Apellido Paterno *"
                    error={fieldErrors.studentApellidoPaterno}
                  />
                  <InlineInput
                    value={studentForm.apellidoMaterno}
                    onChangeText={(v) => {
                      clearFieldError('studentApellidoMaterno');
                      setStudentForm((f) => ({ ...f, apellidoMaterno: v }));
                      const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                      handleAutoFillStudentUsername(studentForm.nombre, studentForm.apellidoPaterno, v, ciDoc);
                    }}
                    placeholder="Apellido Materno *"
                    error={fieldErrors.studentApellidoMaterno}
                  />
                  <BirthDatePicker value={studentForm.nacimiento} onChange={(v) => setStudentForm((f) => ({ ...f, nacimiento: v }))} />
                </View>
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <DocumentInput
                  documents={studentDocs}
                  onChange={(docs) => {
                    setStudentDocs(docs);
                    const ciDoc = docs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                    handleAutoFillStudentUsername(studentForm.nombre, studentForm.apellidoPaterno, studentForm.apellidoMaterno, ciDoc);
                  }}
                  requiredTypes={STUDENT_REQUIRED_DOCS}
                  title="Documentos del Estudiante (CI y RUDE en PDF)"
                  showRequiredBadge={true}
                  fieldErrors={fieldErrors}
                />
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Cuenta Institucional del Estudiante</Text>
                <View className="flex-row flex-wrap gap-2">
                  <InlineInput
                    value={studentForm.username}
                    onChangeText={(v) => { clearFieldError('studentUsername'); setStudentForm((f) => ({ ...f, username: v })); }}
                    placeholder="Nombre de Usuario *"
                    autoCapitalize="none"
                    error={fieldErrors.studentUsername}
                  />
                  <InlineInput
                    value={studentForm.email}
                    onChangeText={(v) => { clearFieldError('studentEmail'); setStudentForm((f) => ({ ...f, email: v })); }}
                    placeholder="Correo institucional *"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    error={fieldErrors.studentEmail}
                  />
                  <InlineInput
                    value={studentForm.password}
                    onChangeText={(v) => { clearFieldError('studentPassword'); setStudentForm((f) => ({ ...f, password: v })); }}
                    placeholder={editingStudent ? 'Nueva Contraseña (Opcional)' : 'Contraseña (Mín. 8 caract.) *'}
                    secureTextEntry
                    error={fieldErrors.studentPassword}
                  />
                </View>
              </BentoCard>

              <TouchableOpacity
                onPress={handleSaveStudent}
                disabled={saving}
                className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                    <Text className="text-white font-bold text-sm">
                      {editingStudent ? 'Guardar Cambios' : 'Finalizar Registro de Estudiante'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </BentoCard>
      )}

      {/* Separación de listados para no mezclar estudiantes con estados distintos. */}
      <View className="flex-row items-center gap-2 p-1.5 rounded-xl bg-gray-100 self-start">
        <TouchableOpacity
          onPress={() => setStudentsListTab('enabled')}
          className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${studentsListTab === 'enabled' ? 'bg-maroon' : ''}`}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={studentsListTab === 'enabled' ? '#FFF' : '#4B5563'} />
          <Text className={`text-xs font-bold ${studentsListTab === 'enabled' ? 'text-white' : 'text-gray-600'}`}>Habilitados ({habilitados.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setStudentsListTab('disabled')}
          className={`px-4 py-2 rounded-lg flex-row items-center gap-2 ${studentsListTab === 'disabled' ? 'bg-maroon' : ''}`}
        >
          <Ionicons name="close-circle-outline" size={16} color={studentsListTab === 'disabled' ? '#FFF' : '#4B5563'} />
          <Text className={`text-xs font-bold ${studentsListTab === 'disabled' ? 'text-white' : 'text-gray-600'}`}>Deshabilitados ({deshabilitados.length})</Text>
        </TouchableOpacity>
      </View>

      {/* GRID DE CARTAS BENTO PARA ESTUDIANTES - HABILITADOS */}
      {studentsListTab === 'enabled' && <BentoCard className="p-5 bg-white">
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
          <View className="flex-row flex-wrap gap-4">
            {habilitados.map((st) => {
              const docs = st.documentos ?? [];
              const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ??
                (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
              const rudeDoc = docs.find((d) => d.tipoDoc === 'RUDE' || (d as any).tipo_doc === 'RUDE')?.numeroDoc ??
                (docs.find((d) => (d as any).tipo_doc === 'RUDE') as any)?.numero_doc;
              const apPat = st.apellidoPaterno || (st as any).apellido_paterno || '';
              const apMat = st.apellidoMaterno || (st as any).apellido_materno || '';
              const stFullName = getFullName(st.nombre, apPat, apMat);

              return (
                <BentoCard
                  key={st.id}
                  className="w-full md:w-[48%] lg:w-[31.5%] p-5 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between"
                >
                  {/* Cabecera con Foto MinIO y estado */}
                  <View>
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="relative">
                        {st.fotoUrl ? (
                          <RemoteImage
                            uri={st.fotoUrl}
                            className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-maroon/20"
                            fallbackText={`${st.nombre?.charAt(0) || 'E'}${apPat?.charAt(0) || ''}`}
                          />
                        ) : (
                          <View className="w-16 h-16 rounded-2xl bg-maroon/10 border-2 border-maroon/20 items-center justify-center">
                            <Text className="text-maroon font-bold text-xl">
                              {st.nombre?.charAt(0) || 'E'}{apPat?.charAt(0) || ''}
                            </Text>
                          </View>
                        )}
                      </View>

                      <StatusBadge status={st.estado} />
                    </View>

                    {/* Datos del estudiante */}
                    <Text className="font-bold text-gray-900 text-base" numberOfLines={2}>
                      {stFullName}
                    </Text>
                    <Text className="text-xs font-mono text-maroon mt-0.5">
                      @{st.username || 'sin-cuenta'}
                    </Text>

                    {/* Píldoras Bento de CI y RUDE */}
                    <View className="flex-row flex-wrap gap-1.5 mt-3">
                      <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                        <Text className="text-xs text-gray-700 font-mono">CI: {ciDoc}</Text>
                      </View>
                      {rudeDoc && (
                        <View className="bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/40">
                          <Text className="text-xs font-bold text-maroon font-mono">RUDE: {rudeDoc}</Text>
                        </View>
                      )}
                    </View>

                    {/* Contacto / Email */}
                    <View className="mt-3 pt-3 border-t border-gray-100 gap-1">
                      {st.email ? (
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="mail-outline" size={13} color="#9CA3AF" />
                          <Text className="text-xs text-gray-500" numberOfLines={1}>
                            {st.email}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Acciones Bento */}
                  <View className="flex-row items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                    {canEdit ? (
                      <>
                        <TouchableOpacity
                          onPress={() => handleEdit(st)}
                          className="p-2 bg-gray-100 hover:bg-maroon/10 rounded-xl flex-row items-center gap-1.5"
                        >
                          <Ionicons name="create-outline" size={16} color="#7A1F3D" />
                          <Text className="text-xs font-bold text-maroon">Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleToggleState(st)}
                          className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                        >
                          <Ionicons
                            name={st.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                            size={16}
                            color={st.estado === 1 ? '#DC2626' : '#16A34A'}
                          />
                          <Text
                            className={`text-xs font-semibold ${
                              st.estado === 1 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {st.estado === 1 ? 'Baja' : 'Activar'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setSelectedStudentDetail(st)}
                        className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                      >
                        <Ionicons name="eye-outline" size={16} color="#7A1F3D" />
                        <Text className="text-xs font-bold text-maroon">Ver Ficha</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </BentoCard>
              );
            })}
          </View>
        ) : (
          <View className="items-center justify-center py-12 px-4">
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 text-center mt-4 text-sm">No hay estudiantes habilitados.</Text>
          </View>
        )}
      </BentoCard>}

      {/* GRID DE CARTAS BENTO PARA ESTUDIANTES - DESHABILITADOS */}
      {studentsListTab === 'disabled' && <BentoCard className="p-5 bg-white">
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
          <View className="flex-row flex-wrap gap-4">
            {deshabilitados.map((st) => {
              const docs = st.documentos ?? [];
              const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ??
                (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
              const rudeDoc = docs.find((d) => d.tipoDoc === 'RUDE' || (d as any).tipo_doc === 'RUDE')?.numeroDoc ??
                (docs.find((d) => (d as any).tipo_doc === 'RUDE') as any)?.numero_doc;
              const apPat = st.apellidoPaterno || (st as any).apellido_paterno || '';
              const apMat = st.apellidoMaterno || (st as any).apellido_materno || '';
              const stFullName = getFullName(st.nombre, apPat, apMat);

              return (
                <BentoCard
                  key={st.id}
                  className="w-full md:w-[48%] lg:w-[31.5%] p-5 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between"
                >
                  {/* Cabecera con Foto MinIO y estado */}
                  <View>
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="relative">
                        {st.fotoUrl ? (
                          <RemoteImage
                            uri={st.fotoUrl}
                            className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-maroon/20"
                            fallbackText={`${st.nombre?.charAt(0) || 'E'}${apPat?.charAt(0) || ''}`}
                          />
                        ) : (
                          <View className="w-16 h-16 rounded-2xl bg-maroon/10 border-2 border-maroon/20 items-center justify-center">
                            <Text className="text-maroon font-bold text-xl">
                              {st.nombre?.charAt(0) || 'E'}{apPat?.charAt(0) || ''}
                            </Text>
                          </View>
                        )}
                      </View>

                      <StatusBadge status={st.estado} />
                    </View>

                    {/* Datos del estudiante */}
                    <Text className="font-bold text-gray-900 text-base" numberOfLines={2}>
                      {stFullName}
                    </Text>
                    <Text className="text-xs font-mono text-maroon mt-0.5">
                      @{st.username || 'sin-cuenta'}
                    </Text>

                    {/* Píldoras Bento de CI y RUDE */}
                    <View className="flex-row flex-wrap gap-1.5 mt-3">
                      <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                        <Text className="text-xs text-gray-700 font-mono">CI: {ciDoc}</Text>
                      </View>
                      {rudeDoc && (
                        <View className="bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/40">
                          <Text className="text-xs font-bold text-maroon font-mono">RUDE: {rudeDoc}</Text>
                        </View>
                      )}
                    </View>

                    {/* Contacto / Email */}
                    <View className="mt-3 pt-3 border-t border-gray-100 gap-1">
                      {st.email ? (
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="mail-outline" size={13} color="#9CA3AF" />
                          <Text className="text-xs text-gray-500" numberOfLines={1}>
                            {st.email}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Acciones Bento */}
                  <View className="flex-row items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                    {canEdit ? (
                      <>
                        <TouchableOpacity
                          onPress={() => handleEdit(st)}
                          className="p-2 bg-gray-100 hover:bg-maroon/10 rounded-xl flex-row items-center gap-1.5"
                        >
                          <Ionicons name="create-outline" size={16} color="#7A1F3D" />
                          <Text className="text-xs font-bold text-maroon">Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => handleToggleState(st)}
                          className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                        >
                          <Ionicons
                            name={st.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                            size={16}
                            color={st.estado === 1 ? '#DC2626' : '#16A34A'}
                          />
                          <Text
                            className={`text-xs font-semibold ${
                              st.estado === 1 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {st.estado === 1 ? 'Baja' : 'Activar'}
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setSelectedStudentDetail(st)}
                        className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                      >
                        <Ionicons name="eye-outline" size={16} color="#7A1F3D" />
                        <Text className="text-xs font-bold text-maroon">Ver Ficha</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </BentoCard>
              );
            })}
          </View>
        ) : (
          <View className="items-center justify-center py-12 px-4">
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text className="text-gray-500 text-center mt-4 text-sm">No hay estudiantes deshabilitados.</Text>
          </View>
        )}
      </BentoCard>}

      {/* Ficha rápida de consulta para roles sin permisos de edición */}
      {selectedStudentDetail && (
        <BentoCard className="p-5 bg-white border border-maroon/30 shadow-md">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-maroon">Ficha de Consulta de Estudiante</Text>
            <TouchableOpacity onPress={() => setSelectedStudentDetail(null)}>
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <Text className="font-bold text-gray-800">
            {getFullName(
              selectedStudentDetail.nombre,
              selectedStudentDetail.apellidoPaterno || (selectedStudentDetail as any).apellido_paterno,
              selectedStudentDetail.apellidoMaterno || (selectedStudentDetail as any).apellido_materno,
            )}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">Usuario: @{selectedStudentDetail.username}</Text>
          <Text className="text-xs text-gray-600">Correo: {selectedStudentDetail.email || 'N/A'}</Text>
          <Text className="text-xs text-gray-600 mt-1 font-bold">Documentos:</Text>
          {(selectedStudentDetail.documentos ?? []).map((d, i) => (
            <Text key={i} className="text-xs text-gray-500 ml-2">
              • {d.tipoDoc || (d as any).tipo_doc}: {d.numeroDoc || (d as any).numero_doc}
            </Text>
          ))}
        </BentoCard>
      )}
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
