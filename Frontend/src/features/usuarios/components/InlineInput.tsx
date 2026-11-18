import { type ComponentProps } from 'react';
import { Text, TextInput, View } from 'react-native';

// InlineInput -> campo de formulario con borde y error en línea
export function InlineInput({
  error,
  className = '',
  numericOnly = false,
  maxLength,
  onChangeText,
  ...props
}: ComponentProps<typeof TextInput> & {
  error?: string;
  numericOnly?: boolean;
}) {
  const handleChangeText = (v: string) => {
    if (numericOnly) {
      const filtered = v.replace(/\D/g, '');
      if (onChangeText) onChangeText(filtered);
    } else {
      if (onChangeText) onChangeText(v);
    }
  };

  return (
    <View className="flex-1 min-w-[150px]">
      <TextInput
        {...props}
        maxLength={maxLength}
        keyboardType={numericOnly ? 'numeric' : props.keyboardType}
        onChangeText={handleChangeText}
        className={`bg-white rounded-xl px-3 py-2.5 border text-sm ${
          error ? 'border-red-500 bg-red-50/20' : 'border-gray-200'
        } ${className}`}
      />
      {error ? <Text className="text-xs text-red-600 mt-1 font-medium">{error}</Text> : null}
    </View>
  );
}
