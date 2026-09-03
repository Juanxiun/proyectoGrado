import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { useUsuariosList } from '../../../hooks/useUsuarios';
import { usuariosApi } from '../../../api/usuarios.api';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { generateStudentEmail, generateUsername } from '../../../utils/usernameGenerator';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { DocumentInput } from '../components/DocumentInput';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import type { CreateUsuarioPayload, UpdateUsuarioPayload, Usuario, UsuarioDoc } from '../../../types';

const empty: CreateUsuarioPayload = {
  rolId: '1', nombre: '', apellidoPaterno: '', apellidoMaterno: '', nacimiento: '',
  cuenta: { username: '', email: '', password: '' },
  documentos: [{ tipoDoc: 'DNI', numeroDoc: '' }],
};

export function UserManagementScreen() {
  const { data, loading, error, fetchList } = useUsuariosList();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CreateUsuarioPayload>(empty);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fotoUri, setFotoUri] = useState<string | undefined>();
  const [documents, setDocuments] = useState<UsuarioDoc[]>([{ tipoDoc: 'DNI', numeroDoc: '' }]);
  const refresh = () => fetchList({ buscar: search, limit: 50 }).catch(() => undefined);
  useEffect(() => { refresh(); return connectUsersWebSocket(refresh); }, []);

  const username = form.cuenta?.username || (form.nombre && form.apellidoPaterno && form.apellidoMaterno && form.nacimiento
    ? generateUsername(form.nombre, form.apellidoPaterno, form.apellidoMaterno, form.nacimiento) : '');
  const email = form.cuenta?.email || (username ? generateStudentEmail(username) : '');
  const setField = (key: keyof CreateUsuarioPayload, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setFotoUri(result.assets[0].uri);
  };

  const save = async () => {
    if (!form.nombre || !form.apellidoPaterno || !form.apellidoMaterno || !form.nacimiento) {
      Alert.alert('Datos incompletos', 'Complete los datos personales obligatorios.'); return;
    }
    if (!editing && !fotoUri) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil (PNG/JPG).'); return;
    }
    setSaving(true);
    try {
      const account = form.cuenta?.password ? { username, email, password: form.cuenta.password } : undefined;
      const datos = { ...form, cuenta: account, documentos: documents };
      if (editing) await usuariosApi.updateWithFiles(editing.id, datos as UpdateUsuarioPayload, fotoUri);
      else await usuariosApi.createWithFiles(datos, fotoUri);
      setForm(empty); setEditing(null); setFotoUri(undefined); setDocuments([{ tipoDoc: 'DNI', numeroDoc: '' }]); setShowForm(false); refresh();
    } catch (e) { Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error del servidor'); }
    finally { setSaving(false); }
  };

  const edit = (u: Usuario) => {
    setEditing(u); setFotoUri(u.fotoUrl ?? undefined);
    setForm({ rolId: u.rolId, nombre: u.nombre, apellidoPaterno: u.apellidoPaterno, apellidoMaterno: u.apellidoMaterno,
      nacimiento: u.nacimiento.slice(0, 10), estado: u.estado, cuenta: { username: u.username ?? '', email: u.email ?? '', password: '' },
      documentos: u.documentos ?? [{ tipoDoc: 'DNI', numeroDoc: '' }], direccion: u.direccion ?? undefined, contactos: u.contactos ?? [] });
    setDocuments((u.documentos ?? []).map((d) => ({
      id: d.id, tipoDoc: d.tipoDoc || (d as any).tipo_doc, numeroDoc: d.numeroDoc || (d as any).numero_doc,
      docUrl: d.docUrl, fileUri: undefined, fileName: undefined,
    })));
    setShowForm(true);
  };

  const remove = (u: Usuario) => Alert.alert('Eliminar usuario', `¿Eliminar a ${u.nombre}?`, [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await usuariosApi.delete(u.id); refresh(); } },
  ]);

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Gestión de usuarios</Text>
            <Text className="text-gray-500 text-sm">CRUD conectado a RestApi</Text>
          </View>
          <TouchableOpacity onPress={() => { setEditing(null); setForm(empty); setFotoUri(undefined); setDocuments([{ tipoDoc: 'DNI', numeroDoc: '' }]); setShowForm(!showForm); }} className="bg-maroon rounded-xl px-4 py-3 flex-row items-center gap-2">
            <Ionicons name={showForm ? 'close' : 'person-add'} color="#fff" size={18} />
            <Text className="text-white font-semibold">{showForm ? 'Cerrar' : 'Nuevo'}</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-2">
          <TextInput value={search} onChangeText={setSearch} onSubmitEditing={refresh} placeholder="Buscar por nombre o usuario" className="bg-gray-100 rounded-xl px-4 py-3 flex-1" />
          <TouchableOpacity onPress={refresh} className="bg-gray-100 rounded-xl px-4 justify-center"><Ionicons name="search" size={20} color="#801529" /></TouchableOpacity>
        </View>
      </BentoCard>

      {showForm && (
        <BentoCard className="p-5">
          <Text className="text-lg font-bold text-maroon mb-3">{editing ? 'Editar persona' : 'Registrar persona'}</Text>

          <ProfilePhotoPicker photoUri={fotoUri} onChange={setFotoUri} required={!editing} />

          <View className="flex-row flex-wrap gap-2">
            {([['nombre', 'Nombre *'], ['apellidoPaterno', 'Apellido paterno *'], ['apellidoMaterno', 'Apellido materno *']] as const).map(([key, label]) => (
              <TextInput key={key} value={form[key] as string} onChangeText={(v) => setField(key, v)} placeholder={label} className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[180px]" />
            ))}
            <BirthDatePicker value={form.nacimiento} onChange={(v) => setField('nacimiento', v)} />
            <View className="bg-gray-100 rounded-xl px-3 py-2 flex-1 min-w-[180px]"><Text className="text-xs text-gray-500">Nombre de usuario</Text><Text className="text-gray-800">{username || 'Complete sus datos'}</Text></View>
            <View className="bg-gray-100 rounded-xl px-3 py-2 flex-1 min-w-[180px]"><Text className="text-xs text-gray-500">Correo electrónico</Text><Text className="text-gray-800">{email || 'Complete sus datos'}</Text></View>
            <TextInput value={form.cuenta?.password} onChangeText={(v) => setForm((f) => ({ ...f, cuenta: { username, email, password: v } }))} placeholder={editing ? 'Nueva contraseña (opcional)' : 'Contraseña (mínimo 8 caracteres)'} secureTextEntry className="bg-gray-100 rounded-xl px-3 py-3 flex-1 min-w-[180px]" />
          </View>

          <DocumentInput
            documents={documents}
            onChange={setDocuments}
            requiredTypes={[]}
            title="Documentos (PDF)"
            showRequiredBadge={false}
          />

          <TouchableOpacity onPress={save} disabled={saving} className="bg-maroon rounded-xl py-3 items-center mt-4">
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">{editing ? 'Guardar cambios' : 'Guardar usuario'}</Text>}
          </TouchableOpacity>
        </BentoCard>
      )}

      <BentoCard className="p-5">
        {loading && <ActivityIndicator color="#801529" />}
        {error && <Text className="text-red-600 mb-2">{error}</Text>}
        {(data?.data ?? []).map((u) => (
          <View key={u.id} className="flex-row items-center py-3 border-b border-gray-100">
            <View className="w-10 h-10 rounded-full bg-maroon/10 items-center justify-center mr-3">
              <Text className="text-maroon font-bold">{u.nombre.charAt(0)}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-gray-800">{u.nombre} {u.apellidoPaterno}</Text>
              <Text className="text-xs text-gray-500">{u.username ?? '—'} · {u.rol ?? `Rol ${u.rolId}`}</Text>
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => edit(u)}><Ionicons name="create-outline" size={20} color="#801529" /></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(u)}><Ionicons name="trash-outline" size={20} color="#DC2626" /></TouchableOpacity>
            </View>
          </View>
        ))}
        {!loading && !data?.data.length && <Text className="text-gray-500 text-center py-6">No hay usuarios para mostrar.</Text>}
      </BentoCard>
    </ScrollView>
  );
}