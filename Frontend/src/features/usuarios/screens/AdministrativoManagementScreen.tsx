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
import { BajaConfirmModal } from '../components/BajaConfirmModal';
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

  const handleAutoFillUsername = (
    nombre: string,
    paterno: string,
    materno: string,
    ci: string,
  ) => {
    if (!editingAdmin) {
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

    const ciDoc = adminDocs.find((d) => d.tipoDoc.toUpperCase() === 'CI');
    const hasCiFile = Boolean(ciDoc?.fileUri || ciDoc?.docUrl);
    if (!hasCiFile) {
      Alert.alert(
        '⚠️ Archivo Crítico CI Faltante',
        'No se ha adjuntado el archivo digital en PDF para la Cédula de Identidad (CI).\n\nEste documento es crítico para el expediente administrativo. ¿Desea guardarlo sin archivo digital o prefiere adjuntarlo ahora?',
        [
          { text: 'Adjuntar ahora', style: 'cancel' },
          { text: 'Guardar sin archivo', style: 'destructive', onPress: () => executeSaveAdmin() },
        ],
      );
      return;
    }

    await executeSaveAdmin();
  };

  const executeSaveAdmin = async () => {
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
    const nac = u.nacimiento ? String(u.nacimiento).slice(0, 10) : '';

    setForm({
      rolId: String(u.rolId),
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
    setAdminDocs(mappedDocs);
    setAdminPhoto(u.fotoUrl ?? undefined);

    setShowModal(true);
  };

  const handleToggleState = (u: Usuario) => {
    const nuevoEstado = u.estado === 1 ? 0 : 1;
    const accion = nuevoEstado === 0 ? 'Dar de baja' : 'Reactivar';

    Alert.alert(
      `${accion} personal`,
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

  const adminList = (data?.data ?? []).filter((u) => {
    const r = (u.rol || '').toLowerCase();
    return r === 'director' || r === 'gerencia' || r === 'control' || r === 'administrativo' || String(u.rolId) === '4' || String(u.rolId) === '1';
  });

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-12" showsVerticalScrollIndicator={false}>
      {/* Cabecera Bento */}
      <BentoCard className="p-5 bg-card border-l-4 border-maroon">
        <View className="flex-row items-center justify-between mb-4 flex-wrap gap-3">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <View className="w-9 h-9 rounded-xl bg-maroon/15 items-center justify-center">
                <Ionicons name="shield-outline" size={20} color="#7A1F3D" />
              </View>
              <Text className="text-2xl font-bold text-gray-900">Personal Administrativo</Text>
            </View>
            <Text className="text-gray-500 text-xs">
              Gestión de directores, control y personal administrativo institucional con Bento Grid y MinIO.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              resetForm();
              setShowModal(true);
            }}
            className="bg-maroon rounded-xl px-4 py-2.5 flex-row items-center gap-2 shadow"
          >
            <Ionicons name="person-add" color="#FFF" size={18} />
            <Text className="text-white font-bold text-xs">Registrar Administrativo</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 border border-gray-200">
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={refresh}
              placeholder="Buscar por nombre, CI o cargo..."
              className="flex-1 ml-2 text-gray-800 text-sm"
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity onPress={refresh} className="bg-maroon/10 rounded-xl px-4 justify-center items-center">
            <Ionicons name="refresh" size={18} color="#7A1F3D" />
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* Formulario / Modal en Bento Grid */}
      {showModal && (
        <BentoCard className="p-6 border border-gold/40 bg-white shadow-md">
          <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <View>
              <Text className="text-xl font-bold text-maroon">
                {editingAdmin ? 'Editar Personal Administrativo' : 'Registro de Personal Administrativo'}
              </Text>
              <Text className="text-xs text-gray-500">
                Información de control institucional, cargo y credenciales de acceso.
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} className="p-1">
              <Ionicons name="close-circle" size={26} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View className="gap-4">
            <BentoCard className="p-4 bg-cream/40 border border-gold/30">
              <Text className="text-xs font-bold text-maroon mb-2 uppercase">Fotografía Oficial (MinIO)</Text>
              <ProfilePhotoPicker photoUri={adminPhoto} onChange={setAdminPhoto} required={!editingAdmin} />
            </BentoCard>

            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Datos Personales y Cargo</Text>
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={form.nombre}
                  onChangeText={(v) => {
                    setForm((f) => ({ ...f, nombre: v }));
                    const ciDoc = adminDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                    handleAutoFillUsername(v, form.apellidoPaterno, form.apellidoMaterno, ciDoc);
                  }}
                  placeholder="Nombre *"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.apellidoPaterno}
                  onChangeText={(v) => {
                    setForm((f) => ({ ...f, apellidoPaterno: v }));
                    const ciDoc = adminDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                    handleAutoFillUsername(form.nombre, v, form.apellidoMaterno, ciDoc);
                  }}
                  placeholder="Apellido Paterno *"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.apellidoMaterno}
                  onChangeText={(v) => {
                    setForm((f) => ({ ...f, apellidoMaterno: v }));
                    const ciDoc = adminDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                    handleAutoFillUsername(form.nombre, form.apellidoPaterno, v, ciDoc);
                  }}
                  placeholder="Apellido Materno *"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[170px] border border-gray-200 text-sm"
                />
                <BirthDatePicker value={form.nacimiento} onChange={(v) => setForm((f) => ({ ...f, nacimiento: v }))} />
              </View>

              <View className="mt-3">
                <Text className="text-xs font-bold text-gray-700 mb-1.5">Cargo / Rol en el Sistema:</Text>
                <View className="flex-row gap-2">
                  {[
                    { id: '1', label: 'Director' },
                    { id: '4', label: 'Control / Gerencia' },
                  ].map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => setForm((f) => ({ ...f, rolId: r.id }))}
                      className={`px-4 py-2 rounded-xl border ${
                        form.rolId === r.id ? 'bg-maroon border-maroon' : 'bg-white border-gray-300'
                      }`}
                    >
                      <Text className={`text-xs font-bold ${form.rolId === r.id ? 'text-white' : 'text-gray-700'}`}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </BentoCard>

            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <DocumentInput
                documents={adminDocs}
                onChange={(docs) => {
                  setAdminDocs(docs);
                  const ciDoc = docs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                  handleAutoFillUsername(form.nombre, form.apellidoPaterno, form.apellidoMaterno, ciDoc);
                }}
                requiredTypes={ADMIN_REQUIRED_DOCS}
                title="Documentación Requerida (PDF)"
                showRequiredBadge={true}
              />
            </BentoCard>

            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Credenciales de Acceso</Text>
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={form.username}
                  onChangeText={(v) => setForm((f) => ({ ...f, username: v }))}
                  placeholder="Nombre de Usuario *"
                  autoCapitalize="none"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.email}
                  onChangeText={(v) => setForm((f) => ({ ...f, email: v }))}
                  placeholder="Correo Institucional *"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.password}
                  onChangeText={(v) => setForm((f) => ({ ...f, password: v }))}
                  placeholder={editingAdmin ? 'Nueva Contraseña (Opcional)' : 'Contraseña (Mín. 8 caract.) *'}
                  secureTextEntry
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                />
              </View>
            </BentoCard>

            <BentoCard className="p-4 bg-gray-50 border border-gray-200">
              <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Contacto y Domicilio</Text>
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  value={form.celular}
                  onChangeText={(v) => setForm((f) => ({ ...f, celular: v }))}
                  placeholder="Celular de contacto"
                  keyboardType="phone-pad"
                  className="bg-white rounded-xl px-3 py-2.5 flex-1 min-w-[150px] border border-gray-200 text-sm"
                />
                <TextInput
                  value={form.zona}
                  onChangeText={(v) => setForm((f) => ({ ...f, zona: v }))}
                  placeholder="Zona"
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
              onPress={handleSaveAdmin}
              disabled={saving}
              className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
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

      {/* GRID DE CARTAS BENTO PARA ADMINISTRATIVOS */}
      <View className="gap-3">
        <View className="flex-row justify-between items-center px-1">
          <Text className="text-base font-bold text-gray-900">
            Nómina de Personal Administrativo ({adminList.length})
          </Text>
          {loading && <ActivityIndicator color="#7A1F3D" />}
        </View>

        {error && <Text className="text-red-600 text-xs">{error}</Text>}

        <View className="flex-row flex-wrap gap-4">
          {adminList.map((adm) => {
            const docs = adm.documentos ?? [];
            const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ??
              (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
            const apPat = adm.apellidoPaterno || (adm as any).apellido_paterno || '';
            const apMat = adm.apellidoMaterno || (adm as any).apellido_materno || '';
            const admFullName = getFullName(adm.nombre, apPat, apMat);
            const cargo = adm.rol ?? `Rol ${adm.rolId}`;
            const celular = adm.contactos?.[0]?.contenido || '';

            return (
              <BentoCard
                key={adm.id}
                className="w-full md:w-[48%] lg:w-[31.5%] p-5 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between"
              >
                {/* Cabecera con Foto MinIO y estado */}
                <View>
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="relative">
                      {adm.fotoUrl ? (
                        <RemoteImage
                          uri={adm.fotoUrl}
                          className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-maroon/20"
                          fallbackText={`${adm.nombre?.charAt(0) || 'A'}${apPat?.charAt(0) || ''}`}
                        />
                      ) : (
                        <View className="w-16 h-16 rounded-2xl bg-maroon/10 border-2 border-maroon/20 items-center justify-center">
                          <Text className="text-maroon font-bold text-xl">
                            {adm.nombre?.charAt(0) || 'A'}{apPat?.charAt(0) || ''}
                          </Text>
                        </View>
                      )}
                    </View>

                    <StatusBadge status={adm.estado} />
                  </View>

                  {/* Datos del administrativo */}
                  <Text className="font-bold text-gray-900 text-base" numberOfLines={2}>
                    {admFullName}
                  </Text>
                  <Text className="text-xs font-mono text-maroon mt-0.5">
                    @{adm.username || 'sin-cuenta'}
                  </Text>

                  {/* Píldoras Bento de cargo y CI */}
                  <View className="flex-row flex-wrap gap-1.5 mt-3">
                    <View className="bg-maroon/10 px-2.5 py-1 rounded-lg border border-maroon/20">
                      <Text className="text-xs font-bold text-maroon">{cargo}</Text>
                    </View>
                    <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                      <Text className="text-xs text-gray-700 font-mono">CI: {ciDoc}</Text>
                    </View>
                  </View>

                  {/* Contacto rápido */}
                  <View className="mt-3 pt-3 border-t border-gray-100 gap-1">
                    {adm.email ? (
                      <View className="flex-row items-center gap-1.5">
                        <Ionicons name="mail-outline" size={13} color="#9CA3AF" />
                        <Text className="text-xs text-gray-500" numberOfLines={1}>
                          {adm.email}
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
                <View className="flex-row items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                  <TouchableOpacity
                    onPress={() => handleEdit(adm)}
                    className="p-2 bg-gray-100 hover:bg-maroon/10 rounded-xl flex-row items-center gap-1.5"
                  >
                    <Ionicons name="create-outline" size={16} color="#7A1F3D" />
                    <Text className="text-xs font-bold text-maroon">Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleToggleState(adm)}
                    className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1"
                  >
                    <Ionicons
                      name={adm.estado === 1 ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={adm.estado === 1 ? '#DC2626' : '#16A34A'}
                    />
                    <Text
                      className={`text-xs font-semibold ${
                        adm.estado === 1 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {adm.estado === 1 ? 'Baja' : 'Activar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </BentoCard>
            );
          })}
        </View>

        {!loading && adminList.length === 0 && (
          <BentoCard className="p-8 items-center bg-white">
            <Ionicons name="shield-outline" size={36} color="#9CA3AF" />
            <Text className="text-gray-500 text-center mt-2 text-sm">
              No se encontró personal administrativo registrado.
            </Text>
          </BentoCard>
        )}
      </View>
    </ScrollView>
  );
}