import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { InAppDocumentViewerModal } from '../../../displays/components/InAppDocumentViewerModal';
import { connectUsersWebSocket } from '../../../api/users.websocket';

interface MaterialItem {
  id: string;
  titulo: string;
  detalle?: string;
  archivoUrl: string;
  nombreArchivo?: string;
  tamanioBytes?: number;
  tipoMime?: string;
  fechaSubida?: string;
}

interface ContenidoEstudioSectionProps {
  asignacionId: string;
  materiaNombre: string;
}

export function ContenidoEstudioSection({
  asignacionId,
  materiaNombre,
}: ContenidoEstudioSectionProps) {
  const [loading, setLoading] = useState(true);
  const [materiales, setMateriales] = useState<MaterialItem[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);

  const fetchMateriales = async () => {
    try {
      setLoading(true);
      const res = await academicServicesApi.list('materiales', {
        asignacionId,
        limit: 100,
      });
      setMateriales(res.data as any[]);
    } catch (err) {
      console.error('Error al cargar contenido de estudio:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMateriales();
    // Suscripción WebSocket en tiempo real para nuevos materiales
    const unsub = connectUsersWebSocket(() => {
      fetchMateriales();
    });
    return () => {
      if (unsub) unsub();
    };
  }, [asignacionId]);

  const handleOpenMaterial = (mat: MaterialItem) => {
    setSelectedMaterial(mat);
    setViewerModalOpen(true);
  };

  return (
    <View className="gap-4 my-2">
      {/* Cabecera de la Sección */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="w-8 h-8 rounded-lg bg-gold/20 items-center justify-center">
            <Ionicons name="library" size={18} color="#B45309" />
          </View>
          <Text className="text-lg font-bold text-gray-900">Materiales Didácticos y de Consulta</Text>
        </View>
        <StatusBadge label={`${materiales.length} Recursos`} variant="info" />
      </View>

      {/* Contenido / Lista */}
      {loading && materiales.length === 0 ? (
        <View className="p-8 items-center justify-center">
          <ActivityIndicator size="small" color="#801529" />
          <Text className="text-xs text-gray-500 mt-2 font-medium">Cargando material educativo...</Text>
        </View>
      ) : materiales.length === 0 ? (
        <BentoCard className="p-6 items-center justify-center bg-gray-50 border border-dashed border-gray-200">
          <Ionicons name="folder-open-outline" size={32} color="#9CA3AF" />
          <Text className="text-sm font-semibold text-gray-600 mt-2">
            No hay materiales disponibles todavía
          </Text>
          <Text className="text-xs text-gray-400 text-center mt-1">
            El profesor aún no ha subido recursos de apoyo para {materiaNombre}.
          </Text>
        </BentoCard>
      ) : (
        <View className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {materiales.map((mat) => (
            <BentoCard
              key={mat.id}
              className="p-4 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between"
            >
              <View>
                <View className="flex-row items-start justify-between">
                  <View className="w-9 h-9 rounded-xl bg-maroon/10 items-center justify-center">
                    <Ionicons name="document-text-outline" size={20} color="#801529" />
                  </View>
                  <View className="bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                    <Text className="text-[11px] text-gray-600 font-mono">
                      {mat.nombreArchivo?.split('.').pop()?.toUpperCase() || 'DOC'}
                    </Text>
                  </View>
                </View>

                <Text className="font-bold text-gray-800 text-sm mt-2.5" numberOfLines={1}>
                  {mat.titulo}
                </Text>

                {mat.detalle ? (
                  <Text className="text-xs text-gray-500 mt-1 line-clamp-2" numberOfLines={2}>
                    {mat.detalle}
                  </Text>
                ) : null}
              </View>

              <View className="mt-4 pt-3 border-t border-gray-100 flex-row items-center justify-between">
                <Text className="text-[11px] text-gray-400">
                  {mat.fechaSubida ? mat.fechaSubida.slice(0, 10) : 'Disponible'}
                </Text>

                <TouchableOpacity
                  onPress={() => handleOpenMaterial(mat)}
                  className="bg-maroon hover:bg-maroon/90 px-3 py-1.5 rounded-lg flex-row items-center gap-1.5 shadow-sm"
                >
                  <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Visualizar en Pantalla</Text>
                </TouchableOpacity>
              </View>
            </BentoCard>
          ))}
        </View>
      )}

      {/* Visor In-App Modal Integrado */}
      <InAppDocumentViewerModal
        visible={viewerModalOpen}
        onClose={() => setViewerModalOpen(false)}
        title={selectedMaterial?.titulo || 'Material de Consulta'}
        url={selectedMaterial?.archivoUrl}
        fileName={selectedMaterial?.nombreArchivo}
        mimeType={selectedMaterial?.tipoMime}
        fileSize={selectedMaterial?.tamanioBytes}
        uploadedAt={selectedMaterial?.fechaSubida}
      />
    </View>
  );
}
