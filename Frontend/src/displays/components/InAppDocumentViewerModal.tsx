import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';

export interface DocumentViewerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  url?: string | null;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  uploadedAt?: string;
}

export function InAppDocumentViewerModal({
  visible,
  onClose,
  title,
  url,
  fileName,
  mimeType,
  fileSize,
  uploadedAt,
}: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  const resolvedName = fileName || title || 'Documento';
  const ext = (resolvedName.split('.').pop() || '').toLowerCase();

  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ||
    mimeType?.startsWith('image/');
  const isPdf = ext === 'pdf' || mimeType === 'application/pdf';
  const isOffice = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext) ||
    mimeType?.includes('word') || mimeType?.includes('sheet') || mimeType?.includes('excel');

  const handleOpenExternal = async () => {
    if (!url) return;
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.warn('Error opening external browser:', e);
    }
  };

  const handleDownload = () => {
    if (!url) return;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      handleOpenExternal();
    }
  };

  const renderContent = () => {
    if (!url) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text className="text-gray-700 font-bold text-base mt-3">URL del archivo no disponible</Text>
          <Text className="text-gray-400 text-xs text-center mt-1">
            No se pudo generar el enlace de visualización en MinIO.
          </Text>
        </View>
      );
    }

    if (isImage) {
      return (
        <View className="flex-1 items-center justify-center bg-gray-950/90 p-4">
          <Image
            source={{ uri: url }}
            style={{
              width: '100%',
              height: '100%',
              transform: [{ scale: zoomLevel }],
            }}
            resizeMode="contain"
            onLoadEnd={() => setLoading(false)}
          />
        </View>
      );
    }

    if (isPdf) {
      if (Platform.OS === 'web') {
        return (
          <View className="flex-1 w-full h-full bg-gray-100">
            {React.createElement('iframe', {
              src: url,
              style: {
                width: '100%',
                height: '100%',
                border: 'none',
              },
              title: resolvedName,
              onLoad: () => setLoading(false),
            })}
          </View>
        );
      } else {
        // En móvil/nativa, usamos visor embebido de Google Docs para PDF o iframe
        const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        return (
          <View className="flex-1 w-full h-full bg-gray-100">
            {React.createElement('iframe', {
              src: googleDocsUrl,
              style: {
                width: '100%',
                height: '100%',
                border: 'none',
              },
              title: resolvedName,
              onLoad: () => setLoading(false),
            })}
          </View>
        );
      }
    }

    if (isOffice) {
      // Visor en línea de Google Docs / Microsoft Office para documentos Word y Excel
      const googleViewer = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
      const officeViewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

      return (
        <View className="flex-1 w-full h-full bg-gray-100 relative">
          {React.createElement('iframe', {
            src: googleViewer,
            style: {
              width: '100%',
              height: '100%',
              border: 'none',
            },
            title: resolvedName,
            onLoad: () => setLoading(false),
          })}
        </View>
      );
    }

    // Archivos generales
    return (
      <View className="flex-1 items-center justify-center p-8 bg-gray-50">
        <View className="w-20 h-20 rounded-3xl bg-maroon/10 items-center justify-center mb-4">
          <Ionicons name="document-text" size={40} color="#801529" />
        </View>
        <Text className="text-gray-900 font-bold text-lg text-center">{resolvedName}</Text>
        <Text className="text-gray-500 text-xs mt-1">
          {fileSize ? `${(fileSize / (1024 * 1024)).toFixed(2)} MB` : ''} • Formato: {ext.toUpperCase()}
        </Text>
        <TouchableOpacity
          onPress={handleOpenExternal}
          className="mt-6 bg-maroon px-6 py-3 rounded-xl flex-row items-center gap-2 shadow-md"
        >
          <Ionicons name="open-outline" size={18} color="#FFFFFF" />
          <Text className="text-white font-bold text-sm">Abrir en Pestaña Nueva</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 items-center justify-center p-2 md:p-6">
        <View className="bg-white rounded-3xl w-full max-w-5xl h-[92vh] overflow-hidden shadow-2xl flex-col border border-gray-200">
          {/* Header Barra Superior */}
          <View className="p-4 bg-gray-900 text-white flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 mr-3">
              <View className="w-10 h-10 rounded-xl bg-gold/20 items-center justify-center">
                <Ionicons
                  name={isImage ? 'image-outline' : isPdf ? 'document-text-outline' : 'folder-open-outline'}
                  size={22}
                  color="#FFD700"
                />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-sm md:text-base truncate" numberOfLines={1}>
                  {title}
                </Text>
                <Text className="text-gray-400 text-xs truncate" numberOfLines={1}>
                  {resolvedName} {uploadedAt ? `• ${uploadedAt.slice(0, 10)}` : ''}
                </Text>
              </View>
            </View>

            {/* Acciones de Zoom & Descarga */}
            <View className="flex-row items-center gap-2">
              {isImage && (
                <View className="flex-row items-center bg-gray-800 rounded-xl p-1 mr-1">
                  <TouchableOpacity
                    onPress={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-1.5 hover:bg-gray-700 rounded-lg"
                  >
                    <Ionicons name="remove-outline" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <Text className="text-white text-xs px-2 font-mono">{Math.round(zoomLevel * 100)}%</Text>
                  <TouchableOpacity
                    onPress={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                    className="p-1.5 hover:bg-gray-700 rounded-lg"
                  >
                    <Ionicons name="add-outline" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              )}

              {url && (
                <TouchableOpacity
                  onPress={handleOpenExternal}
                  className="bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                >
                  <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                  <Text className="text-white text-xs font-semibold hidden md:flex">Pestaña Externa</Text>
                </TouchableOpacity>
              )}

              {url && (
                <TouchableOpacity
                  onPress={handleDownload}
                  className="bg-maroon hover:bg-maroon/90 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                >
                  <Ionicons name="download-outline" size={16} color="#FFFFFF" />
                  <Text className="text-white text-xs font-bold">Descargar</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={onClose}
                className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-red-600/80 items-center justify-center ml-1"
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Área Principal de Contenido */}
          <View className="flex-1 bg-gray-100 relative">
            {renderContent()}
          </View>

          {/* Footer de información */}
          <View className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-green-500" />
              <Text className="text-xs text-gray-600 font-medium">
                Visor integrado MinIO • Content-Disposition: inline
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="bg-gray-200 px-4 py-1.5 rounded-lg">
              <Text className="text-xs font-semibold text-gray-700">Cerrar Visor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
