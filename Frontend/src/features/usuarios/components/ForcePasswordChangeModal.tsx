import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { authApi } from '../../../api/auth.api';
import { useAuth } from '../../../context/AuthContext';

interface ForcePasswordChangeModalProps {
  visible: boolean;
}

const SPECIAL_CHARS = ['@', '#', '$', '&'];

export function ForcePasswordChangeModal({ visible }: ForcePasswordChangeModalProps) {
  const { user, updateLocalUser, logout } = useAuth();
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Password criteria checks
  const checks = useMemo(() => {
    const minLength = passwordNueva.length >= 8;
    const hasUpper = /[A-Z]/.test(passwordNueva);
    const hasNumber = /\d/.test(passwordNueva);
    const hasSpecial = /[@#$&]/.test(passwordNueva);
    const matchesConfirm = passwordNueva.length > 0 && passwordNueva === passwordConfirm;
    const allValid = minLength && hasUpper && hasNumber && hasSpecial && matchesConfirm;

    return {
      minLength,
      hasUpper,
      hasNumber,
      hasSpecial,
      matchesConfirm,
      allValid,
    };
  }, [passwordNueva, passwordConfirm]);

  const handleSubmit = async () => {
    if (!checks.allValid) {
      setErrorMsg('Por favor asegúrese de cumplir todos los requisitos de seguridad.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await authApi.changePassword({ passwordNueva });
      updateLocalUser({ debeCambiarPassword: false });
      Alert.alert(
        '¡Contraseña Actualizada!',
        'Tu contraseña institucional ha sido establecida con éxito. Bienvenido al sistema.',
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la contraseña. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/80 items-center justify-center p-4">
        <BentoCard className="w-full max-w-md p-6 bg-white rounded-3xl shadow-2xl border border-maroon/20">
          {/* Header */}
          <View className="items-center mb-5">
            <View className="w-16 h-16 rounded-2xl bg-amber-100 items-center justify-center mb-3">
              <Ionicons name="key-outline" size={32} color="#D97706" />
            </View>
            <Text className="text-xl font-bold text-gray-900 text-center">
              Cambio de Contraseña Obligatorio
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-1">
              Hola, <Text className="font-semibold text-gray-800">{user?.nombre || user?.username}</Text>. Por políticas de seguridad institucional, debes establecer una contraseña personal en tu primer inicio de sesión.
            </Text>
          </View>

          {/* Form */}
          <View className="gap-3 mb-5">
            {errorMsg ? (
              <View className="p-3 bg-red-50 border border-red-200 rounded-xl flex-row items-center gap-2">
                <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                <Text className="text-xs text-red-600 flex-1">{errorMsg}</Text>
              </View>
            ) : null}

            {/* Nueva contraseña */}
            <View>
              <Text className="text-xs font-bold text-gray-700 mb-1">Nueva Contraseña</Text>
              <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
                <TextInput
                  value={passwordNueva}
                  onChangeText={(v) => {
                    setPasswordNueva(v);
                    setErrorMsg('');
                  }}
                  secureTextEntry={!showPassword}
                  placeholder="Ingrese nueva contraseña"
                  className="flex-1 py-3 text-sm text-gray-900"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="p-2">
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirmar contraseña */}
            <View>
              <Text className="text-xs font-bold text-gray-700 mb-1">Confirmar Nueva Contraseña</Text>
              <View className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-3">
                <TextInput
                  value={passwordConfirm}
                  onChangeText={(v) => {
                    setPasswordConfirm(v);
                    setErrorMsg('');
                  }}
                  secureTextEntry={!showPassword}
                  placeholder="Confirme la contraseña"
                  className="flex-1 py-3 text-sm text-gray-900"
                />
              </View>
            </View>

            {/* Checklist de Requisitos */}
            <View className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 gap-1.5 mt-1">
              <Text className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                Requisitos de Seguridad
              </Text>
              
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={checks.minLength ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={checks.minLength ? '#16A34A' : '#9CA3AF'}
                />
                <Text className={`text-xs ${checks.minLength ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                  Mínimo 8 caracteres
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={checks.hasUpper ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={checks.hasUpper ? '#16A34A' : '#9CA3AF'}
                />
                <Text className={`text-xs ${checks.hasUpper ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                  Al menos 1 letra mayúscula (A-Z)
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={checks.hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={checks.hasNumber ? '#16A34A' : '#9CA3AF'}
                />
                <Text className={`text-xs ${checks.hasNumber ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                  Al menos 1 número (0-9)
                </Text>
              </View>

              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={checks.hasSpecial ? 'checkmark-circle' : 'ellipse-outline'}
                  size={15}
                  color={checks.hasSpecial ? '#16A34A' : '#9CA3AF'}
                />
                <Text className={`text-xs ${checks.hasSpecial ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                  Al menos 1 carácter especial (@, #, $, &)
                </Text>
              </View>

              {passwordConfirm.length > 0 && (
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={checks.matchesConfirm ? 'checkmark-circle' : 'close-circle'}
                    size={15}
                    color={checks.matchesConfirm ? '#16A34A' : '#DC2626'}
                  />
                  <Text
                    className={`text-xs ${
                      checks.matchesConfirm ? 'text-green-700 font-medium' : 'text-red-600'
                    }`}
                  >
                    {checks.matchesConfirm ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-2">
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading || !checks.allValid}
              className={`py-3.5 rounded-xl items-center flex-row justify-center gap-2 shadow ${
                checks.allValid && !loading ? 'bg-maroon' : 'bg-gray-300'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#FFF" />
                  <Text className="text-white font-bold text-sm">Establecer Contraseña y Continuar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => logout()}
              disabled={loading}
              className="py-2.5 rounded-xl items-center flex-row justify-center gap-2"
            >
              <Ionicons name="log-out-outline" size={16} color="#6B7280" />
              <Text className="text-xs text-gray-500 font-semibold">Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </BentoCard>
      </View>
    </Modal>
  );
}
