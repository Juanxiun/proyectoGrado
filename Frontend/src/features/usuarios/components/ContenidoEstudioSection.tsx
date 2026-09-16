import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';

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
  const [iframeModalOpen, setIframeModalOpen] = useState(false);

  // Carga Diferida / Fetch Independiente
  useEffect(() => {
    let isMounted = true;
    async function fetchMateriales() {
      try {
        setLoading(true);
        const res = await academicServicesApi.list('materiales', {
          asignacionId,
          limit: 100,
        });
        if (isMounted) {
          setMateriales(res.data as any[]);
        }
      } catch (err) {
        console.error('Error al cargar contenido de estudio:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchMateriales();
    return () => {
      isMounted = false;
    };
  }, [asignacionId]);

  const handleOpenMaterial = (mat: MaterialItem) => {
    setSelectedMaterial(mat);
    setIframeModalOpen(true);
  };

  const handleOpenExternal = (url: string) => {
    Linking.openURL(url).catch((err) => console.error('Error abriendo enlace:', err));
  };

  if (loading) {
    return (
      <View className="py-12 items-center justify-center">
        <ActivityIndicator size="large" color="#801529" />
        <Text className="text-xs text-gray-500 mt-3 font-medium">
          Cargando recursos pedagógicos de {materiaNombre}...
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-gray-900">Materiales Didácticos y de Consulta</Text>
          <Text className="text-xs text-gray-500">
            Documentos, diapositivas y guías de estudio provistas por el docente.
          </Text>
        </View>
        <StatusBadge label={`${materiales.length} Recursos`} variant="info" />
      </View>

      {materiales.length === 0 ? (
        <BentoCard className="p-8 items-center text-center">
          <Ionicons name="folder-open-outline" size={44} color="#D1D5DB" />
          <Text className="text-base font-bold text-gray-700 mt-2">
            No hay materiales disponibles todavía
          </Text>
          <Text className="text-xs text-gray-400 mt-1 max-w-sm">
            Tu profesor aún no ha compartido guías o presentaciones para esta asignatura.
          </Text>
        </BentoCard>
      ) : (
        <View className="gap-3">
          {materiales.map((mat) => (
            <BentoCard key={mat.id} className="p-4">
              <View className="flex-row items-start justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="w-12 h-12 rounded-xl bg-gold/20 items-center justify-center">
                    <Ionicons name="document-text" size={26} color="#B45309" />
                  </View>
                  <View className="flex-1 pr-2">
                    <Text className="text-base font-bold text-gray-900">{mat.titulo}</Text>
                    {mat.detalle ? (
                      <Text className="text-xs text-gray-600 mt-0.5">{mat.detalle}</Text>
                    ) : null}
                    <Text className="text-[11px] text-gray-400 mt-1">
                      {mat.nombreArchivo || 'Documento'} {mat.fechaSubida ? `• Subido: ${mat.fechaSubida.slice(0, 10)}` : ''}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Botón para abrir directamente en el iFrame integrado */}
              <View className="mt-4 pt-3 border-t border-gray-100 flex-row gap-2 justify-end">
                <TouchableOpacity
                  onPress={() => handleOpenExternal(mat.archivoUrl)}
                  className="px-3 py-2 bg-gray-100 rounded-xl flex-row items-center gap-1.5"
                >
                  <Ionicons name="open-outline" size={16} color="#4B5563" />
                  <Text className="text-xs font-semibold text-gray-700">Abrir en pestaña</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleOpenMaterial(mat)}
                  className="px-4 py-2 bg-maroon rounded-xl flex-row items-center gap-1.5 shadow-sm"
                >
                  <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Visualizar Material</Text>
                </TouchableOpacity>
              </View>
            </BentoCard>
          ))}
        </View>
      )}

      {/* Visualizador iFrame Modal Integrado */}
      <Modal
        visible={iframeModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIframeModalOpen(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-3">
          <View className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] overflow-hidden shadow-2xl flex-col">
            {/* Cabecera del visualizador */}
            <View className="p-4 bg-gray-900 text-white flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Ionicons name="document-text-outline" size={20} color="#FFD700" />
                <View className="flex-1">
                  <Text className="text-white font-bold text-sm truncate">
                    {selectedMaterial?.titulo}
                  </Text>
                  <Text className="text-white/60 text-[11px] truncate">
                    {selectedMaterial?.nombreArchivo || 'Visor interactivo'}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                {selectedMaterial?.archivoUrl ? (
                  <TouchableOpacity
                    onPress={() => handleOpenExternal(selectedMaterial.archivoUrl)}
                    className="bg-gray-800 px-3 py-1.5 rounded-lg flex-row items-center gap-1"
                  >
                    <Ionicons name="open-outline" size={14} color="#FFFFFF" />
                    <Text className="text-white text-xs">Descargar / Abrir</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={() => setIframeModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-gray-800 items-center justify-center"
                >
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* iFrame Container */}
            <View className="flex-1 bg-gray-100">
              {selectedMaterial?.archivoUrl ? (
                React.createElement('iframe', {
                  src: selectedMaterial.archivoUrl,
                  style: {
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  },
                  title: selectedMaterial.titulo || 'Visualizador iFrame',
                })
              ) : (
                <View className="flex-1 items-center justify-center p-6">
                  <Text className="text-gray-500 text-sm">URL no disponible para previsualizar</Text>
                </View>
              )}
            </View>

            {/* Pie del visualizador */}
            <View className="p-3 bg-gray-50 border-t border-gray-200 flex-row items-center justify-between">
              <Text className="text-xs text-gray-500">
                Visualizador de documentos integrado en plataforma
              </Text>
              <TouchableOpacity
                onPress={() => setIframeModalOpen(false)}
                className="bg-gray-200 px-4 py-1.5 rounded-lg"
              >
                <Text className="text-xs font-semibold text-gray-700">Cerrar Visor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
