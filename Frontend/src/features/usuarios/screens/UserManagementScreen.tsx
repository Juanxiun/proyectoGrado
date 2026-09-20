import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { Pagination } from '../../../displays/components/Pagination';
import { RemoteImage } from '../../../displays/components/RemoteImage';
import { ConfirmDeleteModal } from '../../../displays/components/ConfirmDeleteModal';
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
  return (
    <View className="flex-1 min-w-[180px]">
      <TextInput
        {...props}
        className={`bg-gray-100 rounded-xl px-3 py-3 border ${error ? 'border-red-500' : 'border-gray-200'} ${className}`}
      />
      {error ? <Text className="text-xs text-red-600 mt-1">{error}</Text> : null}
    </View>
  );
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
  const [deletingUser, setDeletingUser] = useState<Usuario | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = () => fetchList({ buscar: search, limit: 100 }).catch(() => undefined);
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

  const remove = (u: Usuario) => {
    setDeletingUser(u);
  };

  const handleConfirmDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      await usuariosApi.delete(deletingUser.id);
      setDeletingUser(null);
      refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo eliminar el usuario.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const enabledUsers = useMemo(() => (data?.data ?? []).filter((u) => u.estado === 1 || u.estado === 'activo'), [data]);
  const disabledUsers = useMemo(() => (data?.data ?? []).filter((u) => u.estado !== 1 && u.estado !== 'activo'), [data]);
  const currentList = listTab === 'enabled' ? enabledUsers : disabledUsers;

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return currentList.slice(start, start + pageSize);
  }, [currentList, currentPage, pageSize]);

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between mb-4 flex-wrap gap-2">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Gestión de usuarios</Text>
            <Text className="text-gray-500 text-sm">CRUD integral conectado a RestApi y almacenamiento MinIO</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setEditing(null);
              setForm(empty);
              setFotoUri(undefined);
              setDocuments([{ tipoDoc: 'CI', numeroDoc: '' }]);
              setFieldErrors({});
              setShowForm(true);
            }}
            className="bg-maroon rounded-xl px-4 py-3 flex-row items-center gap-2 shadow"
          >
            <Ionicons name="person-add" color="#fff" size={18} />
            <Text className="text-white font-semibold">Nuevo Usuario</Text>
          </TouchableOpacity>
        </View>
        <View className="flex-row gap-2">
          <TextInput
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            onSubmitEditing={refresh}
            placeholder="Buscar por nombre o usuario"
            className="bg-gray-100 rounded-xl px-4 py-3 flex-1 text-sm"
          />
          <TouchableOpacity onPress={refresh} className="bg-gray-100 rounded-xl px-4 justify-center">
            <Ionicons name="search" size={20} color="#801529" />
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* Modal Dialog Overlay para Crear/Editar Usuario */}
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
                  {editing ? 'Editar Ficha de Usuario' : 'Registro de Nuevo Usuario'}
                </Text>
                <Text className="text-xs text-white/80 mt-0.5">
                  Información de identidad, credenciales y documentación en formato digital.
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
              <ProfilePhotoPicker photoUri={fotoUri} onChange={setFotoUri} required={!editing} />

              <View className="flex-row flex-wrap gap-2">
                {([['nombre', 'Nombre *'], ['apellidoPaterno', 'Apellido paterno *'], ['apellidoMaterno', 'Apellido materno *']] as const).map(([key, label]) => (
                  <InlineInput
                    key={key}
                    value={form[key] as string}
                    onChangeText={(v) => { clearFieldError(key); setField(key, v); }}
                    placeholder={label}
                    error={fieldErrors[key]}
                  />
                ))}
                <View className="flex-1 min-w-[180px]">
                  <BirthDatePicker
                    value={form.nacimiento}
                    onChange={(v) => { clearFieldError('nacimiento'); setField('nacimiento', v); }}
                  />
                  {fieldErrors.nacimiento ? <Text className="text-xs text-red-600 mt-1">{fieldErrors.nacimiento}</Text> : null}
                </View>
                <View className="bg-gray-100 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
                  <Text className="text-xs text-gray-500">Nombre de usuario</Text>
                  <Text className="text-gray-800 font-mono">{username || 'Complete sus datos'}</Text>
                  {fieldErrors.username ? <Text className="text-xs text-red-600 mt-1">{fieldErrors.username}</Text> : null}
                </View>
                <View className="bg-gray-100 rounded-xl px-3 py-2 flex-1 min-w-[180px]">
                  <Text className="text-xs text-gray-500">Correo electrónico</Text>
                  <Text className="text-gray-800">{email || 'Complete sus datos'}</Text>
                  {fieldErrors.email ? <Text className="text-xs text-red-600 mt-1">{fieldErrors.email}</Text> : null}
                </View>
                <InlineInput
                  value={form.cuenta?.password}
                  onChangeText={(v) => { clearFieldError('password'); setForm((f) => ({ ...f, cuenta: { username, email, password: v } })); }}
                  placeholder={editing ? 'Nueva contraseña (opcional)' : 'Contraseña (mínimo 8 caracteres)'}
                  secureTextEntry
                  error={fieldErrors.password}
                />
              </View>

              <DocumentInput
                documents={documents}
                onChange={setDocuments}
                requiredTypes={[]}
                title="Documentos (PDF)"
                showRequiredBadge={false}
                fieldErrors={fieldErrors}
              />

              <TouchableOpacity
                onPress={save}
                disabled={saving}
                className="bg-maroon rounded-xl py-3.5 items-center justify-center flex-row gap-2 shadow mt-2"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text className="text-white font-bold">{editing ? 'Guardar cambios' : 'Guardar usuario'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <BentoCard className="p-5">
        <View className="flex-row gap-2 mb-4 p-1 bg-gray-100 rounded-xl self-start">
          <TouchableOpacity
            onPress={() => {
              setListTab('enabled');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg ${listTab === 'enabled' ? 'bg-maroon' : ''}`}
          >
            <Text className={`font-bold text-xs ${listTab === 'enabled' ? 'text-white' : 'text-gray-600'}`}>
              Habilitados ({enabledUsers.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setListTab('disabled');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg ${listTab === 'disabled' ? 'bg-maroon' : ''}`}
          >
            <Text className={`font-bold text-xs ${listTab === 'disabled' ? 'text-white' : 'text-gray-600'}`}>
              Deshabilitados ({disabledUsers.length})
            </Text>
          </TouchableOpacity>
        </View>
        {loading && <ActivityIndicator color="#801529" />}
        {error && <Text className="text-red-600 mb-2">{error}</Text>}

        {paginatedUsers.length > 0 ? (
          <>
            <View className="flex-row flex-wrap gap-4">
              {paginatedUsers.map((u) => {
                const isOnline = u.estado === 1 || u.estado === 'activo';
                const apPat = u.apellidoPaterno || (u as any).apellido_paterno || '';
                const apMat = u.apellidoMaterno || (u as any).apellido_materno || '';
                const docs = u.documentos ?? [];
                const ciDoc = docs.find((d) => ['CI', 'DNI'].includes((d.tipoDoc || (d as any).tipo_doc || '').toUpperCase()))?.numeroDoc ??
                  (docs[0]?.numeroDoc || (docs[0] as any)?.numero_doc) ?? '';

                return (
                  <BentoCard
                    key={u.id}
                    className="w-full md:w-[48%] lg:w-[31.5%] p-5 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between"
                  >
                    <View>
                      {/* Avatar 80px con anillo y estado */}
                      <View className="flex-row items-start justify-between mb-3">
                        <View className="relative">
                          {u.fotoUrl ? (
                            <RemoteImage
                              uri={u.fotoUrl}
                              className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-gold/40 shadow-sm"
                              fallbackText={`${u.nombre?.charAt(0) || 'U'}${apPat?.charAt(0) || ''}`}
                            />
                          ) : (
                            <View className="w-20 h-20 rounded-2xl bg-maroon border-2 border-gold/40 items-center justify-center shadow-sm">
                              <Text className="text-gold font-serif font-bold text-2xl">
                                {u.nombre?.charAt(0) || 'U'}{apPat?.charAt(0) || ''}
                              </Text>
                            </View>
                          )}
                          <View
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                              isOnline ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          />
                        </View>
                        <StatusBadge status={u.estado} />
                      </View>

                      {/* Información de usuario */}
                      <Text className="font-bold text-gray-900 text-base" numberOfLines={2}>
                        {u.nombre} {apPat} {apMat}
                      </Text>
                      <Text className="text-xs font-mono text-maroon mt-0.5">
                        @{u.username || 'sin-cuenta'}
                      </Text>

                      {/* Rol y CI */}
                      <View className="flex-row flex-wrap gap-1.5 mt-3">
                        <View className="bg-maroon/10 px-2.5 py-1 rounded-lg border border-maroon/20">
                          <Text className="text-xs font-bold text-maroon">{u.rol ?? `Rol ${u.rolId}`}</Text>
                        </View>
                        {ciDoc ? (
                          <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                            <Text className="text-xs text-gray-700 font-mono">Doc: {ciDoc}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Email */}
                      {u.email ? (
                        <View className="mt-3 pt-3 border-t border-gray-100 flex-row items-center gap-1.5">
                          <Ionicons name="mail-outline" size={13} color="#9CA3AF" />
                          <Text className="text-xs text-gray-500" numberOfLines={1}>{u.email}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Acciones Rápidas */}
                    <View className="flex-row items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                      <TouchableOpacity
                        onPress={() => edit(u)}
                        className="p-2 bg-gray-100 hover:bg-maroon/10 rounded-xl flex-row items-center gap-1.5"
                      >
                        <Ionicons name="create-outline" size={16} color="#7A1F3D" />
                        <Text className="text-xs font-bold text-maroon">Editar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => remove(u)}
                        className="p-2 bg-red-50 hover:bg-red-100 rounded-xl flex-row items-center gap-1"
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                        <Text className="text-xs font-bold text-red-600">Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  </BentoCard>
                );
              })}
            </View>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(currentList.length / pageSize)}
              totalRecords={currentList.length}
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
          <Text className="text-gray-500 text-center py-8">
            No hay usuarios {listTab === 'enabled' ? 'habilitados' : 'deshabilitados'} para mostrar.
          </Text>
        )}
      </BentoCard>

      <ConfirmDeleteModal
        visible={Boolean(deletingUser)}
        title="Eliminar usuario"
        itemName={deletingUser ? `${deletingUser.nombre} ${deletingUser.apellidoPaterno || ''}`.trim() : undefined}
        message="¿Está seguro de que desea eliminar permanentemente a este usuario y sus credenciales de acceso?"
        warningNote="Esta acción borrará de forma permanente los registros y archivos relacionados."
        loading={deleteLoading}
        onCancel={() => setDeletingUser(null)}
        onConfirm={handleConfirmDeleteUser}
      />
    </ScrollView>
  );
}
