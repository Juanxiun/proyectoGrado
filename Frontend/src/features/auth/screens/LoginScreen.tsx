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
import { validateLogin } from '../../../utils/validation';
import { loginStyles } from '../styles/login.styles';

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleUsernameChange = (value: string) => {
    // ServiceUser acepta username o email; conservar los caracteres del correo.
    const filtered = value.replace(/[^a-zA-Z0-9._%+\-@]/g, '');
    setUsername(filtered);
    setUsernameError(null);
  };

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
            <View className="items-center mb-8">
              <View className="w-16 h-16 rounded-full bg-maroon border-2 border-white/30 items-center justify-center mb-4">
                <Ionicons name="school" size={32} color="#FFFFFF" />
              </View>
              <Text className="text-white text-3xl font-serif text-center mb-2">
                Sistema de Gestión Académica
              </Text>
              <Text className="text-white/70 text-sm text-center px-4">
                Plataforma institucional para la administración educativa de excelencia.
              </Text>
            </View>

            <View className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full self-center">
              <View className="p-6">
                <Text className="text-maroon text-2xl font-bold mb-1">Bienvenido</Text>
                <Text className="text-gray-400 text-sm mb-6">
                  Ingrese sus credenciales para acceder al panel.
                </Text>

                {error && (
                  <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                    <Text className="text-red-600 text-sm text-center">{error}</Text>
                  </View>
                )}

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Usuario
                  </Text>
                  <View className={`flex-row items-center bg-gray-100 rounded-xl px-4 border ${
                    usernameError ? 'border-red-400' : 'border-transparent'
                  }`}>
                    <Ionicons name="person-outline" size={18} color="#9CA3AF" />
                    <TextInput
                      className="flex-1 py-3.5 ml-3 text-gray-800"
                      value={username}
                      onChangeText={handleUsernameChange}
                      placeholder="usuario123"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {usernameError && (
                    <Text className="text-red-500 text-xs mt-1">{usernameError}</Text>
                  )}
                </View>

                <TouchableOpacity className="self-end mb-2">
                  <Text className="text-maroon text-xs font-semibold uppercase">
                    ¿Olvidó su contraseña?
                  </Text>
                </TouchableOpacity>

                <View className="mb-4">
                  <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Contraseña
                  </Text>
                  <View className={`flex-row items-center bg-gray-100 rounded-xl px-4 border ${
                    passwordError ? 'border-red-400' : 'border-transparent'
                  }`}>
                    <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" />
                    <TextInput
                      className="flex-1 py-3.5 ml-3 text-gray-800"
                      value={password}
                      onChangeText={(v) => { setPassword(v); setPasswordError(null); }}
                      placeholder="••••••••"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPassword}
                      maxLength={50}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>
                  {passwordError && (
                    <Text className="text-red-500 text-xs mt-1">{passwordError}</Text>
                  )}
                </View>

                <View className="flex-row items-center gap-2 mb-6">
                  <Ionicons name="shield-checkmark-outline" size={14} color="#9CA3AF" />
                  <Text className="text-gray-400 text-xs flex-1">
                    Acceso seguro mediante encriptación SSL de grado institucional.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading}
                  className="bg-maroon rounded-xl py-4 flex-row items-center justify-center gap-2"
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text className="text-white font-bold text-base">Iniciar Sesión</Text>
                      <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={loginStyles.cardFooter} className="py-4 items-center">
                <Text className="text-maroon text-xs font-bold uppercase tracking-widest">
                  Departamento de Tecnología Educativa
                </Text>
              </View>
            </View>

            <Text className="text-white/50 text-xs text-center mt-8">
              © 2026 Sistema de Gestión Académica. Todos los derechos reservados.
            </Text>
            <View className="flex-row justify-center gap-4 mt-2">
              {['SOPORTE', 'PRIVACIDAD', 'TÉRMINOS'].map((link) => (
                <Text key={link} className="text-white/40 text-xs uppercase">{link}</Text>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}
