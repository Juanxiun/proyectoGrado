import { useEffect, useRef, useState } from 'react';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { TextInput, View } from 'react-native';

/**
 * Código de un solo uso en casilleros independientes: el foco avanza al
 * escribir, retrocede con Retroceso y acepta el pegado del código completo.
 */
export function CodeInput({
  length = 6,
  value,
  onChange,
  onComplete,
  autoFocus = true,
}: {
  length?: number;
  value: string;
  onChange: (digits: string[]) => void;
  onComplete?: (code: string) => void;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => value[i] ?? '')
  );
  const refs = useRef<Array<TextInput | null>>([]);

  // Refleja cambios externos (por ejemplo al reenviar el código o al limpiarlo).
  useEffect(() => {
    setDigits((prev) => {
      const next = Array.from({ length }, (_, i) => value[i] ?? '');
      return next.join('') === prev.join('') ? prev : next;
    });
  }, [value, length]);

  const commit = (next: string[], focusIndex?: number) => {
    setDigits(next);
    onChange(next);
    if (focusIndex !== undefined) {
      refs.current[focusIndex]?.focus();
    }
    if (next.join('').length === length) {
      onComplete?.(next.join(''));
    }
  };

  const handleChange = (text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '');

    // Pegado de varios caracteres a la vez.
    if (cleaned.length > 1) {
      const slice = cleaned.slice(0, length);
      const next = Array.from({ length }, (_, i) => slice[i] ?? '');
      commit(next, Math.min(slice.length, length - 1));
      return;
    }

    const next = [...digits];
    next[index] = cleaned.slice(-1);
    commit(next, cleaned && index < length - 1 ? index + 1 : undefined);
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key !== 'Backspace' || digits[index] || index === 0) return;

    const next = [...digits];
    next[index - 1] = '';
    setDigits(next);
    onChange(next);
    refs.current[index - 1]?.focus();
  };

  return (
    <View className="flex-row justify-center gap-2">
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            refs.current[index] = ref;
          }}
          value={digit}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          autoFocus={autoFocus && index === 0}
          keyboardType="number-pad"
          maxLength={length}
          selectTextOnFocus
          textAlign="center"
          accessibilityLabel={`Dígito ${index + 1} de ${length}`}
          className={`w-11 h-14 rounded-xl border text-center text-xl font-bold ${
            digit ? 'bg-maroon/5 border-maroon text-maroon' : 'bg-gray-50 border-gray-200 text-gray-800'
          }`}
          placeholder="•"
          placeholderTextColor="#D1D5DB"
        />
      ))}
    </View>
  );
}
