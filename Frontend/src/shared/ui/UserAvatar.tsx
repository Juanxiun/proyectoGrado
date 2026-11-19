import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Canvas, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { DEFAULT_USER_PHOTO, resolveMediaUrl } from '../../constants/config';

interface UserAvatarProps {
  nombre?: string | null;
  apellidoPaterno?: string | null;
  fotoUrl?: string | null;
  className?: string;
  textoClassName?: string;
  bordered?: boolean;
  fallbackBgClassName?: string;
}

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
  const [etapa, setEtapa] = useState<'propia' | 'default' | 'iniciales'>(
    fotoUrl ? 'propia' : 'default',
  );

  useEffect(() => {
    setEtapa(fotoUrl ? 'propia' : 'default');
  }, [fotoUrl]);

  const clases = bordered ? `${className} border border-white/40` : className;

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
        setEtapa((actual) => {
          if (actual === 'propia') return 'default';
          return 'iniciales';
        });
      }}
    />
  );
}
