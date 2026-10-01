import { forwardRef } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

export type TextFieldVariant = 'filled' | 'outline';

interface TextFieldProps extends Omit<ComponentProps<typeof TextInput>, 'className'> {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: TextFieldVariant;
  /** Muestra el botón de ojo y aplica `secureTextEntry` automáticamente. */
  password?: boolean;
  showPassword?: boolean;
  onTogglePassword?: () => void;
  required?: boolean;
  containerClassName?: string;
  inputClassName?: string;
}

/**
 * Campo de texto institucional con etiqueta, icono, estado de error y soporte de
 * contraseña. Sustituye a los campos escritos a mano en cada pantalla.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    hint,
    icon,
    variant = 'filled',
    password = false,
    showPassword = false,
    onTogglePassword,
    required = false,
    containerClassName = '',
    inputClassName = '',
    editable = true,
    ...props
  },
  ref,
) {
  const base = variant === 'outline' ? 'bg-white' : 'bg-gray-50';
  const border = error ? 'border-red-400' : 'border-gray-200';

  return (
    <View className={containerClassName}>
      {label ? (
        <Text className="text-xs font-semibold text-gray-500 uppercase mb-1.5">
          {label}
          {required ? <Text className="text-red-500"> *</Text> : null}
        </Text>
      ) : null}

      <View
        className={`flex-row items-center rounded-xl border ${base} ${border} ${
          editable ? '' : 'opacity-60'
        }`}
      >
        {icon ? (
          <View className="pl-4">
            <Ionicons name={icon} size={18} color={COLORS.textSubtle} />
          </View>
        ) : null}

        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={COLORS.textSubtle}
          className={`flex-1 py-3 ${icon ? 'pl-3' : 'px-4'} pr-4 text-gray-800 ${
            password ? 'text-base' : ''
          } ${inputClassName}`}
          secureTextEntry={password && !showPassword}
          {...props}
        />

        {password && onTogglePassword ? (
          <TouchableOpacity
            onPress={onTogglePassword}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="pr-4"
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={COLORS.textSubtle}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <Text className="text-xs text-red-500 mt-1">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-gray-400 mt-1">{hint}</Text>
      ) : null}
    </View>
  );
});
