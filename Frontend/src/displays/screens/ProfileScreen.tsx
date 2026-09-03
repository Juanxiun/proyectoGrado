import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useUsuarioDetail, useUsuarioUpdate } from '../../hooks/useUsuarios';
import { BentoCard } from '../components/BentoCard';
import { BirthDatePicker } from '../../features/usuarios/components/BirthDatePicker';
import { formatDate, getFullName } from '../../utils/validation';
import type { Genero, UsuarioCont } from '../../types';

const GENEROS: Genero[] = ['masculino', 'femenino', 'otro'];

export function ProfileScreen() {
  const { user, updateLocalUser, logout } = useAuth();
  const { usuario, loading: loadingDetail, fetchById } = useUsuarioDetail();
  const { loading: saving, update, updateWithPhoto } = useUsuarioUpdate();

  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [form, setForm] = useState({
    nombre: user?.nombre ?? '',
    apellidoPaterno: user?.apellidoPaterno || (user as any)?.apellido_paterno || '',
    apellidoMaterno: user?.apellidoMaterno || (user as any)?.apellido_materno || '',
    nacimiento: '',
    genero: 'otro' as Genero,
    username: user?.username ?? '',
    email: user?.email ?? '',
    celular: '',
    whatsapp: '',
    zona: '',
    distrito: '',
    calle: '',
    referencia: '',
    password: '',
  });

  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((old) => ({ ...old, [key]: value }));

  useEffect(() => {
    if (user?.id) void fetchById(user.id);
  }, [user?.id, fetchById]);

  useEffect(() => {
    if (!usuario) return;
    const contact = (type: UsuarioCont['tipo']) =>
      usuario.contactos?.find((c) => c.tipo === type)?.contenido ?? '';
    const rawNac = usuario.nacimiento;
    let nac = '';
    if (typeof rawNac === 'string' && !rawNac.includes('[object')) {
      nac = rawNac.includes('T') ? rawNac.split('T')[0] : rawNac.slice(0, 10);
    } else if ((rawNac as any) instanceof Date && !isNaN((rawNac as any).getTime())) {
      nac = (rawNac as any).toISOString().slice(0, 10);
    }

    setForm((prev) => ({
      ...prev,
      nombre: usuario.nombre || prev.nombre,
      apellidoPaterno: usuario.apellidoPaterno || (usuario as any).apellido_paterno || prev.apellidoPaterno,
      apellidoMaterno: usuario.apellidoMaterno || (usuario as any).apellido_materno || prev.apellidoMaterno,
      nacimiento: nac || prev.nacimiento,
      genero: (usuario.genero as Genero) ?? prev.genero,
      username: usuario.cuenta?.username ?? usuario.username ?? prev.username,
      email: usuario.cuenta?.email ?? usuario.email ?? prev.email,
      celular: contact('Celular') || prev.celular,
      whatsapp: contact('Whatsapp') || prev.whatsapp,
      zona: usuario.direccion?.zona ?? prev.zona,
      distrito: usuario.direccion?.distrito ?? prev.distrito,
      calle: usuario.direccion?.calle ?? prev.calle,
      referencia: usuario.direccion?.referencia ?? prev.referencia,
    }));
  }, [usuario]);

  // Lista de información vacía o incompleta para disparar la alerta Bento
  const missing = useMemo(() => {
    const list: string[] = [];
    if (!form.nombre?.trim()) list.push('Nombre');
    if (!form.apellidoPaterno?.trim()) list.push('Apellido paterno');
    if (!form.apellidoMaterno?.trim()) list.push('Apellido materno');
    if (!form.nacimiento?.trim() || form.nacimiento.includes('[object')) list.push('Fecha de nacimiento');
    if (!form.email?.trim()) list.push('Correo institucional');
    if (!form.celular?.trim()) list.push('Teléfono celular');
    if (!form.zona?.trim()) list.push('Dirección domiciliaria');
    if (!usuario?.documentos?.length) list.push('Documento de identidad (CI/RUDE)');
    return list;
  }, [form, usuario?.documentos]);

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
    };

    try {
      const result = fotoUri
        ? await updateWithPhoto(user.id, payload, fotoUri)
        : await update(user.id, payload);

      updateLocalUser({
        nombre: form.nombre,
        apellidoPaterno: form.apellidoPaterno,
        apellidoMaterno: form.apellidoMaterno,
        username: form.username,
        email: form.email,
        fotoUrl: result.fotoUrl ?? user.fotoUrl,
      });

      setFotoUri(null);
      set('password')('');
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
      void fetchById(user.id);
      setMode('view');
    } catch {
      Alert.alert('No se pudo actualizar', 'Verifica los datos e inténtalo nuevamente.');
    }
  };

  if (loadingDetail && !usuario && !user) {
    return (
      <View className="flex-1 items-center justify-center py-20">
        <ActivityIndicator size="large" color="#801529" />
      </View>
    );
  }

  const photo = fotoUri ?? usuario?.fotoUrl ?? user?.fotoUrl;
  const fullName = getFullName(form.nombre, form.apellidoPaterno, form.apellidoMaterno) || 'Usuario Shalom';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-4 pb-12">
      {/* Selector de modo Bento Header */}
      <BentoCard className="p-4 bg-white flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="w-10 h-10 rounded-xl bg-maroon/10 items-center justify-center">
            <Ionicons name={mode === 'view' ? 'person-circle-outline' : 'create-outline'} size={24} color="#801529" />
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-900">
              {mode === 'view' ? 'Mi Perfil Institucional' : 'Edición de Perfil'}
            </Text>
            <Text className="text-xs text-gray-500">
              {mode === 'view' ? 'Expediente y datos personales en el sistema' : 'Actualiza tu información personal y de contacto'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setMode(mode === 'view' ? 'edit' : 'view')}
          className={`px-4 py-2.5 rounded-xl flex-row items-center gap-2 ${
            mode === 'view' ? 'bg-maroon' : 'bg-gray-100'
          }`}
        >
          <Ionicons
            name={mode === 'view' ? 'create-outline' : 'eye-outline'}
            size={18}
            color={mode === 'view' ? '#FFF' : '#374151'}
          />
          <Text className={`font-bold text-xs ${mode === 'view' ? 'text-white' : 'text-gray-800'}`}>
            {mode === 'view' ? 'Editar Perfil' : 'Ver Ficha'}
          </Text>
        </TouchableOpacity>
      </BentoCard>

      {/* Hero Bento Card */}
      <View className="gap-4 md:flex-row">
        <BentoCard className="p-6 md:flex-1 bg-maroon">
          <View className="items-center">
            <TouchableOpacity onPress={mode === 'edit' ? pickImage : undefined} className="relative">
              {photo ? (
                <Image source={{ uri: photo }} className="w-28 h-28 rounded-full border-4 border-white/30" />
              ) : (
                <View className="w-28 h-28 rounded-full bg-white/15 items-center justify-center">
                  <Text className="text-white text-4xl font-bold">{form.nombre.charAt(0) || 'U'}</Text>
                </View>
              )}
              {mode === 'edit' && (
                <View className="absolute bottom-0 right-0 w-9 h-9 bg-white rounded-full items-center justify-center shadow">
                  <Ionicons name="camera" size={17} color="#801529" />
                </View>
              )}
            </TouchableOpacity>

            <Text className="text-white text-xl font-bold mt-4 text-center">{fullName}</Text>
            <Text className="text-gold text-sm mt-0.5 font-medium">@{form.username || user?.username}</Text>
            <View className="flex-row items-center gap-2 mt-3">
              <View className="bg-white/20 px-3 py-1 rounded-full">
                <Text className="text-white text-xs uppercase font-semibold">
                  {usuario?.rol ?? user?.rol ?? 'Usuario'}
                </Text>
              </View>
              <View className="bg-white/10 px-3 py-1 rounded-full">
                <Text className="text-white/80 text-xs font-mono">ID: {user?.id}</Text>
              </View>
            </View>
          </View>
        </BentoCard>

        {/* Bento Card de Alerta Informativa (Datos vacíos / completos) */}
        <BentoCard className={`p-5 md:flex-[2] ${missing.length ? 'bg-amber-50/70 border-l-4 border-amber-500' : 'bg-green-50/70 border-l-4 border-green-500'}`}>
          <View className="flex-row items-start gap-3">
            <View
              className={`w-10 h-10 rounded-xl items-center justify-center ${
                missing.length ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
              }`}
            >
              <Ionicons
                name={missing.length ? 'alert-circle' : 'checkmark-circle'}
                size={24}
                color={missing.length ? '#B45309' : '#16A34A'}
              />
            </View>

            <View className="flex-1">
              <Text className={`text-base font-bold ${missing.length ? 'text-amber-900' : 'text-green-900'}`}>
                {missing.length ? 'Información Incompleta en tu Perfil' : 'Perfil Completo y Regularizado'}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">
                {missing.length
                  ? 'Para cumplir con los requisitos institucionales y académicos, debes completar todos tus datos obligatorios.'
                  : 'Todos tus datos personales, de contacto y credenciales institucionales se encuentran actualizados.'}
              </Text>

              {missing.length > 0 && (
                <View className="mt-3 bg-white/80 rounded-xl p-3 border border-amber-200">
                  <Text className="text-xs font-bold text-amber-800 mb-1.5">Campos pendientes por completar:</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {missing.map((item, idx) => (
                      <View key={idx} className="bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300">
                        <Text className="text-xs font-semibold text-amber-800">• {item}</Text>
                      </View>
                    ))}
                  </View>

                  {mode === 'view' && (
                    <TouchableOpacity
                      onPress={() => setMode('edit')}
                      className="mt-3 bg-amber-600 px-4 py-2 rounded-xl flex-row items-center justify-center gap-2 self-start shadow-sm"
                    >
                      <Ionicons name="create-outline" size={16} color="#FFF" />
                      <Text className="text-white text-xs font-bold">Completar mi información ahora</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>
        </BentoCard>
      </View>

      {/* CONTENIDO PRINCIPAL: MODO VISTA VS MODO EDICIÓN */}
      {mode === 'view' ? (
        /* VISTA COMPLETA DEL PERFIL EN BENTO GRID */
        <View className="gap-4">
          {/* Fila 1: Datos personales y Acceso */}
          <View className="gap-4 md:flex-row">
            <BentoCard className="p-5 md:flex-1">
              <Title icon="person-outline" title="Datos Personales" subtitle="Identificación básica del usuario" />
              <View className="gap-3">
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Nombres</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.nombre || <Text className="text-red-500 italic">Sin registrar</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Apellido Paterno</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.apellidoPaterno || <Text className="text-red-500 italic">Sin registrar</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Apellido Materno</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.apellidoMaterno || <Text className="text-red-500 italic">Sin registrar</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Fecha de Nacimiento</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.nacimiento && !form.nacimiento.includes('[object') ? formatDate(form.nacimiento) : <Text className="text-red-500 italic">Sin registrar</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Género</Text>
                  <Text className="text-sm font-semibold text-gray-900 capitalize">{form.genero}</Text>
                </View>
              </View>
            </BentoCard>

            <BentoCard className="p-5 md:flex-1">
              <Title icon="shield-checkmark-outline" title="Cuenta y Seguridad" subtitle="Credenciales institucionales" />
              <View className="gap-3">
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Nombre de Usuario</Text>
                  <Text className="text-sm font-semibold text-maroon font-mono">@{form.username || user?.username}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Correo Institucional</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.email || user?.email || <Text className="text-red-500 italic">Sin registrar</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Estado de Cuenta</Text>
                  <View className="bg-green-100 px-2.5 py-0.5 rounded-full">
                    <Text className="text-green-800 text-xs font-bold">Activo</Text>
                  </View>
                </View>
                <View className="flex-row justify-between py-1.5">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Rol Institucional</Text>
                  <Text className="text-sm font-bold text-gray-800 capitalize">{usuario?.rol ?? user?.rol ?? 'Usuario'}</Text>
                </View>
              </View>
            </BentoCard>
          </View>

          {/* Fila 2: Contacto y Dirección */}
          <View className="gap-4 md:flex-row">
            <BentoCard className="p-5 md:flex-1">
              <Title icon="call-outline" title="Contacto y Comunicación" subtitle="Medios de contacto directo" />
              <View className="gap-3">
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Teléfono Celular</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.celular || <Text className="text-amber-600 italic">No registrado</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">WhatsApp</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.whatsapp || <Text className="text-amber-600 italic">No registrado</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Email de Respaldo</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.email || '—'}</Text>
                </View>
              </View>
            </BentoCard>

            <BentoCard className="p-5 md:flex-1">
              <Title icon="location-outline" title="Dirección y Residencia" subtitle="Ubicación registrada" />
              <View className="gap-3">
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Zona / Barrio</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.zona || <Text className="text-amber-600 italic">No registrada</Text>}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Distrito</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.distrito || '—'}</Text>
                </View>
                <View className="flex-row justify-between py-1.5 border-b border-gray-100">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Calle / Avenida</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.calle || '—'}</Text>
                </View>
                <View className="flex-row justify-between py-1.5">
                  <Text className="text-xs font-bold text-gray-500 uppercase">Referencia</Text>
                  <Text className="text-sm font-semibold text-gray-900">{form.referencia || '—'}</Text>
                </View>
              </View>
            </BentoCard>
          </View>

          {/* Fila 3: Documentación Oficial Registrada */}
          <BentoCard className="p-5">
            <Title icon="document-text-outline" title="Documentación Oficial Registrada" subtitle="Archivos y carnets validados en el sistema" />
            {usuario?.documentos?.length ? (
              <View className="flex-row flex-wrap gap-3">
                {usuario.documentos.map((doc, idx) => (
                  <View key={doc.id ?? idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 min-w-[200px] flex-row items-center gap-3">
                    <View className="w-9 h-9 rounded-lg bg-maroon/10 items-center justify-center">
                      <Ionicons name="card-outline" size={20} color="#801529" />
                    </View>
                    <View>
                      <Text className="font-bold text-gray-900 text-xs">{doc.tipoDoc}</Text>
                      <Text className="text-xs text-gray-600 font-mono mt-0.5">{doc.numeroDoc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex-row items-center gap-2">
                <Ionicons name="warning-outline" size={18} color="#D97706" />
                <Text className="text-amber-800 text-xs">
                  Aún no tienes documentos registrados. Por favor proporciona tu Carnet de Identidad u otros documentos oficiales.
                </Text>
              </View>
            )}
          </BentoCard>

          {/* Fila 4: Apoderados (si existen) */}
          {usuario?.apoderados?.length ? (
            <BentoCard className="p-5">
              <Title icon="people-outline" title="Apoderados Registrados" subtitle="Tutores legales responsables" />
              <View className="flex-row flex-wrap gap-3">
                {usuario.apoderados.map((ap) => (
                  <View key={ap.apoderadoId} className="bg-gray-50 border border-gray-200 rounded-xl p-3 min-w-[220px] flex-row items-center gap-3">
                    <View className="w-9 h-9 rounded-lg bg-gold/20 items-center justify-center">
                      <Ionicons name="person-outline" size={18} color="#7A1F3D" />
                    </View>
                    <View>
                      <Text className="font-bold text-gray-900 text-xs">{getFullName(ap.nombre, ap.apellidoPaterno, ap.apellidoMaterno)}</Text>
                      <Text className="text-xs text-gray-500">{ap.parentesco}{ap.esPrincipal ? ' · Principal' : ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </BentoCard>
          ) : null}

          {/* Acciones del perfil */}
          <View className="flex-row gap-3 mt-2">
            <TouchableOpacity
              onPress={() => setMode('edit')}
              className="flex-1 bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
            >
              <Ionicons name="create-outline" size={18} color="#FFF" />
              <Text className="text-white font-bold text-sm">Editar Información del Perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={logout}
              className="border border-red-200 bg-red-50 rounded-xl px-5 py-3.5 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
              <Text className="text-red-600 font-semibold text-sm">Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* MODO EDICIÓN DE PERFIL 100% BENTO GRID */
        <View className="gap-4">
          <BentoCard className="p-5">
            <Title icon="person-outline" title="Datos Personales" subtitle="Verifica tus nombres y apellidos completos" />
            <View className="gap-4 md:flex-row md:flex-wrap">
              <Field label="Nombre *" value={form.nombre} onChangeText={set('nombre')} container="md:w-[31%]" />
              <Field label="Apellido Paterno *" value={form.apellidoPaterno} onChangeText={set('apellidoPaterno')} container="md:w-[31%]" />
              <Field label="Apellido Materno *" value={form.apellidoMaterno} onChangeText={set('apellidoMaterno')} container="md:w-[31%]" />
              <View className="md:w-[31%]">
                <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Fecha de Nacimiento *</Text>
                <BirthDatePicker value={form.nacimiento} onChange={set('nacimiento')} />
              </View>
              <View className="md:w-[31%]">
                <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5">Género</Text>
                <View className="flex-row gap-2">
                  {GENEROS.map((item) => (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setForm((old) => ({ ...old, genero: item }))}
                      className={`flex-1 rounded-xl py-3 items-center ${
                        form.genero === item ? 'bg-maroon' : 'bg-gray-100'
                      }`}
                    >
                      <Text className={`text-xs font-semibold capitalize ${form.genero === item ? 'text-white' : 'text-gray-600'}`}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </BentoCard>

          <View className="gap-4 md:flex-row">
            <BentoCard className="p-5 md:flex-1">
              <Title icon="mail-outline" title="Acceso y Contacto" subtitle="Credenciales y comunicación" />
              <View className="gap-4">
                <Field label="Nombre de Usuario *" value={form.username} onChangeText={set('username')} />
                <Field label="Correo Institucional *" value={form.email} onChangeText={set('email')} keyboardType="email-address" />
                <Field label="Teléfono Celular" value={form.celular} onChangeText={set('celular')} keyboardType="phone-pad" />
                <Field label="WhatsApp" value={form.whatsapp} onChangeText={set('whatsapp')} keyboardType="phone-pad" />
                <Field
                  label="Nueva Contraseña (Opcional)"
                  value={form.password}
                  onChangeText={set('password')}
                  secureTextEntry
                  placeholder="Mínimo 8 caracteres"
                />
              </View>
            </BentoCard>

            <BentoCard className="p-5 md:flex-1">
              <Title icon="location-outline" title="Dirección Domiciliaria" subtitle="Lugar de residencia" />
              <View className="gap-4">
                <Field label="Zona / Barrio" value={form.zona} onChangeText={set('zona')} placeholder="Ej. San Pedro" />
                <Field label="Distrito" value={form.distrito} onChangeText={set('distrito')} placeholder="Ej. Distrito 1" />
                <Field label="Calle / Avenida" value={form.calle} onChangeText={set('calle')} placeholder="Ej. Calle Murillo #123" />
                <Field label="Referencia de Ubicación" value={form.referencia} onChangeText={set('referencia')} placeholder="Ej. Frente al parque" />
              </View>
            </BentoCard>
          </View>

          {/* Acciones de guardar */}
          <View className="flex-row gap-3 mt-2">
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="flex-1 bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                  <Text className="text-white font-bold text-sm">Guardar Cambios</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('view')}
              disabled={saving}
              className="border border-gray-300 bg-white rounded-xl px-5 py-3.5 flex-row items-center justify-center gap-2"
            >
              <Text className="text-gray-700 font-semibold text-sm">Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Title({ icon, title, subtitle }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View className="flex-row items-center gap-2 mb-4 pb-2 border-b border-gray-100">
      <View className="w-8 h-8 rounded-lg bg-maroon/10 items-center justify-center">
        <Ionicons name={icon} size={18} color="#801529" />
      </View>
      <View>
        <Text className="text-base font-bold text-gray-900">{title}</Text>
        {subtitle ? <Text className="text-xs text-gray-400">{subtitle}</Text> : null}
      </View>
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  placeholder?: string;
  container?: string;
}) {
  return (
    <View className={container}>
      <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{label}</Text>
      <TextInput
        className="bg-gray-100 rounded-xl px-3 py-2.5 text-gray-800 border border-gray-200 text-sm"
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
