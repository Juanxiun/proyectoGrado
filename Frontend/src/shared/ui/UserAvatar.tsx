// avatar_usuario -> mostrar foto y nombre del usuario
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { DEFAULT_USER_PHOTO } from '../../constants/config';

interface UserAvatarProps {
  nombre?: string | null;
  apellidoPaterno?: string | null;
  /** Foto cargada por el usuario. Si falta, se usa la de MinIO. */
  fotoUrl?: string | null;
  /**
   * Tamaño y forma. Es el className completo del cuadrado para poder combinar
   * `rounded-full` con `w-9 h-9`, `w-12 h-12`, etc. según dónde va.
   */
  className?: string;
  /** Estilo del texto de emergencia (ver más abajo). */
  textoClassName?: string;
  /** Borde claro, para los avatares que van sobre fondos oscuros. */
  bordered?: boolean;
  /** Color del círculo de emergencia. */
  fallbackBgClassName?: string;
}

/**
 * Avatar de usuario con la foto por defecto de MinIO.
 *
 * Antes esto se dibujaba con las iniciales sobre un círculo negro. Ahora:
 *
 *   1. la foto del usuario, si tiene `fotoUrl`;
 *   2. si no, o si su foto no carga, la foto por defecto de MinIO
 *      (`usuarios/default/profil.jpg`);
 *   3. y sólo si tampoco esa carga, las iniciales. Ese último paso es una red
 *      de seguridad para que un corte de red no deje un hueco vacío.
 *
 * No se usan `expo-image` ni `Avatar` de librerías: alcanza con `Image`, que ya
 * está en el proyecto.
 *
 * ── Quién pasa fotoUrl y quién no ───────────────────────────────────────────
 * Lo pasan las pantallas de gestión de usuarios y el perfil, que leen de
 * ServiceUser: AppHeader, Sidebar, ProfileScreen, UsuariosDashboard,
 * DocentesManagementScreen, AdministrativoManagementScreen y
 * EstudiantesManagementScreen.
 *
 * Las demás (PanelRiesgo, PanelCursoRendimiento, PanelEstudianteRendimiento,
 * MaestroCursosScreen, EstudianteCursosScreen) todavía no reciben fotoUrl: sus
 * servicios no exponen el campo, así que ahí siempre se ve la foto por defecto.
 * Cuando se agregue a esos responses alcanza con pasarlo como prop, sin tocar
 * el componente.
 */
export function UserAvatar({
  nombre,
  apellidoPaterno,
  fotoUrl,
  className = 'w-10 h-10 rounded-full',
  textoClassName = 'text-xs font-bold text-white',
  bordered = false,
  fallbackBgClassName = 'bg-maroon',
}: UserAvatarProps) {
  // `default` = se está usando la foto de MinIO, `iniciales` = se agotaron.
  const [etapa, setEtapa] = useState<'propia' | 'default' | 'iniciales'>(fotoUrl ? 'propia' : 'default');

  // Si el usuario cambia de foto se vuelve a intentar la suya.
  useEffect(() => {
    setEtapa(fotoUrl ? 'propia' : 'default');
  }, [fotoUrl]);

  const clases = bordered ? `${className} border border-white/40` : className;

  if (etapa === 'iniciales') {
    const iniciales =
      `${nombre?.trim().charAt(0) ?? ''}${apellidoPaterno?.trim().charAt(0) ?? ''}`.toUpperCase() ||
      '?';
    return (
      <View className={`${clases} ${fallbackBgClassName} items-center justify-center`}>
        <Text className={textoClassName}>{iniciales}</Text>
      </View>
    );
  }

  const uri = etapa === 'propia' && fotoUrl ? fotoUrl : DEFAULT_USER_PHOTO;

  return (
    <Image
      source={{ uri }}
      className={clases}
      resizeMode="cover"
      onError={() => setEtapa((actual) => (actual === 'propia' ? 'default' : 'iniciales'))}
    />
  );
}