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
  const [docenteDocs, setDocenteDocs] = useState<UsuarioDoc[]>([
    { tipoDoc: 'CI', numeroDoc: '' },
    { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
    { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
  ]);
  const [docentePhoto, setDocentePhoto] = useState<string | undefined>(undefined);

  const refresh = () => {
    fetchList({ buscar: search, estado: statusFilter, limit: 100 }).catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    return connectUsersWebSocket(refresh);
  }, [search, statusFilter]);

  const resetForm = () => {
    setEditingDocente(null);
    setForm(emptyDocenteForm);
    setDocenteDocs([
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
      { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
    ]);
    setDocentePhoto(undefined);
  };

  const handleSaveDocente = async () => {
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
    if (!editingDocente && (!form.username || !form.email || !form.password)) {
      Alert.alert('Cuenta de acceso', 'Ingrese las credenciales de acceso para el docente.');
      return;
    }
    if (!editingDocente && !docentePhoto) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil del docente (PNG/JPG).');
      return;
    }

    setSaving(true);
    try {
      if (editingDocente) {
        const updatePayload: UpdateUsuarioPayload = {
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          nacimiento: form.nacimiento,
          genero: form.genero,
          maestro: { especialidad: form.especialidad },
          documentos: docenteDocs,
          direccion: form.zona ? { zona: form.zona, distrito: form.distrito || undefined, calle: form.calle || undefined, numero: form.numero || undefined } : undefined,
          contactos: form.celular ? [{ tipo: 'Celular', contenido: form.celular }] : undefined,
          cuenta: form.username && form.email ? { username: form.username, email: form.email, password: form.password || undefined } : undefined,
        };

        await usuariosApi.updateWithFiles(editingDocente.id, updatePayload, docentePhoto);
        Alert.alert('Éxito', 'Docente actualizado correctamente.');
      } else {
        const createPayload: CreateUsuarioPayload = {
          rolId: '2',
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          nacimiento: form.nacimiento,
          genero: form.genero,
          maestro: { especialidad: form.especialidad, fechaContratacion: form.fechaContratacion },
          cuenta: { username: form.username, email: form.email, password: form.password },
          documentos: docenteDocs,
          direccion: form.zona ? { zona: form.zona, distrito: form.distrito || undefined, calle: form.calle || undefined, numero: form.numero || undefined } : undefined,
          contactos: form.celular ? [{ tipo: 'Celular', contenido: form.celular }] : [],
        };

        await usuariosApi.createWithFiles(createPayload, docentePhoto);
        Alert.alert('Éxito', 'Docente registrado correctamente.');
      }

      setShowModal(false);
      resetForm();
      refresh();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar el docente');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u: Usuario) => {
    setEditingDocente(u);
    const docs = u.documentos ?? [];
    setForm({
      nombre: u.nombre ?? '',
      apellidoPaterno: u.apellidoPaterno || (u as any).apellido_paterno || '',
      apellidoMaterno: u.apellidoMaterno || (u as any).apellido_materno || '',
      nacimiento: u.nacimiento ? String(u.nacimiento).split('T')[0] : '',
      genero: (u.genero as any) ?? 'masculino',
      especialidad: 'Matemáticas',
      fechaContratacion: new Date().toISOString().split('T')[0],
      username: u.username ?? '',
      email: u.email ?? '',
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
    setDocenteDocs(mappedDocs.length > 0 ? mappedDocs : [
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
      { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
    ]);
    setDocentePhoto(u.fotoUrl ?? undefined);

    setShowModal(true);
  };

  const handleToggleState = (u: Usuario) => {
    const nuevoEstado = u.estado === 1 ? 0 : 1;
    const accion = nuevoEstado === 0 ? 'Dar de baja' : 'Reactivar';

    Alert.alert(
      `${accion} docente`,
      `¿Está seguro de ${accion.toLowerCase()} al docente ${u.nombre} ${u.apellidoPaterno || ''}?`,
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
              Alert.alert('Error', 'No se pudo modificar el estado del docente');
            }
          },
        },
      ],
    );
  };

  const docentesList = (data?.data ?? []).filter((u) => {
    const r = (u.rol || '').toLowerCase();
    return r === 'profesor' || r === 'maestro' || r === 'maestros' || String(u.rolId) === '2';
  });

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      <BentoCard className="p-5 bg-card border-l-4 border-maroon">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-8 h-8 rounded-lg bg-maroon/15 items-center justify-center">
                <Ionicons name="school-outline" size={18} color="#7A1F3D" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Personal Docente</Text>
            </View>
            <Text className="text-gray-500 text-xs">
              Gestión de maestros, especialidades académicas y documentación según la normativa de Bolivia.
            </Text>
          </View>

          {canEdit && (
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-maroon rounded-xl px-4 py-3 flex-row items-center gap-2 shadow-md"
            >
              <Ionicons name="person-add" color="#FFF" size={18} />
              <Text className="text-white font-bold">Registrar Docente</Text>
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

      {showModal && (
        <BentoCard className="p-5 border border-gold/30 bg-white">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <Text className="text-xl font-bold text-maroon">
              {editingDocente ? 'Editar Docente' : 'Registro de Personal Docente'}
            </Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} className="p-1">
              <Ionicons name="close-circle" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View className="gap-3">
            <Text className="text-sm font-bold text-gray-800 border-l-2 border-maroon pl-2">
              Datos Personales del Docente
            </Text>

            <ProfilePhotoPicker photoUri={docentePhoto} onChange={setDocentePhoto} required={!editingDocente} />

            <View className="flex-row flex-wrap gap-2">
              <TextInput
                value={form.nombre}
                onChangeText={(v) => setForm((f) => ({ ...f, nombre: v }))}
                placeholder="Nombre *"
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
              />
              <TextInput
                value={form.apellidoPaterno}
                onChangeText={(v) => setForm((f) => ({ ...f, apellidoPaterno: v }))}
                placeholder="Apellido Paterno *"
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
              />
              <TextInput
                value={form.apellidoMaterno}
                onChangeText={(v) => setForm((f) => ({ ...f, apellidoMaterno: v }))}
                placeholder="Apellido Materno *"
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
              />
              <BirthDatePicker value={form.nacimiento} onChange={(v) => setForm((f) => ({ ...f, nacimiento: v }))} />
              <TextInput
                value={form.especialidad}
                onChangeText={(v) => setForm((f) => ({ ...f, especialidad: v }))}
                placeholder="Especialidad / Materia Principal"
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[170px]"
              />
            </View>

            <DocumentInput
              documents={docenteDocs}
              onChange={setDocenteDocs}
              requiredTypes={DOCENTE_REQUIRED_DOCS}
              title="Documentos de Regularización (Normativa Bolivia) - PDF"
              showRequiredBadge={true}
            />

            <Text className="text-xs font-bold text-gray-700 mt-2">Cuenta de Acceso del Docente</Text>
            <View className="flex-row flex-wrap gap-2">
              <TextInput
                value={form.username}
                onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
                placeholder="Nombre de Usuario *"
                autoCapitalize="none"
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
              />
              <TextInput
                value={form.email}
                onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="Correo Institucional *"
                keyboardType="email-address"
                autoCapitalize="none"
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
              />
              <TextInput
                value={form.password}
                onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder={editingDocente ? 'Nueva Contraseña (Opcional)' : 'Contraseña (Mín. 8 caract.) *'}
                secureTextEntry
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveDocente}
              disabled={saving}
              className="bg-maroon rounded-xl py-3.5 items-center mt-4 flex-row justify-center gap-2 shadow-md"
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
        </BentoCard>
      )}

      <BentoCard className="p-5 bg-white">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-bold text-gray-900">
            Nómina de Personal Docente ({docentesList.length})
          </Text>
          {loading && <ActivityIndicator color="#7A1F3D" />}
        </View>

        {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

        {docentesList.map((doc) => {
          const docs = doc.documentos ?? [];
          const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ?? (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
          const nombre = doc.nombre ?? '';
          const apPaterno = doc.apellidoPaterno || (doc as any).apellido_paterno || '';
          const apMaterno = doc.apellidoMaterno || (doc as any).apellido_materno || '';
          const inicialNombre = nombre ? nombre.charAt(0) : 'D';
          const inicialPaterno = apPaterno ? apPaterno.charAt(0) : '';

          return (
            <View key={doc.id} className="flex-row items-center justify-between py-3 border-b border-gray-100">
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-10 h-10 rounded-xl bg-gold/20 items-center justify-center mr-3 border border-gold/40">
                  <Text className="text-maroon font-bold text-sm">
                    {inicialNombre}{inicialPaterno}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-gray-900 text-sm">
                    {nombre} {apPaterno} {apMaterno}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Usuario: @{doc.username ?? 'sin-cuenta'} • CI: {ciDoc}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <StatusBadge status={doc.estado} />
                {canEdit && (
                  <>
                    <TouchableOpacity onPress={() => handleEdit(doc)} className="p-1.5 bg-gray-100 rounded-lg">
                      <Ionicons name="create-outline" size={18} color="#7A1F3D" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleToggleState(doc)} className="p-1.5 bg-gray-100 rounded-lg">
                      <Ionicons
                        name={doc.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                        size={18}
                        color={doc.estado === 1 ? '#DC2626' : '#16A34A'}
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {!loading && docentesList.length === 0 && (
          <Text className="text-gray-500 text-center py-8 text-sm">
            No se encontraron docentes registrados.
          </Text>
        )}
      </BentoCard>
    </ScrollView>
  );
}