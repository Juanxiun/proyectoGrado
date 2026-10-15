import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, TurboModuleRegistry, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

let NativePdf: React.ComponentType<any> | null = null;
try {
  if (TurboModuleRegistry.get('ReactNativeBlobUtil')) NativePdf = require('react-native-pdf').default;
} catch {
  NativePdf = null;
}

function htmlDocumento(title: string, body: string): string {
  const safeTitle = title.replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char] || char));
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:#27272a;padding:20px;line-height:1.65;background:#fff}h1,h2,h3{color:#801529}table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4e7d2}img{max-width:100%;height:auto}pre{white-space:pre-wrap}</style></head><body><h2>${safeTitle}</h2>${body}</body></html>`;
}

export function DocumentWebView({ uri, title, mimeType, preferNativePdf = false, fileName }: { uri: string; title: string; mimeType?: string; isPdf?: boolean; preferNativePdf?: boolean; fileName?: string }) {
  const isImage = mimeType?.startsWith('image/');
  const extension = (fileName || uri.split('?')[0]).split('.').pop()?.toLowerCase() || '';
  const isPdf = extension === 'pdf' || mimeType === 'application/pdf';
  const isWord = ['doc', 'docx'].includes(extension) || mimeType?.includes('word');
  const isExcel = ['xls', 'xlsx'].includes(extension) || mimeType?.includes('sheet') || mimeType?.includes('excel');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(isWord || isExcel);
  const [html, setHtml] = useState('');

  useEffect(() => {
    let active = true;
    setError(false);
    setHtml('');
    if (!isWord && !isExcel) { setLoading(false); return () => { active = false; }; }
    setLoading(true);
    fetch(uri).then((response) => {
      if (!response.ok) throw new Error('No se pudo descargar el documento');
      return response.arrayBuffer();
    }).then(async (buffer) => {
      let body = '';
      if (isWord) {
        const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
        body = result.value || '<p>El documento no contiene texto para mostrar.</p>';
      } else {
        const workbook = XLSX.read(buffer, { type: 'array' });
        body = workbook.SheetNames.map((name) => `<h3>${name}</h3>${XLSX.utils.sheet_to_html(workbook.Sheets[name])}`).join('');
      }
      if (active) { setHtml(htmlDocumento(title, body)); setLoading(false); }
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [uri, title, isWord, isExcel]);

  if (isImage) return <Image source={{ uri }} accessibilityLabel={title} resizeMode="contain" style={{ height: 520, width: '100%' }} onError={() => setError(true)} />;
  if (error) return <View className="h-[520px] items-center justify-center p-5"><Text className="text-base font-bold text-gray-800">No se pudo mostrar el documento</Text><Text className="text-sm text-gray-500 text-center mt-2">Comprueba tu conexión y vuelve a intentarlo.</Text></View>;
  if (isPdf && NativePdf) {
    const Pdf = NativePdf;
    return <Pdf source={{ uri, cache: true }} trustAllCerts={false} enablePaging={false} style={{ height: 520, width: '100%', backgroundColor: '#f3f4f6' }} renderActivityIndicator={() => <View className="h-[520px] items-center justify-center"><ActivityIndicator size="large" color="#801529"/><Text className="text-sm text-gray-500 mt-3">Abriendo el material...</Text></View>} onError={() => setError(true)} />;
  }
  if (loading) return <View className="h-[520px] items-center justify-center"><ActivityIndicator size="large" color="#801529"/><Text className="text-sm text-gray-500 mt-3">Preparando vista previa...</Text></View>;
  if (html) return <WebView source={{ html, baseUrl: uri }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled style={{ height: 520, backgroundColor: '#f3f4f6' }} accessibilityLabel={title} />;
  return <WebView source={{ uri }} originWhitelist={['*']} javaScriptEnabled domStorageEnabled startInLoadingState renderLoading={() => <View className="h-[520px] items-center justify-center"><ActivityIndicator size="large" color="#801529"/><Text className="text-sm text-gray-500 mt-3">Abriendo el material...</Text></View>} style={{ height: 520, backgroundColor: '#f3f4f6' }} accessibilityLabel={title} onError={() => setError(true)} />;
}
