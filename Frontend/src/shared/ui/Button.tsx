import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<ComponentProps<typeof TouchableOpacity>, 'children'> {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-maroon border-maroon',
  secondary: 'bg-white border-gray-200',
  ghost: 'bg-transparent border-transparent',
  danger: 'bg-red-600 border-red-600',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-700',
  ghost: 'text-maroon',
  danger: 'text-white',
};

const PADDING: Record<Size, string> = {
  sm: 'px-3 py-2 rounded-lg',
  md: 'px-4 py-3 rounded-xl',
  lg: 'px-5 py-3.5 rounded-xl',
};

const TEXT: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

/** Botón institucional. Reemplaza los `TouchableOpacity` escritos a mano. */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'right',
  fullWidth = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const tint = variant === 'secondary' ? COLORS.textMuted : LABEL[variant];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      className={`flex-row items-center justify-center gap-2 border ${CONTAINER[variant]} ${PADDING[size]} ${
        fullWidth ? 'w-full' : ''
      } ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <>
          {icon && iconPosition === 'left' ? <Ionicons name={icon} size={16} color={tint} /> : null}
          <Text className={`font-bold ${LABEL[variant]} ${TEXT[size]}`}>{label}</Text>
          {icon && iconPosition === 'right' ? <Ionicons name={icon} size={16} color={tint} /> : null}
        </>
      )}
    </TouchableOpacity>
  );
}

/** Enlace de texto para acciones secundarias ("Cancelar", "¿Olvidó su clave?"). */
export function TextLink({
  label,
  onPress,
  tone = 'brand',
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'brand' | 'muted';
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      className={`py-1 ${disabled ? 'opacity-40' : ''}`}
    >
      <Text
        className={`text-xs font-semibold ${
          tone === 'brand' ? 'text-maroon' : 'text-gray-500'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Fila de metadatos con icono, usada en los pies de tarjeta. */
export function HintRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={14} color={COLORS.textSubtle} />
      <Text className="text-xs text-gray-400 flex-1">{text}</Text>
    </View>
  );
}
