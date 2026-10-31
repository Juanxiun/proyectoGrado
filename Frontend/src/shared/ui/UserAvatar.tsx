// avatar_usuario -> mostrar foto y nombre del usuario con fallback robusto
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { DEFAULT_USER_PHOTO, resolveMediaUrl } from '../../constants/config';

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
 * Flujo de resolucion:
 *   1. `fotoUrl` propia del usuario (si se pasa y carga);
 *   2. Foto por defecto de MinIO (`usuarios/default/profil.jpg`);
 *   3. Iniciales del usuario sobre fondo de color (red de seguridad).
 *
 * En dispositivos moviles, si la foto propia no carga (cortes de red o CORS),
 * se intenta la foto por defecto; si tampoco carga, se muestran iniciales.
 * Esto evita huecos vacios en el perfil.
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
  const [medidas, setMedidas] = useState({ width: 64, height: 64 });
  // `propia` = foto del usuario, `default` = foto de MinIO, `iniciales` = red de seguridad.
  const [etapa, setEtapa] = useState<'propia' | 'default' | 'iniciales'>(
    fotoUrl ? 'propia' : 'default',
  );

  // Si el usuario cambia de foto se vuelve a intentar la suya.
  useEffect(() => {
    setEtapa(fotoUrl ? 'propia' : 'default');
  }, [fotoUrl]);

  const clases = bordered ? `${className} border border-white/40` : className;

  // Si no hay fotoUrl propia, usar directamente la de MinIO sin intentar la propia.
  const uri = resolveMediaUrl(etapa === 'propia' && fotoUrl ? fotoUrl : DEFAULT_USER_PHOTO);
  const skiaImage = useImage(uri);

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

  if (Platform.OS !== 'web' && skiaImage) {
    return <View className={`${clases} overflow-hidden`} onLayout={(event) => setMedidas({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}><Canvas style={{ width: '100%', height: '100%' }}><SkiaImage image={skiaImage} x={0} y={0} width={medidas.width} height={medidas.height} fit="cover" /></Canvas></View>;
  }

  return (
    <Image
      source={{ uri }}
      className={clases}
      resizeMode="cover"
      onError={() => {
        // Si la foto propia falla, probar con la de MinIO; si esa falla, iniciales.
        setEtapa((actual) => {
          if (actual === 'propia') return 'default';
          return 'iniciales';
        });
      }}
    />
  );
}
