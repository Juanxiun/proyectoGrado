import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { Alert, AuthLayout, Button, CodeInput, TextLink } from '../../../shared/ui';
import { COLORS } from '../../../shared/theme';

const RESEND_SECONDS = 60;

export function TwoFactorScreen() {
  const { pending2FA, verify2FA, resend2FA, logout } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleVerify = async (value?: string) => {
    const candidate = value ?? code;
    if (!/^\d{6}$/.test(candidate)) {
      setError('Complete los 6 dígitos del código');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verify2FA(candidate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'El código es inválido o expiró');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || resending) return;

    setResending(true);
    setError(null);
    try {
      await resend2FA();
      setCountdown(RESEND_SECONDS);
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar el código');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Segundo factor"
      title="Verificación en dos pasos"
      subtitle="Ingrese el código de 6 dígitos enviado a su correo institucional."
    >
      <View className="gap-5">
        {error ? <Alert tone="danger" message={error} /> : null}

        <View className="flex-row items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
          <View className="w-9 h-9 rounded-lg bg-maroon/10 items-center justify-center">
            <Ionicons name="mail-outline" size={18} color={COLORS.maroon} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 uppercase font-semibold">Enviado a</Text>
            <Text className="text-sm font-semibold text-gray-900">
              {pending2FA?.emailMasked ?? 'su correo institucional'}
            </Text>
          </View>
        </View>

        <View className="items-center gap-2">
          <Text className="text-xs font-semibold text-gray-500 uppercase">Código de seguridad</Text>
          <Text className="text-xs text-gray-400 text-center">
            Expira en pocos minutos. No lo comparta con nadie.
          </Text>
        </View>

        <CodeInput
          value={code}
          onChange={(digits) => {
            setCode(digits.join(''));
            setError(null);
          }}
          onComplete={(complete) => {
            void handleVerify(complete);
          }}
        />

        <Button
          label="Verificar y acceder"
          icon="checkmark-circle-outline"
          size="lg"
          fullWidth
          loading={loading}
          disabled={code.length < 6}
          onPress={() => void handleVerify()}
        />

        <View className="flex-row items-center justify-between pt-2 border-t border-gray-100">
          <TextLink
            label={
              resending
                ? 'Enviando…'
                : countdown > 0
                ? `Reenviar en ${countdown}s`
                : 'Reenviar código'
            }
            tone="brand"
            disabled={countdown > 0 || resending}
            onPress={handleResend}
          />
          <TextLink label="Cancelar y salir" tone="muted" onPress={() => void logout()} />
        </View>
      </View>
    </AuthLayout>
  );
}
