import { useEffect, useMemo, useState } from 'react';
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
      Alert.alert('Documentos requeridos', 'El CI y el RUDE son obligatorios según la normativa de Bolivia.');
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

    const hasCiFile = Boolean(ciDoc.fileUri || ciDoc.docUrl);
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
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el estudiante');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u: Usuario) => {
    setEditingStudent(u);
    const docs = u.documentos ?? [];
    const nac = u.nacimiento ? String(u.nacimiento).slice(0, 10) : '';

    setStudentForm({
      nombre: u.nombre ?? '',
      apellidoPaterno: u.apellidoPaterno || (u as any).apellido_paterno || '',
      apellidoMaterno: u.apellidoMaterno || (u as any).apellido_materno || '',
      nacimiento: nac,
      genero: (u.genero as any) ?? 'masculino',
      username: u.username ?? (u as any).cuenta?.username ?? '',
      email: u.email ?? (u as any).cuenta?.email ?? '',
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
    if (!mappedDocs.some((d) => d.tipoDoc === 'CI')) {
      mappedDocs.unshift({ tipoDoc: 'CI', numeroDoc: '' });
    }
    if (!mappedDocs.some((d) => d.tipoDoc === 'RUDE')) {
      mappedDocs.push({ tipoDoc: 'RUDE', numeroDoc: '' });
    }
    setStudentDocs(mappedDocs);
    setStudentPhoto(u.fotoUrl ?? undefined);

    setStep(2);
    setShowModal(true);
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

          {(step === 2 || editingStudent) && (
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
                  <TextInput
                    value={studentForm.nombre}
                    onChangeText={(v) => {
                      setStudentForm((f) => ({ ...f, nombre: v }));
                      const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                      handleAutoFillStudentUsername(v, studentForm.apellidoPaterno, studentForm.apellidoMaterno, ciDoc);
                    }}
                    placeholder="Nombre *"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={studentForm.apellidoPaterno}
                    onChangeText={(v) => {
                      setStudentForm((f) => ({ ...f, apellidoPaterno: v }));
                      const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                      handleAutoFillStudentUsername(studentForm.nombre, v, studentForm.apellidoMaterno, ciDoc);
                    }}
                    placeholder="Apellido Paterno *"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={studentForm.apellidoMaterno}
                    onChangeText={(v) => {
                      setStudentForm((f) => ({ ...f, apellidoMaterno: v }));
                      const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                      handleAutoFillStudentUsername(studentForm.nombre, studentForm.apellidoPaterno, v, ciDoc);
                    }}
                    placeholder="Apellido Materno *"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
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
                />
              </BentoCard>

              <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Cuenta Institucional del Estudiante</Text>
                <View className="flex-row flex-wrap gap-2">
                  <TextInput
                    value={studentForm.username}
                    onChangeText={(v) => setStudentForm((f) => ({ ...f, username: v }))}
                    placeholder="Nombre de Usuario *"
                    autoCapitalize="none"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={studentForm.email}
                    onChangeText={(v) => setStudentForm((f) => ({ ...f, email: v }))}
                    placeholder="Correo institucional *"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                  />
                  <TextInput
                    value={studentForm.password}
                    onChangeText={(v) => setStudentForm((f) => ({ ...f, password: v }))}
                    placeholder={editingStudent ? 'Nueva Contraseña (Opcional)' : 'Contraseña (Mín. 8 caract.) *'}
                    secureTextEntry
                    className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
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

      {/* GRID DE CARTAS BENTO PARA ESTUDIANTES - HABILITADOS */}
      <BentoCard className="p-5 bg-white">
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
      </BentoCard>

      {/* GRID DE CARTAS BENTO PARA ESTUDIANTES - DESHABILITADOS */}
      <BentoCard className="p-5 bg-white">
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
      </BentoCard>

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