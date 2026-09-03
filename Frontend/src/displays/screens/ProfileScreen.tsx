import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useUsuarioDetail, useUsuarioUpdate } from '../../hooks/useUsuarios';
import { BentoCard } from '../components/BentoCard';
import { BirthDatePicker } from '../../features/usuarios/components/BirthDatePicker';
import { DocumentInput } from '../../features/usuarios/components/DocumentInput';
import { ProfilePhotoPicker } from '../../features/usuarios/components/ProfilePhotoPicker';
import type { Genero, UsuarioCont, UsuarioDoc, Usuario } from '../../types';

const GENEROS: Genero[] = ['masculino', 'femenino', 'otro'];

export function ProfileScreen() {
  const { user, updateLocalUser, logout } = useAuth();
  const { usuario, loading: loadingDetail, fetchById } = useUsuarioDetail();
  const { loading: saving, update, updateWithFiles } = useUsuarioUpdate();
  const [form, setForm] = useState({
    nombre: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    nacimiento: '',
    genero: 'otro' as Genero,
    username: '',
    email: '',
    celular: '',
    whatsapp: '',
    zona: '',
    distrito: '',
    calle: '',
    referencia: '',
    password: '',
  });
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [documents, setDocuments] = useState<UsuarioDoc[]>([]);
  const [showCompleteAlert, setShowCompleteAlert] = useState(false);

  const setField = (key: keyof typeof form) => (value: string) =>
    setForm((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    if (user?.id) void fetchById(user.id);
  }, [user?.id, fetchById]);

  useEffect(() => {
    if (!usuario) return;
    const contact = (type: UsuarioCont['tipo']) =>
      usuario.contactos?.find((c) => c.tipo === type)?.contenido ?? '';
    const rawNac: unknown = usuario.nacimiento;
    let nac = '';
    if (typeof rawNac === 'string' && rawNac) {
      nac = rawNac.includes('T') ? rawNac.split('T')[0] : rawNac.slice(0, 10);
    } else if (rawNac && typeof rawNac === 'object' && 'toISOString' in (rawNac as any)) {
      nac = (rawNac as any).toISOString().slice(0, 10);
    }

    const initialDocs: UsuarioDoc[] = (usuario.documentos ?? []).map((d) => ({
      id: d.id,
      tipoDoc: d.tipoDoc || (d as any).tipo_doc,
      numeroDoc: d.numeroDoc || (d as any).numero_doc,
      docUrl: d.docUrl,
      fileUri: undefined,
      fileName: undefined,
    }));

    setForm({
      nombre: usuario.nombre ?? '',
      apellidoPaterno: usuario.apellidoPaterno ?? '',
      apellidoMaterno: usuario.apellidoMaterno ?? '',
      nacimiento: nac,
      genero: (usuario.genero as Genero) ?? 'otro',
      username: usuario.cuenta?.username ?? usuario.username ?? '',
      email: usuario.cuenta?.email ?? usuario.email ?? '',
      celular: contact('Celular'),
      whatsapp: contact('Whatsapp'),
      zona: usuario.direccion?.zona ?? '',
      distrito: usuario.direccion?.distrito ?? '',
      calle: usuario.direccion?.calle ?? '',
      referencia: usuario.direccion?.referencia ?? '',
      password: '',
    });
    setDocuments(initialDocs);
    setShowCompleteAlert(!editMode && initialDocs.length === 0 && user?.rol?.toLowerCase() !== 'estudiante');
  }, [usuario]);

  const missing = useMemo(() => {
    const base = [
      !form.nombre && 'Nombre',
      !form.apellidoPaterno && 'Apellido paterno',
      !form.apellidoMaterno && 'Apellido materno',
      !form.nacimiento && 'Fecha de nacimiento',
      !form.email && 'Correo',
      !form.celular && 'Celular',
      !form.zona && 'Dirección (zona)',
    ].filter(Boolean) as string[];
    if (user?.rol?.toLowerCase() !== 'estudiante' && documents.length === 0) {
      base.push('Documento de identidad');
    }
    return base;
  }, [form, documents, user?.rol]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setFotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (missing.length > 0) {
      Alert.alert('Campos incompletos', `Complete: ${missing.join(', ')}`);
      return;
    }

    const contactos = [
      { tipo: 'Celular' as const, contenido: form.celular },
      { tipo: 'Whatsapp' as const, contenido: form.whatsapp },
    ].filter((c) => c.contenido);

    const payload = {
      nombre: form.nombre,
      apellidoPaterno: form.apellidoPaterno,
      apellidoMaterno: form.apellidoMaterno,
      nacimiento: form.nacimiento,
      genero: form.genero,
      cuenta: {
        username: form.username,
        email: form.email,
        ...(form.password ? { password: form.password } : {}),
      },
      contactos,
      direccion: form.zona
        ? {
            zona: form.zona,
            distrito: form.distrito || null,
            calle: form.calle || null,
            referencia: form.referencia || null,
          }
        : undefined,
      documentos: documents,
    };

    try {
      const result = fotoUri || documents.some((d) => d.fileUri)
        ? await updateWithFiles(user.id, payload as any, fotoUri || undefined)
        : await update(user.id, payload as any);

      updateLocalUser({
        nombre: form.nombre,
        apellidoPaterno: form.apellidoPaterno,
        apellidoMaterno: form.apellidoMaterno,
        username: form.username,
        email: form.email,
        fotoUrl: result.fotoUrl ?? user.fotoUrl,
      });
      setFotoUri(null);
      setField('password')('');
      setEditMode(false);
      setShowCompleteAlert(false);
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
      void fetchById(user.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al actualizar';
      Alert.alert('No se pudo actualizar', msg);
    }
  };

  const canEditDocuments = user?.rol?.toLowerCase() !== 'estudiante';

  if (loadingDetail && !usuario) {
    return (
      <View className="flex-1 items-center justify-center py-20 bg-gray-50">
        <ActivityIndicator size="large" color="#7A1F3D" />
      </View>
    );
  }

  const photo = fotoUri ?? usuario?.fotoUrl ?? user?.fotoUrl;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 p-4 pb-8">
      {showCompleteAlert && canEditDocuments && (
        <BentoCard className="border-l-4 border-amber-400 bg-amber-50">
          <View className="flex-row items-start gap-3">
            <Ionicons name="alert-circle-outline" size={24} color="#B45309" />
            <View className="flex-1">
              <Text className="font-bold text-amber-900">Documentos pendientes</Text>
              <Text className="text-sm text-amber-800 mt-1">
                No tienes documentos registrados. Para completar tu perfil, sube al menos tu documento de identidad (CI/DNI) en formato PDF.
              </Text>
              <TouchableOpacity
                onPress={() => setEditMode(true)}
                className="mt-2 flex-row items-center gap-1 bg-amber-100 px-3 py-2 rounded-lg self-start"
              >
                <Ionicons name="document-attach-outline" size={16} color="#B45309" />
                <Text className="text-sm font-semibold text-amber-900">Agregar documentos</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowCompleteAlert(false)} className="mt-1">
              <Ionicons name="close" size={20} color="#B45309" />
            </TouchableOpacity>
          </View>
        </BentoCard>
      )}

      <View className="gap-4 md:flex-row">
        <BentoCard className="p-5 md:flex-1 bg-maroon">
          <View className="items-center">
            <TouchableOpacity onPress={pickImage} className="relative">
              {photo ? (
                <Image source={{ uri: photo }} className="w-28 h-28 rounded-full border-4 border-white/30" />
              ) : (
                <View className="w-28 h-28 rounded-full bg-white/15 items-center justify-center">
                  <Text className="text-white text-4xl font-bold">
                    {form.nombre?.charAt(0) || user?.nombre?.charAt(0) || 'U'}
                  </Text>
                </View>
              )}
              {editMode && (
                <View className="absolute bottom-0 right-0 w-9 h-9 bg-white rounded-full items-center justify-center">
                  <Ionicons name="camera" size={17} color="#7A1F3D" />
                </View>
              )}
            </TouchableOpacity>
            <Text className="text-white text-xl font-bold mt-4 text-center">
              {form.nombre && form.apellidoPaterno
                ? `${form.nombre} ${form.apellidoPaterno} ${form.apellidoMaterno || ''}`.trim()
                : user?.nombre ? `${user.nombre} ${user.apellidoPaterno || ''}`.trim() : 'Usuario'}
            </Text>
            <Text className="text-white/70 text-sm mt-1">@{form.username || user?.username}</Text>
            <Text className="text-white/60 text-xs mt-3 uppercase">
              {usuario?.rol ?? user?.rol ?? 'Usuario'} · ID {user?.id}
            </Text>
          </View>
        </BentoCard>

        <BentoCard className="p-5 md:flex-[2]">
          <View className="flex-row items-center gap-3 mb-4">
            <View className={`w-10 h-10 rounded-xl items-center justify-center ${missing.length ? 'bg-amber-100' : 'bg-green-100'}`}>
              <Ionicons name={missing.length ? 'alert-circle' : 'checkmark-circle'} size={23} color={missing.length ? '#B45309' : '#16A34A'} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900">
                {missing.length ? 'Completa tu información' : 'Información completa'}
              </Text>
              <Text className="text-sm text-gray-500">
                {missing.length ? `Faltan: ${missing.join(', ')}.` : 'Tu perfil está listo y actualizado.'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setEditMode(!editMode)}
              className={`px-4 py-2 rounded-xl flex-row items-center gap-2 ${editMode ? 'bg-gray-200' : 'bg-maroon'}`}
            >
              <Ionicons name={editMode ? 'close' : 'create-outline'} size={18} color={editMode ? '#7A1F3D' : '#FFF'} />
              <Text className={`text-sm font-semibold ${editMode ? 'text-gray-700' : 'text-white'}`}>
                {editMode ? 'Cancelar' : 'Editar'}
              </Text>
            </TouchableOpacity>
          </View>

          {editMode ? (
            <>
              <View className="gap-4 md:flex-row md:flex-wrap mb-4">
                <Field label="Nombre" value={form.nombre} onChangeText={setField('nombre')} container="md:w-[31%]" required />
                <Field label="Apellido paterno" value={form.apellidoPaterno} onChangeText={setField('apellidoPaterno')} container="md:w-[31%]" required />
                <Field label="Apellido materno" value={form.apellidoMaterno} onChangeText={setField('apellidoMaterno')} container="md:w-[31%]" required />
                <View className="md:w-[31%]">
  <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5 flex-row items-center gap-1">
    Fecha de nacimiento <Text className="text-red-500">*</Text>
  </Text>
  <BirthDatePicker value={form.nacimiento} onChange={setField('nacimiento')} placeholder="Fecha nacimiento *" />
</View>
              </View>

              <View className="md:w-[31%] mb-4">
                <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Género</Text>
                <View className="flex-row gap-2">
                  {GENEROS.map((item) => (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setForm((old) => ({ ...old, genero: item }))}
                      className={`flex-1 rounded-xl py-3 items-center ${form.genero === item ? 'bg-maroon' : 'bg-gray-100'}`}
                    >
                      <Text className={`text-xs font-semibold capitalize ${form.genero === item ? 'text-white' : 'text-gray-600'}`}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <View className="gap-3 md:grid md:grid-cols-2">
              <InfoRow label="Nombre" value={form.nombre || '—'} />
              <InfoRow label="Apellido paterno" value={form.apellidoPaterno || '—'} />
              <InfoRow label="Apellido materno" value={form.apellidoMaterno || '—'} />
              <InfoRow label="Fecha de nacimiento" value={form.nacimiento || '—'} />
              <InfoRow label="Género" value={form.genero || '—'} />
            </View>
          )}

          <BentoCard className="p-4 mt-4 bg-gray-50">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="mail-outline" size={20} color="#7A1F3D" />
              <Text className="text-lg font-bold text-gray-900">Acceso y contacto</Text>
            </View>
            {editMode ? (
              <View className="gap-3 md:flex-row md:flex-wrap">
                <Field label="Usuario" value={form.username} onChangeText={setField('username')} container="md:w-1/2" required />
                <Field label="Correo electrónico" value={form.email} onChangeText={setField('email')} keyboardType="email-address" container="md:w-1/2" required />
                <Field label="Celular" value={form.celular} onChangeText={setField('celular')} keyboardType="phone-pad" container="md:w-1/2" required />
                <Field label="WhatsApp" value={form.whatsapp} onChangeText={setField('whatsapp')} keyboardType="phone-pad" container="md:w-1/2" />
                <Field label="Nueva contraseña (opcional)" value={form.password} onChangeText={setField('password')} secureTextEntry placeholder="Mínimo 8 caracteres" container="md:w-1/2" />
              </View>
            ) : (
              <View className="gap-3 md:grid md:grid-cols-2">
                <InfoRow label="Usuario" value={form.username || '—'} />
                <InfoRow label="Correo" value={form.email || '—'} />
                <InfoRow label="Celular" value={form.celular || '—'} />
                <InfoRow label="WhatsApp" value={form.whatsapp || '—'} />
              </View>
            )}
          </BentoCard>

          <BentoCard className="p-4 mt-4 bg-gray-50">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="location-outline" size={20} color="#7A1F3D" />
              <Text className="text-lg font-bold text-gray-900">Dirección</Text>
            </View>
            {editMode ? (
              <View className="gap-3 md:flex-row md:flex-wrap">
                <Field label="Zona" value={form.zona} onChangeText={setField('zona')} container="md:w-1/2" required />
                <Field label="Distrito" value={form.distrito} onChangeText={setField('distrito')} container="md:w-1/2" />
                <Field label="Calle" value={form.calle} onChangeText={setField('calle')} container="md:w-1/2" />
                <Field label="Referencia" value={form.referencia} onChangeText={setField('referencia')} container="md:w-1/2" />
              </View>
            ) : (
              <View className="gap-3 md:grid md:grid-cols-2">
                <InfoRow label="Zona" value={form.zona || '—'} />
                <InfoRow label="Distrito" value={form.distrito || '—'} />
                <InfoRow label="Calle" value={form.calle || '—'} />
                <InfoRow label="Referencia" value={form.referencia || '—'} />
              </View>
            )}
          </BentoCard>

          {canEditDocuments && (
            <BentoCard className="p-4 mt-4 bg-gray-50">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="document-text-outline" size={20} color="#7A1F3D" />
                  <Text className="text-lg font-bold text-gray-900">Documentos registrados</Text>
                </View>
                {editMode && (
                  <TouchableOpacity className="flex-row items-center gap-1 bg-maroon/10 px-2.5 py-1.5 rounded-lg">
                    <Ionicons name="add-circle" size={16} color="#7A1F3D" />
                    <Text className="text-maroon text-xs font-bold">+ Agregar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editMode ? (
                <DocumentInput
                  documents={documents}
                  onChange={setDocuments}
                  requiredTypes={['CI', 'DNI', 'Pasaporte']}
                  title="Documentos (PDF)"
                  showRequiredBadge={true}
                />
              ) : (
                documents.length > 0 ? (
                  documents.map((doc) => (
                    <View key={doc.id ?? doc.numeroDoc} className="flex-row items-center gap-3 bg-white rounded-xl p-3 mb-2 border border-gray-200">
                      <Ionicons name="document-text-outline" size={21} color="#7A1F3D" />
                      <View className="flex-1">
                        <Text className="font-semibold text-gray-800">{doc.tipoDoc}</Text>
                        <Text className="text-sm text-gray-500">{doc.numeroDoc}</Text>
                        {doc.docUrl && (
                          <Text className="text-xs text-green-600 mt-1 flex-row items-center gap-1">
                            <Ionicons name="checkmark-circle" size={12} />
                            Subido a MinIO
                          </Text>
                        )}
                      </View>
                    </View>
                  ))
                ) : (
                  <Text className="text-amber-700 bg-amber-50 p-3 rounded-xl text-center">
                    No tienes documentos registrados. Activa el modo editar para agregar.
                  </Text>
                )
              )}
            </BentoCard>
          )}

          {usuario?.apoderados?.length && (
            <BentoCard className="p-4 mt-4 bg-gray-50">
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="people-outline" size={20} color="#7A1F3D" />
                <Text className="text-lg font-bold text-gray-900">Apoderados registrados</Text>
              </View>
              {usuario.apoderados.map((apoderado) => (
                <View key={apoderado.apoderadoId} className="flex-row items-center gap-3 bg-white rounded-xl p-3 mb-2 border border-gray-200">
                  <Ionicons name="person-outline" size={21} color="#7A1F3D" />
                  <View className="flex-1">
                    <Text className="font-semibold text-gray-800">
                      {apoderado.nombre} {apoderado.apellidoPaterno} {apoderado.apellidoMaterno}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {apoderado.parentesco}{apoderado.esPrincipal ? ' · Principal' : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </BentoCard>
          )}

          <TouchableOpacity onPress={handleSave} disabled={saving || !editMode} className="bg-maroon rounded-2xl py-4 items-center mt-4">
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Guardar cambios</Text>}
          </TouchableOpacity>
        </BentoCard>
      </View>

      <TouchableOpacity onPress={logout} className="border border-red-200 rounded-2xl py-3 flex-row items-center justify-center gap-2">
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text className="text-red-600 font-semibold">Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-white rounded-xl p-3 border border-gray-200">
      <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">{label}</Text>
      <Text className="text-gray-800">{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry,
  placeholder,
  container = '',
  required = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  placeholder?: string;
  container?: string;
  required?: boolean;
}) {
  return (
    <View className={container}>
      <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5 flex-row items-center gap-1">
        {label}
        {required && <Text className="text-red-500">*</Text>}
      </Text>
      <TextInput
        className="bg-gray-50 rounded-xl px-4 py-3 text-gray-800 border border-gray-200"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}