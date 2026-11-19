import type { ReactNode } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_VERSION, INSTITUTION_NAME } from '../../constants/config';

const INSTITUTION_LOGO = require('../../../assets/favicon.png');

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footerLinks = [],
  footerNote = `© 2026 ${INSTITUTION_NAME} · ${APP_VERSION}`,
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
            <View className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-md overflow-hidden">
              <View className="bg-maroon px-5 py-4 flex-row items-center">
                <View className="rounded-full bg-white items-center justify-center mr-3" style={{ width: 48, height: 48 }}>
                  <Image source={INSTITUTION_LOGO} resizeMode="contain" style={{ width: 42, height: 42 }} />
                </View>
                <View className="flex-1">
                  <Text className="text-white/75 text-[10px] font-bold uppercase tracking-widest">
                    {eyebrow}
                  </Text>
                  <Text className="text-white text-sm font-bold mt-1" numberOfLines={2}>{title}</Text>
                </View>
              </View>

              <View className="p-5">
                <Text className="text-sm text-gray-500 mb-4">{subtitle}</Text>
                {children}
              </View>
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
