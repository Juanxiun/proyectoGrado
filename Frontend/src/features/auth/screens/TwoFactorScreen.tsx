import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { loginStyles } from '../styles/login.styles';

export function TwoFactorScreen() {
  const { pending2FA, verify2FA, resend2FA, logout } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('El código debe contener exactamente 6 dígitos numéricos');
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

  const handleResend = async () => {
    setResending(true);
    setError(null);
    try {
      await resend2FA();
      alert('Se ha enviado un nuevo código 2FA a tu correo electrónico.');
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
            contentContainerClassName="flex-grow justify-center px-6 py-8"
            keyboardShouldPersistTaps="handled"
          >
            {/* Header Identity */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-2xl bg-maroon border-2 border-gold/40 items-center justify-center mb-3 shadow-lg">
                <Ionicons name="shield-checkmark" size={32} color="#F0D5B3" />
              </View>
              <Text className="text-white text-2xl font-serif text-center mb-1">
                Autenticación de Dos Pasos (2FA)
              </Text>
              <Text className="text-white/70 text-xs text-center px-4">
                Protección multifactor obligatoria para roles directivos y docentes.
              </Text>
            </View>

            {/* Bento Grid Card */}
            <View className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full self-center border border-gold/20">
              {/* Header Box */}
              <View className="bg-maroon p-6 items-center">
                <View className="bg-gold/20 px-3 py-1 rounded-full border border-gold/40 mb-2">
                  <Text className="text-gold text-[10px] font-bold uppercase tracking-widest">
                    Verificación de Seguridad
                  </Text>
                </View>
                <Text className="text-white text-xs text-center font-medium">
                  Enviamos un código OTP de 6 dígitos a:
                </Text>
                <Text className="text-gold font-bold text-base mt-1 text-center">
                  {pending2FA?.emailMasked ?? 'su correo electrónico'}
                </Text>
              </View>

              <View className="p-6">
                {error && (
                  <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex-row items-center gap-2">
                    <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                    <Text className="text-red-600 text-xs flex-1">{error}</Text>
                  </View>
                )}

                <Text className="text-xs font-semibold text-gray-500 uppercase text-center mb-2">
                  Código de 6 dígitos
                </Text>

                <TextInput
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.replace(/\D/g, '').slice(0, 6));
                    setError(null);
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="0 0 0 0 0 0"
                  placeholderTextColor="#D1D5DB"
                  className="bg-gray-100 border border-gray-300 rounded-2xl py-4 text-center text-3xl font-mono tracking-[12px] text-gray-900 mb-5"
                />

                <TouchableOpacity
                  onPress={submit}
                  disabled={loading}
                  className="bg-maroon rounded-xl py-4 flex-row items-center justify-center gap-2 shadow-md"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text className="text-white font-bold text-base">Verificar y Acceder</Text>
                      <Ionicons name="key-outline" size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                <View className="flex-row justify-between items-center mt-5 pt-4 border-t border-gray-100">
                  <TouchableOpacity onPress={handleResend} disabled={resending}>
                    <Text className="text-maroon text-xs font-bold uppercase">
                      {resending ? 'Enviando...' : 'Reenviar código'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => logout()}>
                    <Text className="text-gray-400 text-xs font-semibold">
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
