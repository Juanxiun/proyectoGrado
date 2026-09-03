import { useState } from 'react';
import { Image, Text, View } from 'react-native';

interface RemoteImageProps {
  uri?: string | null;
  className?: string;
  fallbackText?: string;
}

export function RemoteImage({ uri, className, fallbackText = '?' }: RemoteImageProps) {
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View className={`${className ?? ''} bg-maroon/10 items-center justify-center`}>
        <Text className="text-maroon font-bold">{fallbackText}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
