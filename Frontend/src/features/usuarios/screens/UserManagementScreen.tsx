import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

function InlineInput({ error, className = '', ...props }: ComponentProps<typeof TextInput> & { error?: string }) {
  return <View className="flex-1 min-w-[180px]"><TextInput {...props} className={`bg-gray-100 rounded-xl px-3 py-3 border ${error ? 'border-red-500' : 'border-gray-200'} ${className}`} />{error ? <Text className="text-xs text-red-600 mt-1">{error}</Text> : null}</View>;
}

export function UserManagementScreen() {
  const { data, loading, error, fetchList } = useUsuariosList();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CreateUsuarioPayload>(empty);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fotoUri, setFotoUri] = useState<string | undefined>();
  const [documents, setDocuments] = useState<UsuarioDoc[]>([{ tipoDoc: 'DNI', numeroDoc: '' }]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [listTab, setListTab] = useState<'enabled' | 'disabled'>('enabled');
  const refresh = () => fetchList({ buscar: search, limit: 50 }).catch(() => undefined);
  useEffect(() => { refresh(); return connectUsersWebSocket(refresh); }, []);

  const currentCi = documents.find((d) => d.tipoDoc === 'CI' || d.tipoDoc === 'DNI')?.numeroDoc ?? '';
  const username = form.cuenta?.username || (form.nombre && form.apellidoPaterno
    ? generateUsername(form.nombre, form.apellidoPaterno, form.apellidoMaterno ?? '', currentCi) : '');
  const email = form.cuenta?.email || (username ? generateStudentEmail(username) : '');
  const setField = (key: keyof CreateUsuarioPayload, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const clearFieldError = (field: string) => setFieldErrors((current) => {
    const { [field]: _, ...remaining } = current;
    return remaining;
  });

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.nombre.trim()) errors.nombre = 'El nombre es obligatorio.';
    if (!form.apellidoPaterno.trim()) errors.apellidoPaterno = 'El apellido paterno es obligatorio.';
    if (!form.apellidoMaterno?.trim()) errors.apellidoMaterno = 'El apellido materno es obligatorio.';
    if (!form.nacimiento) errors.nacimiento = 'La fecha de nacimiento es obligatoria.';
    const ci = documents.find((doc) => ['CI', 'DNI'].includes(doc.tipoDoc.toUpperCase()));
    if (!ci?.numeroDoc.trim()) errors[`documento:${ci?.tipoDoc?.toUpperCase() || 'CI'}`] = 'El número de documento es obligatorio.';
    if (!editing && !form.cuenta?.password) errors.password = 'La contraseña es obligatoria.';
    else if (!editing && (form.cuenta?.password?.length ?? 0) < 8) errors.password = 'Debe tener al menos 8 caracteres.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    if (!editing && !fotoUri) {
      Alert.alert('Foto requerida', 'Debe subir la foto de perfil (PNG/JPG).'); return;
    }

    const ciDoc = documents.find((d) => d.tipoDoc.toUpperCase() === 'CI');
    const hasCiFile = Boolean(ciDoc?.fileUri || ciDoc?.docUrl);
    if (ciDoc && !hasCiFile) {
      Alert.alert(
        '⚠️ Archivo Crítico CI Faltante',
        'No se ha adjuntado el archivo digital en PDF para la Cédula de Identidad (CI).\n\n¿Desea guardarlo sin archivo digital o prefiere adjuntarlo ahora?',
        [
          { text: 'Adjuntar ahora', style: 'cancel' },
          { text: 'Guardar sin archivo', style: 'destructive', onPress: () => executeSave() },
        ],
      );
      return;
    }
    await executeSave();
  };

  const executeSave = async () => {
    setSaving(true);
    try {
      const account = form.cuenta?.password ? { username, email, password: form.cuenta.password } : undefined;
      const datos = { ...form, cuenta: account, documentos: documents };
      if (editing) await usuariosApi.updateWithFiles(editing.id, datos as UpdateUsuarioPayload, fotoUri);
      else await usuariosApi.createWithFiles(datos, fotoUri);
      setForm(empty); setEditing(null); setFotoUri(undefined); setDocuments([{ tipoDoc: 'CI', numeroDoc: '' }]); setShowForm(false); refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error del servidor';
      const normalized = message.toLowerCase();
      const errors: Record<string, string> = {};
      if (/usuario|username/.test(normalized)) errors.username = 'Este nombre de usuario ya está registrado.';
      if (/correo|email/.test(normalized)) errors.email = 'Este correo ya está registrado.';
      if (/documento|numero_doc/.test(normalized)) errors['documento:CI'] = 'Este documento ya está registrado.';
      if (Object.keys(errors).length) setFieldErrors(errors);
      else Alert.alert('No se pudo guardar', message);
    }
    finally { setSaving(false); }
  };

  const edit = (u: Usuario) => {
    setEditing(u); setFotoUri(u.fotoUrl ?? undefined);
    setForm({
      rolId: String(u.rolId),
      nombre: u.nombre ?? '',
      apellidoPaterno: u.apellidoPaterno || (u as any).apellido_paterno || '',
      apellidoMaterno: u.apellidoMaterno || (u as any).apellido_materno || '',
      nacimiento: u.nacimiento ? String(u.nacimiento).slice(0, 10) : '',
      estado: u.estado,
      cuenta: { username: u.username ?? '', email: u.email ?? '', password: '' },
      documentos: u.documentos ?? [{ tipoDoc: 'CI', numeroDoc: '' }],
      direccion: u.direccion ?? undefined,
      contactos: u.contactos ?? []
    });
    const mappedDocs: UsuarioDoc[] = (u.documentos ?? []).map((d) => ({
      id: d.id, tipoDoc: d.tipoDoc || (d as any).tipo_doc, numeroDoc: d.numeroDoc || (d as any).numero_doc,
      docUrl: d.docUrl, fileUri: undefined, fileName: undefined,
    }));
    if (!mappedDocs.some((d) => d.tipoDoc.toUpperCase() === 'CI')) {
      mappedDocs.unshift({ tipoDoc: 'CI', numeroDoc: '' });
    }
    setDocuments(mappedDocs);
    setShowForm(true);
  };

  const remove = (u: Usuario) => Alert.alert('Eliminar usuario', `¿Eliminar a ${u.nombre}?`, [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: async () => { await usuariosApi.delete(u.id); refresh(); } },
  ]);

  const enabledUsers = useMemo(() => (data?.data ?? []).filter((u) => u.estado === 1 || u.estado === 'activo'), [data]);
  const disabledUsers = useMemo(() => (data?.data ?? []).filter((u) => u.estado !== 1 && u.estado !== 'activo'), [data]);
  const visibleUsers = listTab === 'enabled' ? enabledUsers : disabledUsers;

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Gestión de usuarios</Text>
            <Text className="text-gray-500 text-sm">CRUD conectado a RestApi</Text>
          </View>
          <TouchableOpacity onPress={() => { setEditing(null); setForm(empty); setFotoUri(undefined); setDocuments([{ tipoDoc: 'DNI', numeroDoc: '' }]); setFieldErrors({}); setShowForm(!showForm); }} className="bg-maroon rounded-xl px-4 py-3 flex-row items-center gap-2">
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
              <InlineInput key={key} value={form[key] as string} onChangeText={(v) => { clearFieldError(key); setField(key, v); }} placeholder={label} error={fieldErrors[key]} />
            ))}
            <View className="flex-1 min-w-[180px]"><BirthDatePicker value={form.nacimiento} onChange={(v) => { clearFieldError('nacimiento'); setField('nacimiento', v); }} />{fieldErrors.nacimiento ? <Text className="text-xs text-red-600 mt-1">{fieldErrors.nacimiento}</Text> : null}</View>
            <View className="bg-gray-100 rounded-xl px-3 py-2 flex-1 min-w-[180px]"><Text className="text-xs text-gray-500">Nombre de usuario</Text><Text className="text-gray-800">{username || 'Complete sus datos'}</Text>{fieldErrors.username ? <Text className="text-xs text-red-600 mt-1">{fieldErrors.username}</Text> : null}</View>
            <View className="bg-gray-100 rounded-xl px-3 py-2 flex-1 min-w-[180px]"><Text className="text-xs text-gray-500">Correo electrónico</Text><Text className="text-gray-800">{email || 'Complete sus datos'}</Text>{fieldErrors.email ? <Text className="text-xs text-red-600 mt-1">{fieldErrors.email}</Text> : null}</View>
            <InlineInput value={form.cuenta?.password} onChangeText={(v) => { clearFieldError('password'); setForm((f) => ({ ...f, cuenta: { username, email, password: v } })); }} placeholder={editing ? 'Nueva contraseña (opcional)' : 'Contraseña (mínimo 8 caracteres)'} secureTextEntry error={fieldErrors.password} />
          </View>

          <DocumentInput
            documents={documents}
            onChange={setDocuments}
            requiredTypes={[]}
            title="Documentos (PDF)"
            showRequiredBadge={false}
            fieldErrors={fieldErrors}
          />

          <TouchableOpacity onPress={save} disabled={saving} className="bg-maroon rounded-xl py-3 items-center mt-4">
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">{editing ? 'Guardar cambios' : 'Guardar usuario'}</Text>}
          </TouchableOpacity>
        </BentoCard>
      )}

      <BentoCard className="p-5">
        <View className="flex-row gap-2 mb-4 p-1 bg-gray-100 rounded-xl self-start">
          <TouchableOpacity onPress={() => setListTab('enabled')} className={`px-4 py-2 rounded-lg ${listTab === 'enabled' ? 'bg-maroon' : ''}`}><Text className={`font-bold text-xs ${listTab === 'enabled' ? 'text-white' : 'text-gray-600'}`}>Habilitados ({enabledUsers.length})</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setListTab('disabled')} className={`px-4 py-2 rounded-lg ${listTab === 'disabled' ? 'bg-maroon' : ''}`}><Text className={`font-bold text-xs ${listTab === 'disabled' ? 'text-white' : 'text-gray-600'}`}>Deshabilitados ({disabledUsers.length})</Text></TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color="#801529" />}
        {error && <Text className="text-red-600 mb-2">{error}</Text>}
        {visibleUsers.map((u) => (
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
        {!loading && !visibleUsers.length && <Text className="text-gray-500 text-center py-6">No hay usuarios {listTab === 'enabled' ? 'habilitados' : 'deshabilitados'} para mostrar.</Text>}
      </BentoCard>
    </ScrollView>
  );
}
