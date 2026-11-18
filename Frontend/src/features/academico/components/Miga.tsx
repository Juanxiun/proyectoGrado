import { Text, TouchableOpacity } from 'react-native';

// Miga -> miga de pan del recorrido
export function Miga({
  label,
  activo,
  onPress,
}: {
  label: string;
  activo: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center gap-1">
      <Text
        className={`text-xs font-semibold ${
          activo ? 'text-maroon' : 'text-gray-500'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
