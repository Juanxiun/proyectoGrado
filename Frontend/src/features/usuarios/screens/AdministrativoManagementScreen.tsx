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

const ADMIN_REQUIRED_DOCS = ['CI', 'Diploma de Bachiller', 'Certificado de Egreso'];

const emptyAdminForm = {
  rolId: '4',
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
  celular: '',
};

export function AdministrativoManagementScreen() {
  const { user } = useAuth();
  const userRol = user?.rol?.toLowerCase() ?? '';
  const isDirector = userRol === 'director';

  const { data, loading, error, fetchList } = useUsuariosList();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoUsuario | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Usuario | null>(null);

  const [form, setForm] = useState(emptyAdminForm);
  const [adminDocs, setAdminDocs] = useState<UsuarioDoc[]>([
    { tipoDoc: 'CI', numeroDoc: '' },
    { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
    { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
  ]);
  const [adminPhoto, setAdminPhoto] = useState<string | undefined>(undefined);

  const refresh = () => {
    fetchList({ buscar: search, estado: statusFilter, limit: 100 }).catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    return connectUsersWebSocket(refresh);
  }, [search, statusFilter]);

  if (!isDirector) {
    return (
      <View className="flex-1 items-center justify-center p-6 bg-cream">
        <BentoCard className="p-6 items-center max-w-sm">
          <Ionicons name="lock-closed" size={48} color="#7A1F3D" />
          <Text className="text-xl font-bold text-maroon mt-4 text-center">Acceso Restringido</Text>
          <Text className="text-gray-500 text-xs text-center mt-2">
            La gestión del Personal Administrativo está reservada únicamente para la Dirección General.
          </Text>
        </BentoCard>
      </View>
    );
  }

  const resetForm = () => {
    setEditingAdmin(null);
    setForm(emptyAdminForm);
    setAdminDocs([
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
      { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
    ]);
    setAdminPhoto(undefined);
  };

  const handleSaveAdmin = async () => {
    if (!form.nombre || !form.apellidoPaterno || !form.apellidoMaterno || !form.nacimiento) {
      Alert.alert('Campos requeridos', 'Complete los datos personales obligatorios.');
      return;
    }
    const missingRequired = ADMIN_REQUIRED_DOCS.filter(
      (req) => !adminDocs.some((d) => d.tipoDoc === req && d.numeroDoc.trim())
    );
    if (missingRequired.length > 0) {
      Alert.alert('Documentación requerida', `${missingRequired.join(', ')} son obligatorios.`);
      return;
    }
    if (!editingAdmin && (!form.username || !form.email || !form.password)) {
      Alert.alert('Cuenta de acceso', 'Ingrese las credenciales de acceso para el personal administrativo.');
      return;
    }
    if (!editingAdmin && !adminPhoto) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil (PNG/JPG).');
      return;
    }

    setSaving(true);
    try {
      if (editingAdmin) {
        const updatePayload: UpdateUsuarioPayload = {
          rolId: form.rolId,
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          nacimiento: form.nacimiento,
          genero: form.genero,
          documentos: adminDocs,
          direccion: form.zona ? { zona: form.zona, distrito: form.distrito || undefined, calle: form.calle || undefined, numero: form.numero || undefined } : undefined,
          contactos: form.celular ? [{ tipo: 'Celular', contenido: form.celular }] : undefined,
          cuenta: form.username && form.email ? { username: form.username, email: form.email, password: form.password || undefined } : undefined,
        };

        await usuariosApi.updateWithFiles(editingAdmin.id, updatePayload, adminPhoto);
        Alert.alert('Éxito', 'Personal administrativo actualizado correctamente.');
      } else {
        const createPayload: CreateUsuarioPayload = {
          rolId: form.rolId,
          nombre: form.nombre,
          apellidoPaterno: form.apellidoPaterno,
          apellidoMaterno: form.apellidoMaterno,
          nacimiento: form.nacimiento,
          genero: form.genero,
          cuenta: { username: form.username, email: form.email, password: form.password },
          documentos: adminDocs,
          direccion: form.zona ? { zona: form.zona, distrito: form.distrito || undefined, calle: form.calle || undefined, numero: form.numero || undefined } : undefined,
          contactos: form.celular ? [{ tipo: 'Celular', contenido: form.celular }] : [],
        };

        await usuariosApi.createWithFiles(createPayload, adminPhoto);
        Alert.alert('Éxito', 'Personal administrativo registrado correctamente.');
      }

      setShowModal(false);
      resetForm();
      refresh();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la información');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (u: Usuario) => {
    setEditingAdmin(u);
    const docs = u.documentos ?? [];
    setForm({
      rolId: String(u.rolId),
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
    setAdminDocs(mappedDocs.length > 0 ? mappedDocs : [
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'Diploma de Bachiller', numeroDoc: '' },
      { tipoDoc: 'Certificado de Egreso', numeroDoc: '' },
    ]);
    setAdminPhoto(u.fotoUrl ?? undefined);

    setShowModal(true);
  };

  const handleToggleState = (u: Usuario) => {
    const nuevoEstado = u.estado === 1 ? 0 : 1;
    const accion = nuevoEstado === 0 ? 'Dar de baja' : 'Reactivar';

    Alert.alert(
      `${accion} usuario administrativo`,
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
              Alert.alert('Error', 'No se pudo modificar el estado');
            }
          },
        },
      ],
    );
  };

  const adminList = (data?.data ?? []).filter((u) => {
    const r = (u.rol || '').toLowerCase();
    return r === 'director' || r === 'control' || r === 'gerencia' || String(u.rolId) === '1' || String(u.rolId) === '4';
  });

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      <BentoCard className="p-5 bg-card border-l-4 border-maroon">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-8 h-8 rounded-lg bg-maroon/15 items-center justify-center">
                <Ionicons name="shield-outline" size={18} color="#7A1F3D" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Personal Administrativo</Text>
            </View>
            <Text className="text-gray-500 text-xs">
              Gestión exclusiva de la Dirección General para cargos directivos y de control.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-maroon rounded-xl px-4 py-3 flex-row items-center gap-2 shadow-md"
          >
            <Ionicons name="person-add" color="#FFF" size={18} />
            <Text className="text-white font-bold">Registrar Administrativo</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2 border border-gray-200">
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={refresh}
              placeholder="Buscar por nombre, cargo, CI o usuario..."
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
              {editingAdmin ? 'Editar Personal Administrativo' : 'Registro de Personal Administrativo'}
            </Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} className="p-1">
              <Ionicons name="close-circle" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View className="gap-3">
            <Text className="text-xs font-bold text-gray-700">Cargo / Rol Administrativo</Text>
            <View className="flex-row gap-2 mb-2">
              {[
                { id: '1', label: 'Director General' },
                { id: '4', label: 'Control / Gerencia' },
              ].map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setForm((f) => ({ ...f, rolId: r.id }))}
                  className={`px-4 py-2.5 rounded-xl border ${form.rolId === r.id ? 'bg-maroon border-maroon' : 'bg-gray-100 border-gray-200'}`}
                >
                  <Text className={`text-xs font-bold ${form.rolId === r.id ? 'text-white' : 'text-gray-700'}`}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-bold text-gray-800 border-l-2 border-maroon pl-2">
              Datos Personales
            </Text>

            <ProfilePhotoPicker photoUri={adminPhoto} onChange={setAdminPhoto} required={!editingAdmin} />

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
            </View>

            <DocumentInput
              documents={adminDocs}
              onChange={setAdminDocs}
              requiredTypes={ADMIN_REQUIRED_DOCS}
              title="Documentos de Regularización (Normativa Bolivia) - PDF"
              showRequiredBadge={true}
            />

            <Text className="text-xs font-bold text-gray-700 mt-2">Cuenta de Acceso</Text>
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
                placeholder={editingAdmin ? 'Nueva Contraseña (Opcional)' : 'Contraseña (Mín. 8 caract.) *'}
                secureTextEntry
                className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[150px]"
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveAdmin}
              disabled={saving}
              className="bg-maroon rounded-xl py-3.5 items-center mt-4 flex-row justify-center gap-2 shadow-md"
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text className="text-white font-bold text-sm">
                    {editingAdmin ? 'Guardar Cambios' : 'Registrar Personal Administrativo'}
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
            Nómina de Personal Administrativo ({adminList.length})
          </Text>
          {loading && <ActivityIndicator color="#7A1F3D" />}
        </View>

        {error && <Text className="text-red-600 text-xs mb-3">{error}</Text>}

        {adminList.map((adm) => {
          const docs = adm.documentos ?? [];
          const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ?? (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
          const nombre = adm.nombre ?? '';
          const apPaterno = adm.apellidoPaterno || (adm as any).apellido_paterno || '';
          const apMaterno = adm.apellidoMaterno || (adm as any).apellido_materno || '';
          const inicialNombre = nombre ? nombre.charAt(0) : 'A';
          const inicialPaterno = apPaterno ? apPaterno.charAt(0) : '';

          return (
            <View key={adm.id} className="flex-row items-center justify-between py-3 border-b border-gray-100">
              <View className="flex-row items-center flex-1 mr-2">
                <View className="w-10 h-10 rounded-xl bg-maroon/20 items-center justify-center mr-3 border border-maroon/30">
                  <Text className="text-maroon font-bold text-sm">
                    {inicialNombre}{inicialPaterno}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-gray-900 text-sm">
                    {nombre} {apPaterno} {apMaterno}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Cargo: <Text className="font-semibold text-maroon">{adm.rol ?? `Rol ${adm.rolId}`}</Text> • Usuario: @{adm.username ?? 'sin-cuenta'} • CI: {ciDoc}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3">
                <StatusBadge status={adm.estado} />
                <TouchableOpacity onPress={() => handleEdit(adm)} className="p-1.5 bg-gray-100 rounded-lg">
                  <Ionicons name="create-outline" size={18} color="#7A1F3D" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleToggleState(adm)} className="p-1.5 bg-gray-100 rounded-lg">
                  <Ionicons
                    name={adm.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color={adm.estado === 1 ? '#DC2626' : '#16A34A'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {!loading && adminList.length === 0 && (
          <Text className="text-gray-500 text-center py-8 text-sm">
            No se encontró personal administrativo registrado.
          </Text>
        )}
      </BentoCard>
    </ScrollView>
  );
}