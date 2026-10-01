import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

/**
 * Marco común de las pantallas públicas (login y verificación 2FA).
 *
 * Reemplaza el fondo con imagen remota que usaban antes: ahora la pantalla es
 * una superficie clara igual que el panel de administración, con la marca
 * granate concentrada en la cabecera de la tarjeta.
 */
export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footerLinks = [],
  footerNote = '© 2026 Sistema de Gestión Académica',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footerLinks?: string[];
  footerNote?: string;
}) {
  return (
    <View className="flex-1 bg-gray-50">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="flex-grow justify-center items-center px-4 py-10"
            keyboardShouldPersistTaps="handled"
          >
            {/* Identidad de la institución */}
            <View className="items-center mb-6 max-w-md w-full">
              <View className="w-14 h-14 rounded-2xl bg-maroon items-center justify-center mb-3">
                <Ionicons name="school" size={26} color={COLORS.textInverted} />
              </View>
              <Text className="text-xl font-bold text-gray-900 text-center">{title}</Text>
              <Text className="text-sm text-gray-500 text-center mt-1">{subtitle}</Text>
            </View>

            <View className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-md overflow-hidden">
              {/* Cabecera granate: único acento fuerte, como el HeroBanner */}
              <View className="bg-maroon px-6 py-5">
                <Text className="text-white/70 text-[10px] font-bold uppercase tracking-widest">
                  {eyebrow}
                </Text>
                <Text className="text-white text-lg font-bold mt-1">{title}</Text>
              </View>

              <View className="p-6">{children}</View>
            </View>

            <View className="items-center mt-8 max-w-md w-full">
              <Text className="text-xs text-gray-400 text-center">{footerNote}</Text>
              {footerLinks.length > 0 ? (
                <View className="flex-row flex-wrap justify-center gap-4 mt-3">
                  {footerLinks.map((link) => (
                    <Text key={link} className="text-xs text-gray-400 uppercase">
                      {link}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
