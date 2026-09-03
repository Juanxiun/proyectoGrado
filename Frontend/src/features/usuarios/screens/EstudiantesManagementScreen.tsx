import { useEffect, useState } from 'react';
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
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
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
  const [editingStudent, setEditingStudent] = useState<Usuario | null>(null);

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

  const refresh = () => {
    fetchList({ buscar: search, estado: statusFilter, limit: 100 }).catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    return connectUsersWebSocket(refresh);
  }, [search, statusFilter]);

  const resetForms = () => {
    setStep(1);
    setEditingStudent(null);
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
        direccion: tutorForm.zona ? {
          zona: tutorForm.zona,
          distrito: tutorForm.distrito || undefined,
          calle: tutorForm.calle || undefined,
          numero: tutorForm.numero || undefined,
          referencia: tutorForm.referencia || undefined,
        } : undefined,
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
      Alert.alert('Error al registrar tutor', err instanceof Error ? err.message : 'No se pudo guardar el tutor');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStudent = async () => {
    if (!studentForm.nombre || !studentForm.apellidoPaterno || !studentForm.apellidoMaterno || !studentForm.nacimiento) {
      Alert.alert('Datos incompletos', 'Complete los datos personales obligatorios del estudiante.');
      return;
    }
    const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI');
    const rudeDoc = studentDocs.find((d) => d.tipoDoc === 'RUDE');
    if (!ciDoc?.numeroDoc || !rudeDoc?.numeroDoc) {
      Alert.alert('Documentos requeridos', 'El CI y el RUDE son obligatorios según la normativa de regulación escolar de Bolivia.');
      return;
    }
    if (!editingStudent && (!studentForm.username || !studentForm.email || !studentForm.password)) {
      Alert.alert('Cuenta de acceso', 'Ingrese las credenciales de acceso para la cuenta del estudiante.');
      return;
    }
    if (!editingStudent && !studentPhoto) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil del estudiante (PNG/JPG).');
      return;
    }

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
          direccion: studentForm.zona ? {
            zona: studentForm.zona,
            distrito: studentForm.distrito || undefined,
            calle: studentForm.calle || undefined,
            numero: studentForm.numero || undefined,
            referencia: studentForm.referencia || undefined,
          } : undefined,
          cuenta: studentForm.username && studentForm.email ? {
            username: studentForm.username,
            email: studentForm.email,
            password: studentForm.password || undefined,
          } : undefined,
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
          direccion: studentForm.zona ? {
            zona: studentForm.zona,
            distrito: studentForm.distrito || undefined,
            calle: studentForm.calle || undefined,
            numero: studentForm.numero || undefined,
            referencia: studentForm.referencia || undefined,
          } : undefined,
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
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el estudiante');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u: Usuario) => {
    setEditingStudent(u);
    const docs = u.documentos ?? [];
    setStudentForm({
      nombre: u.nombre ?? '',
      apellidoPaterno: u.apellidoPaterno || (u as any).apellido_paterno || '',
      apellidoMaterno: u.apellidoMaterno || (u as any).apellido_materno || '',
      nacimiento: u.nacimiento ? String(u.nacimiento).split('T')[0] : '',
      genero: (u.genero as any) ?? 'masculino',
      username: u.username ?? '',
      email: u.email ?? '',
      password: '',
      zona: u.direccion?.zona ?? '',
      distrito: u.direccion?.distrito ?? '',
      calle: u.direccion?.calle ?? '',
      numero: u.direccion?.numero ?? '',
      referencia: u.direccion?.referencia ?? '',
    });

    const mappedDocs: UsuarioDoc[] = docs.map((d) => ({
      id: d.id,
      tipoDoc: d.tipoDoc || (d as any).tipo_doc,
      numeroDoc: d.numeroDoc || (d as any).numero_doc,
      docUrl: d.docUrl,
      fileUri: undefined,
      fileName: undefined,
    }));
    setStudentDocs(mappedDocs.length > 0 ? mappedDocs : [
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'RUDE', numeroDoc: '' },
    ]);
    setStudentPhoto(u.fotoUrl ?? undefined);

    setStep(2);
    setShowModal(true);
  };

  const handleToggleState = (u: Usuario) => {
    const nuevoEstado = u.estado === 1 ? 0 : 1;
    const accion = nuevoEstado === 0 ? 'Dar de baja' : 'Reactivar';

    Alert.alert(
      `${accion} estudiante`,
      `¿Está seguro de ${accion.toLowerCase()} a ${u.nombre} ${u.apellidoPaterno || ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: accion,
          style: nuevoEstado === 0 ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await usuariosApi.update(u.id, { estado: nuevoEstado as EstadoUsuario });
              refresh();
            } catch {
              Alert.alert('Error', 'No se pudo modificar el estado del usuario');
            }
          },
        },
      ],
    );
  };

  const estudiantesList = (data?.data ?? []).filter((u) => {
    const r = (u.rol || '').toLowerCase();
    return r === 'estudiante' || String(u.rolId) === '3';
  });

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      <BentoCard className="p-5 bg-card border-l-4 border-maroon">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-8 h-8 rounded-lg bg-maroon/15 items-center justify-center">
                <Ionicons name="people-outline" size={18} color="#7A1F3D" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Personal Estudiantil</Text>
            </View>
            <Text className="text-gray-500 text-xs">
              Gestión de estudiantes, tutores apoderados y documentación regulada de Bolivia.
            </Text>
          </View>

          {canEdit && (
            <TouchableOpacity
              onPress={() => {
                resetForms();
                setShowModal(true);
              }}
              className="bg-maroon rounded-xl px-4 py-3 flex-row items-center gap-2 shadow-md"
            >
              <Ionicons name="person-add" color="#FFF" size={18} />
              <Text className="text-white font-bold">Registrar Estudiante</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2 border border-gray-200">
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

      {showModal && (
        <BentoCard className="p-5 border border-gold/30 bg-white">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <View>
              <Text className="text-xl font-bold text-maroon">
                {editingStudent ? 'Editar Estudiante' : 'Registro de Estudiante y Tutor'}
              </Text>
              <Text className="text-xs text-gray-500">
                {step === 1 ? 'Paso 1 de 2: Registrar Tutor Apoderado' : 'Paso 2 de 2: Datos del Estudiante y Documentación'}
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

          {step === 1 && !editingStudent && (
            <View className="gap-3">
              <Text className="text-sm font-bold text-gray-800 border-l-2 border-gold pl-2">
                Datos del Tutor o Apoderado Responsable
              </Text>

              <ProfilePhotoPicker photoUri={tutorPhoto} onChange={setTutorPhoto} required={true} />

              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={tutorForm.nombre}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, nombre: v }))}
                  placeholder="Nombre del Tutor *"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
                />
                <TextInput
                  value={tutorForm.apellidoPaterno}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoPaterno: v }))}
                  placeholder="Apellido Paterno *"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
                />
                <TextInput
                  value={tutorForm.apellidoMaterno}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoMaterno: v }))}
                  placeholder="Apellido Materno *"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
                />
                <BirthDatePicker value={tutorForm.nacimiento} onChange={(v) => setTutorForm((f) => ({ ...f, nacimiento: v }))} />
                <TextInput
                  value={tutorForm.celular}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, celular: v }))}
                  placeholder="Teléfono / Celular de contacto"
                  keyboardType="phone-pad"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
                />
              </View>

              <Text className="text-xs font-bold text-gray-700 mt-2">Parentesco / Vínculo</Text>
              <View className="flex-row gap-2">
                {['Padre', 'Madre', 'Tutor Legal'].map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setTutorForm((f) => ({ ...f, parentesco: p }))}
                    className={`px-3 py-2 rounded-lg border ${tutorForm.parentesco === p ? 'bg-maroon border-maroon' : 'bg-gray-100 border-gray-200'}`}
                  >
                    <Text className={`text-xs font-semibold ${tutorForm.parentesco === p ? 'text-white' : 'text-gray-700'}`}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-xs font-bold text-gray-700 mt-2">Dirección del Tutor</Text>
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={tutorForm.zona}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, zona: v }))}
                  placeholder="Zona *"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
                />
                <TextInput
                  value={tutorForm.distrito}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, distrito: v }))}
                  placeholder="Distrito"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
                />
                <TextInput
                  value={tutorForm.calle}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, calle: v }))}
                  placeholder="Calle / Avenida"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
                />
                <TextInput
                  value={tutorForm.numero}
                  onChangeText={(v) => setTutorForm((f) => ({ ...f, numero: v }))}
                  placeholder="Número de casa"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[120px]"
                />
              </View>

              <DocumentInput
                documents={tutorDocs}
                onChange={setTutorDocs}
                requiredTypes={TUTOR_REQUIRED_DOCS}
                title="Documentos del Tutor (PDF)"
                showRequiredBadge={true}
              />

              <TouchableOpacity
                onPress={handleSaveTutor}
                disabled={saving}
                className="bg-maroon rounded-xl py-3.5 items-center mt-4 flex-row justify-center gap-2"
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

          {(step === 2 || editingStudent) && (
            <View className="gap-3">
              {tutorSummary && (
                <View className="bg-gold/15 border border-gold/40 rounded-xl p-3 mb-2 flex-row items-center justify-between">
                  <View>
                    <Text className="text-xs font-bold text-maroon">Tutor Registrado:</Text>
                    <Text className="text-xs text-gray-800">{tutorSummary}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color="#7A1F3D" />
                </View>
              )}

              <Text className="text-sm font-bold text-gray-800 border-l-2 border-maroon pl-2">
                Datos del Estudiante
              </Text>

              <ProfilePhotoPicker photoUri={studentPhoto} onChange={setStudentPhoto} required={!editingStudent} />

              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={studentForm.nombre}
                  onChangeText={(v) => setStudentForm((f) => ({ ...f, nombre: v }))}
                  placeholder="Nombre *"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
                />
                <TextInput
                  value={studentForm.apellidoPaterno}
                  onChangeText={(v) => setStudentForm((f) => ({ ...f, apellidoPaterno: v }))}
                  placeholder="Apellido Paterno *"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
                />
                <TextInput
                  value={studentForm.apellidoMaterno}
                  onChangeText={(v) => setStudentForm((f) => ({ ...f, apellidoMaterno: v }))}
                  placeholder="Apellido Materno *"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
                />
                <BirthDatePicker value={studentForm.nacimiento} onChange={(v) => setStudentForm((f) => ({ ...f, nacimiento: v }))} />
              </View>

              <DocumentInput
                documents={studentDocs}
                onChange={setStudentDocs}
                requiredTypes={STUDENT_REQUIRED_DOCS}
                title="Documentos del Estudiante (PDF)"
                showRequiredBadge={true}
              />

              <Text className="text-xs font-bold text-gray-700 mt-2">Cuenta de Acceso del Estudiante</Text>
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={studentForm.username}
                  onChangeText={(v) => setStudentForm((f) => ({ ...f, username: v }))}
                  placeholder="Nombre de Usuario *"
                  autoCapitalize="none"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
                />
                <TextInput
                  value={studentForm.email}
                  onChangeText={(v) => setStudentForm((f) => ({ ...f, email: v }))}
                  placeholder="Correo electrónico *"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
                />
                <TextInput
                  value={studentForm.password}
                  onChangeText={(v) => setStudentForm((f) => ({ ...f, password: v }))}
                  placeholder={editingStudent ? 'Nueva Contraseña (Opcional)' : 'Contraseña (Mín. 8 caract.) *'}
                  secureTextEntry
                  className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
                />
              </View>

              <TouchableOpacity
                onPress={handleSaveStudent}
                disabled={saving}
                className="bg-maroon rounded-xl py-3.5 items-center mt-4 flex-row justify-center gap-2 shadow-md"
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

      <BentoCard className="p-5 bg-white">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-bold text-gray-900">
            Nómina de Estudiantes ({estudiantesList.length})
          </Text>
          {loading && <ActivityIndicator color="#7A1F3D" />}
        </View>

        {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

        {estudiantesList.map((st) => {
          const docs = st.documentos ?? [];
          const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ?? (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
          const rudeDoc = docs.find((d) => d.tipoDoc === 'RUDE' || (d as any).tipo_doc === 'RUDE')?.numeroDoc ?? (docs.find((d) => (d as any).tipo_doc === 'RUDE') as any)?.numero_doc;

          const nombre = st.nombre ?? '';
          const apPaterno = st.apellidoPaterno || (st as any).apellido_paterno || '';
          const apMaterno = st.apellidoMaterno || (st as any).apellido_materno || '';
          const inicialNombre = nombre ? nombre.charAt(0) : 'E';
          const inicialPaterno = apPaterno ? apPaterno.charAt(0) : '';

          return (
            <View key={st.id} className="flex-row items-center justify-between py-3 border-b border-gray-100">
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-10 h-10 rounded-xl bg-maroon/10 items-center justify-center mr-3 border border-maroon/20">
                  <Text className="text-maroon font-bold text-sm">
                    {inicialNombre}{inicialPaterno}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-gray-900 text-sm">
                    {nombre} {apPaterno} {apMaterno}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Usuario: @{st.username ?? 'sin-cuenta'} • CI: {ciDoc} {rudeDoc ? `• RUDE: ${rudeDoc}` : ''}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <StatusBadge status={st.estado} />

                {canEdit ? (
                  <>
                    <TouchableOpacity onPress={() => handleEdit(st)} className="p-1.5 bg-gray-100 rounded-lg">
                      <Ionicons name="create-outline" size={18} color="#7A1F3D" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleToggleState(st)} className="p-1.5 bg-gray-100 rounded-lg">
                      <Ionicons
                        name={st.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                        size={18}
                        color={st.estado === 1 ? '#DC2626' : '#16A34A'}
                      />
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity onPress={() => setSelectedStudentDetail(st)} className="p-1.5 bg-gray-100 rounded-lg">
                    <Ionicons name="eye-outline" size={18} color="#7A1F3D" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {!loading && estudiantesList.length === 0 && (
          <Text className="text-gray-500 text-center py-8 text-sm">
            No se encontraron estudiantes registrados.
          </Text>
        )}
      </BentoCard>

      {selectedStudentDetail && (
        <BentoCard className="p-5 bg-white border border-maroon/30">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-lg font-bold text-maroon">Ficha de Estudiante (Consulta)</Text>
            <TouchableOpacity onPress={() => setSelectedStudentDetail(null)}>
              <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          <Text className="font-bold text-gray-800">
            {selectedStudentDetail.nombre ?? ''} {selectedStudentDetail.apellidoPaterno || (selectedStudentDetail as any).apellido_paterno || ''} {selectedStudentDetail.apellidoMaterno || (selectedStudentDetail as any).apellido_materno || ''}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">Usuario: @{selectedStudentDetail.username}</Text>
          <Text className="text-xs text-gray-600">Correo: {selectedStudentDetail.email || 'N/A'}</Text>
          <Text className="text-xs text-gray-600 mt-1 font-bold">Documentos:</Text>
          {(selectedStudentDetail.documentos ?? []).map((d, i) => (
            <Text key={i} className="text-xs text-gray-500 ml-2">• {d.tipoDoc || (d as any).tipo_doc}: {d.numeroDoc || (d as any).numero_doc}</Text>
          ))}
        </BentoCard>
      )}
    </ScrollView>
  );
}