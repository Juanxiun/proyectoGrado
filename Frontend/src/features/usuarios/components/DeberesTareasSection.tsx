import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';

interface EncargoItem {
  id: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  ponderacion: number;
  fechaPublicacion?: string;
  fechaLimite?: string;
  estado: string;
}

interface EntregaItem {
  id: string;
  encargoId: string;
  estudianteId: string;
  archivoUrl: string;
  nombreArchivo?: string;
  comentario?: string;
  fechaEntrega: string;
  estadoEntrega: 'a_tiempo' | 'con_retraso';
}

interface DeberesTareasSectionProps {
  asignacionId: string;
  materiaNombre: string;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function DeberesTareasSection({
  asignacionId,
  materiaNombre,
}: DeberesTareasSectionProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tareas, setTareas] = useState<EncargoItem[]>([]);
  const [myEntregas, setMyEntregas] = useState<Record<string, EntregaItem>>({});

  // Modal Formulario de Entrega
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<EncargoItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Carga Diferida e Independiente
  const loadData = async () => {
    try {
      setLoading(true);
      // Peticiones independientes para tareas y para entregas propias
      const [encRes, entRes] = await Promise.all([
        academicServicesApi.list('encargos', { asignacionId, limit: 100 }),
        academicServicesApi.list('entregas', { limit: 100 }),
      ]);

      const tasks = (encRes.data as any[]).filter(
        (e) => !['examen', 'evaluacion'].includes(String(e.tipo).toLowerCase()),
      );
      setTareas(tasks);

      // Mapear mis entregas por encargoId
      const map: Record<string, EntregaItem> = {};
      for (const ent of entRes.data as any[]) {
        map[String(ent.encargoId)] = ent;
      }
      setMyEntregas(map);
    } catch (err) {
      console.error('Error cargando deberes y tareas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [asignacionId]);

  const handleOpenSubmission = (tarea: EncargoItem) => {
    setActiveTask(tarea);
    setSelectedFile(null);
    setComentario('');
    setSubmissionModalOpen(true);
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 150 * 1024 * 1024) {
      Alert.alert('Límite excedido', 'El archivo no puede pesar más de 150 MB.');
      return;
    }
    setSelectedFile(asset);
  };

  const handleSubmitTask = async () => {
    if (!activeTask) return;
    if (!selectedFile) {
      Alert.alert('Archivo obligatorio', 'Debes adjuntar tu archivo de respuesta para completar la entrega.');
      return;
    }

    try {
      setSubmitting(true);
      const data = new FormData();
      data.append('encargoId', activeTask.id);
      if (comentario.trim()) data.append('comentario', comentario.trim());

      if (Platform.OS === 'web' && (selectedFile as any).file) {
        data.append('file', (selectedFile as any).file);
      } else {
        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();
        data.append('file', blob, selectedFile.name);
      }

      const res = await academicServicesApi.uploadEntrega(data);
      const nuevaEntrega = res as any;

      const estadoLabel = nuevaEntrega.estadoEntrega === 'a_tiempo' ? 'A tiempo' : 'Con retraso';
      Alert.alert(
        '¡Tarea Entregada!',
        `Tu entrega ha sido registrada con fecha del sistema (${nuevaEntrega.fechaEntrega?.replace('T', ' ').slice(0, 19)}).\n\nEstado: ${estadoLabel}`,
      );

      setSubmissionModalOpen(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error al entregar', err.message || 'No se pudo enviar la tarea.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View className="py-12 items-center justify-center">
        <ActivityIndicator size="large" color="#801529" />
        <Text className="text-xs text-gray-500 mt-3 font-medium">
          Cargando asignaciones y deberes de {materiaNombre}...
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-gray-900">Deberes y Tareas Asignadas</Text>
          <Text className="text-xs text-gray-500">
            Sube tus trabajos prácticos y consulta el estado de entrega en tiempo real.
          </Text>
        </View>
        <StatusBadge label={`${tareas.length} Tareas`} variant="warning" />
      </View>

      {tareas.length === 0 ? (
        <BentoCard className="p-8 items-center text-center">
          <Ionicons name="checkmark-done-circle-outline" size={48} color="#16A34A" />
          <Text className="text-base font-bold text-gray-800 mt-2">¡Todo al día!</Text>
          <Text className="text-xs text-gray-400 mt-1 max-w-sm">
            No tienes deberes ni trabajos prácticos pendientes en esta asignatura.
          </Text>
        </BentoCard>
      ) : (
        <View className="gap-3">
          {tareas.map((tarea) => {
            const entrega = myEntregas[tarea.id];
            const isDelivered = Boolean(entrega);
            const isClosed = tarea.fechaLimite && new Date() > new Date(tarea.fechaLimite);

            return (
              <BentoCard key={tarea.id} className="p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-bold text-gray-900">{tarea.titulo}</Text>
                      {isDelivered ? (
                        <StatusBadge
                          label={entrega.estadoEntrega === 'a_tiempo' ? 'A tiempo' : 'Con retraso'}
                          variant={entrega.estadoEntrega === 'a_tiempo' ? 'success' : 'danger'}
                        />
                      ) : (
                        <StatusBadge
                          label={isClosed ? 'Plazo Vencido' : 'Pendiente'}
                          variant={isClosed ? 'danger' : 'warning'}
                        />
                      )}
                    </View>

                    {tarea.descripcion ? (
                      <Text className="text-xs text-gray-600 mt-1.5">{tarea.descripcion}</Text>
                    ) : null}
                  </View>

                  <View className="bg-gold/20 px-2.5 py-1 rounded-lg">
                    <Text className="text-xs font-bold text-amber-900">{tarea.ponderacion} pts</Text>
                  </View>
                </View>

                {/* Fechas de disponibilidad */}
                <View className="flex-row flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100 text-xs">
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text className="text-xs text-gray-500">
                      Inicio: {tarea.fechaPublicacion?.replace('T', ' ').slice(0, 16) || 'Inmediato'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Ionicons name="alarm-outline" size={14} color="#DC2626" />
                    <Text className="text-xs font-bold text-red-600">
                      Cierre: {tarea.fechaLimite?.replace('T', ' ').slice(0, 16) || 'Sin límite'}
                    </Text>
                  </View>
                </View>

                {/* Información de entrega o botón de envío */}
                {isDelivered ? (
                  <View className="mt-3 p-3 bg-green-50/80 rounded-xl border border-green-200 flex-row items-center justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-xs font-bold text-green-900">
                        ✓ Tarea entregada el {entrega.fechaEntrega.replace('T', ' ').slice(0, 19)}
                      </Text>
                      {entrega.nombreArchivo ? (
                        <Text className="text-[11px] text-green-700 mt-0.5">
                          Archivo: {entrega.nombreArchivo}
                        </Text>
                      ) : null}
                    </View>

                    <TouchableOpacity
                      onPress={() => handleOpenSubmission(tarea)}
                      className="px-3 py-1.5 bg-green-700 rounded-lg"
                    >
                      <Text className="text-xs font-semibold text-white">Reenviar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleOpenSubmission(tarea)}
                    className="mt-3 bg-maroon rounded-xl py-2.5 px-4 flex-row items-center justify-center gap-2 shadow-sm"
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                    <Text className="text-white text-xs font-bold">Subir y Entregar Tarea</Text>
                  </TouchableOpacity>
                )}
              </BentoCard>
            );
          })}
        </View>
      )}

      {/* Modal de Envío de Tarea */}
      <Modal
        visible={submissionModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSubmissionModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header del Modal */}
            <View className="p-5 border-b border-gray-100 flex-row items-center justify-between bg-gray-50">
              <View className="flex-1 pr-2">
                <Text className="text-base font-bold text-gray-900">
                  Entrega de Tarea: {activeTask?.titulo}
                </Text>
                <Text className="text-xs text-red-600 font-semibold mt-0.5">
                  Fecha límite: {activeTask?.fechaLimite?.replace('T', ' ').slice(0, 16) || 'Sin límite'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSubmissionModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Cuerpo del Formulario */}
            <View className="p-5 gap-4">
              {/* Aviso de marca de tiempo y privacidad */}
              <View className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex-row items-start gap-2">
                <Ionicons name="shield-checkmark-outline" size={18} color="#1D4ED8" />
                <View className="flex-1">
                  <Text className="text-[11px] text-blue-900 font-semibold">
                    Control de Acceso RBAC y Marca de Tiempo
                  </Text>
                  <Text className="text-[10px] text-blue-700 mt-0.5">
                    El sistema registrará la hora exacta del envío para etiquetarla &quot;A tiempo&quot; o &quot;Con retraso&quot;. Tu entrega es privada y solo visible para ti, el docente y dirección.
                  </Text>
                </View>
              </View>

              {/* Selector de Archivo */}
              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">Archivo de Tarea *</Text>
                <TouchableOpacity
                  onPress={handlePickFile}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-xl items-center justify-center bg-gray-50"
                >
                  <Ionicons name="cloud-upload-outline" size={28} color="#801529" />
                  <Text className="text-xs font-bold text-gray-800 mt-2">
                    {selectedFile ? selectedFile.name : 'Seleccionar Archivo (PDF, Word, Excel)'}
                  </Text>
                  <Text className="text-[11px] text-gray-400 mt-0.5">
                    {selectedFile ? `${Math.round((selectedFile.size ?? 0) / 1024)} KB` : 'Hasta 150 MB'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Comentarios del estudiante */}
              <View>
                <Text className="text-xs font-semibold text-gray-700 mb-1">Comentario para el profesor (Opcional)</Text>
                <TextInput
                  value={comentario}
                  onChangeText={setComentario}
                  placeholder="Escribe alguna nota sobre tu entrega..."
                  multiline
                  numberOfLines={2}
                  className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Botón de Confirmación */}
              <TouchableOpacity
                onPress={handleSubmitTask}
                disabled={submitting}
                className="bg-maroon rounded-xl py-3 items-center justify-center shadow-sm"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold text-sm">Enviar Entrega Ahora</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
