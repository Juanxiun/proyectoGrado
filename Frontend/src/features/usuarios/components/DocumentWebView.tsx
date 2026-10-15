import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
// @ts-ignore react-native-webview se instala desde las dependencias Expo
import { WebView } from 'react-native-webview';

export function DocumentWebView({ uri, title }: { uri: string; title: string; mimeType?: string; isPdf?: boolean; preferNativePdf?: boolean; fileName?: string }) {
  return <WebView source={{ uri }} originWhitelist={['*']} startInLoadingState renderLoading={() => <View className="h-[520px] items-center justify-center"><ActivityIndicator size="large" color="#801529"/><Text className="text-sm text-gray-500 mt-3">Abriendo el material...</Text></View>} style={{ height: 520, backgroundColor: '#f3f4f6' }} accessibilityLabel={title}/>;
}
