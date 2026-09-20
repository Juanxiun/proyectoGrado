import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { loginStyles } from '../styles/login.styles';

export function TwoFactorScreen() {
  const { pending2FA, verify2FA, resend2FA, logout } = useAuth();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Temporizador para reenvío de código
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const fullCode = digits.join('');

  const handleVerify = async (codeToVerify?: string) => {
    const code = codeToVerify ?? fullCode;
    if (!/^\d{6}$/.test(code)) {
      setError('Por favor complete los 6 dígitos numéricos');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verify2FA(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Código de verificación 2FA inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (text: string, index: number) => {
    setError(null);

    // Detección de pegado (clipboard paste de múltiples caracteres)
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const newDigits = [...digits];
      const slice = cleaned.slice(0, 6);
      for (let i = 0; i < 6; i++) {
        newDigits[i] = slice[i] ?? '';
      }
      setDigits(newDigits);
      const nextFocus = Math.min(slice.length, 5);
      inputRefs.current[nextFocus]?.focus();
      if (slice.length === 6) {
        handleVerify(slice);
      }
      return;
    }

    const singleDigit = cleaned.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);

    // Auto-focus hacia adelante
    if (singleDigit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Si completó el 6to dígito
    if (singleDigit && index === 5) {
      const code = newDigits.join('');
      if (code.length === 6) {
        handleVerify(code);
      }
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Retroceder el foco al input anterior si el actual está vacío
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true);
    setError(null);
    try {
      await resend2FA();
      setCountdown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200' }}
      className="flex-1"
      resizeMode="cover"
    >
      <View style={loginStyles.overlay} />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="flex-grow justify-center items-center px-4 py-8"
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Institucional */}
            <View className="items-center mb-6 max-w-md w-full">
              <View className="w-16 h-16 rounded-2xl bg-maroon border-2 border-gold/40 items-center justify-center mb-3 shadow-xl">
                <Ionicons name="shield-checkmark" size={32} color="#F0D5B3" />
              </View>
              <Text className="text-white text-2xl font-serif text-center mb-1">
                Autenticación en Dos Pasos
              </Text>
              <Text className="text-white/75 text-xs text-center px-4 leading-relaxed">
                Seguridad reforzada institucional para resguardo de la cuenta y registros académicos.
              </Text>
            </View>

            {/* Floating Card Centrado Moderno */}
            <View className="bg-white/95 rounded-3xl overflow-hidden shadow-2xl max-w-md w-full border border-gold/30 backdrop-blur-md">
              {/* Cabecera Superior del Card */}
              <View className="bg-maroon p-6 items-center border-b border-gold/30">
                <View className="bg-gold/20 px-3 py-1 rounded-full border border-gold/40 mb-2">
                  <Text className="text-gold text-[10px] font-bold uppercase tracking-widest">
                    Código de Verificación OTP
                  </Text>
                </View>
                <Text className="text-white/80 text-xs text-center font-medium">
                  Hemos enviado un código seguro de 6 dígitos a:
                </Text>
                <View className="flex-row items-center gap-1.5 mt-1 bg-black/20 px-3 py-1 rounded-xl">
                  <Ionicons name="mail" size={14} color="#F0D5B3" />
                  <Text className="text-gold font-bold text-sm">
                    {pending2FA?.emailMasked ?? 'su correo electrónico institucional'}
                  </Text>
                </View>
              </View>

              {/* Cuerpo del Formulario */}
              <View className="p-6 md:p-8">
                {error && (
                  <View className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-5 flex-row items-center gap-2">
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text className="text-red-600 text-xs flex-1 font-medium">{error}</Text>
                  </View>
                )}

                <Text className="text-xs font-bold text-gray-500 uppercase text-center mb-4 tracking-wider">
                  Ingresa los 6 dígitos recibidos
                </Text>

                {/* 6 Casilleros OTP Independientes */}
                <View className="flex-row justify-center items-center gap-2 md:gap-3 mb-6">
                  {digits.map((digit, index) => {
                    const isFilled = Boolean(digit);
                    return (
                      <TextInput
                        key={index}
                        ref={(ref) => {
                          inputRefs.current[index] = ref;
                        }}
                        value={digit}
                        onChangeText={(text) => handleDigitChange(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                        keyboardType="number-pad"
                        maxLength={6}
                        selectTextOnFocus
                        textAlign="center"
                        className={`w-11 h-14 md:w-13 md:h-16 text-center text-2xl font-bold rounded-2xl border-2 transition-all ${
                          isFilled
                            ? 'bg-maroon/5 border-maroon text-maroon shadow-sm'
                            : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-maroon focus:bg-white'
                        }`}
                        placeholder="•"
                        placeholderTextColor="#D1D5DB"
                      />
                    );
                  })}
                </View>

                {/* Botón Principal de Verificación */}
                <TouchableOpacity
                  onPress={() => handleVerify()}
                  disabled={loading || fullCode.length < 6}
                  className={`rounded-2xl py-4 flex-row items-center justify-center gap-2 shadow-lg ${
                    fullCode.length === 6 && !loading
                      ? 'bg-maroon active:opacity-90'
                      : 'bg-gray-300 opacity-70'
                  }`}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text className="text-white font-bold text-base tracking-wide">
                        Verificar y Acceder
                      </Text>
                      <Ionicons name="arrow-forward-circle" size={20} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                {/* Pie de Acciones (Reenviar & Cancelar) */}
                <View className="flex-row justify-between items-center mt-6 pt-5 border-t border-gray-100">
                  <TouchableOpacity
                    onPress={handleResend}
                    disabled={countdown > 0 || resending}
                    className="flex-row items-center gap-1.5"
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={16}
                      color={countdown > 0 ? '#9CA3AF' : '#801529'}
                    />
                    <Text
                      className={`text-xs font-bold uppercase ${
                        countdown > 0 ? 'text-gray-400' : 'text-maroon'
                      }`}
                    >
                      {resending
                        ? 'Enviando...'
                        : countdown > 0
                        ? `Reenviar en ${countdown}s`
                        : 'Reenviar código'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => logout()}
                    className="flex-row items-center gap-1"
                  >
                    <Ionicons name="log-out-outline" size={16} color="#9CA3AF" />
                    <Text className="text-gray-500 text-xs font-semibold hover:text-gray-700">
                      Cancelar / Salir
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}
