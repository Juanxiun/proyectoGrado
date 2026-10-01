import { useState } from 'react';
import { Alert as RNAlert, View } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { Alert, AuthLayout, Button, HintRow, TextField, TextLink } from '../../../shared/ui';
import {
  PASSWORD_MAX,
  USERNAME_MAX,
  sanitizePassword,
  sanitizeUsername,
  validateLogin,
} from '../../../shared/validation/credentials';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const validation = validateLogin(username, password);
    setUsernameError(validation.usernameError);
    setPasswordError(validation.passwordError);
    if (!validation.isValid) return;

    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Acceso institucional"
      title="Sistema de Gestión Académica"
      subtitle="Ingrese sus credenciales para acceder al panel."
      footerLinks={['Soporte', 'Privacidad', 'Términos']}
    >
      <View className="gap-4">
        {error ? <Alert tone="danger" message={error} /> : null}

        <TextField
          label="Usuario"
          icon="person-outline"
          value={username}
          onChangeText={(value) => {
            setUsername(sanitizeUsername(value));
            setUsernameError(null);
          }}
          placeholder="usuario123"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={USERNAME_MAX}
          required
          error={usernameError}
          hint={`Sólo letras y números, hasta ${USERNAME_MAX} caracteres`}
        />

        <TextField
          label="Contraseña"
          icon="lock-closed-outline"
          value={password}
          onChangeText={(value) => {
            setPassword(sanitizePassword(value));
            setPasswordError(null);
          }}
          placeholder="••••••••"
          autoCapitalize="none"
          autoComplete="current-password"
          maxLength={PASSWORD_MAX}
          required
          password
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword((prev) => !prev)}
          error={passwordError}
        />

        <View className="flex-row items-center justify-between">
          <TextLink
            label="¿Olvidó su contraseña?"
            onPress={() =>
              RNAlert.alert(
                'Recuperar contraseña',
                'Solicite el restablecimiento al departamento de Control Académico.',
              )
            }
          />
        </View>

        <Button
          label="Iniciar sesión"
          icon="arrow-forward"
          size="lg"
          fullWidth
          loading={loading}
          onPress={handleSubmit}
        />

        <View className="pt-2">
          <HintRow
            icon="shield-checkmark-outline"
            text="Acceso restringido a personal autorizado del colegio."
          />
        </View>
      </View>
    </AuthLayout>
  );
}
