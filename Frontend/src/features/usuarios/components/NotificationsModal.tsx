import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificacionesApi, NotificationItem } from '../../../api/notificaciones.api';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectNotification?: (notif: NotificationItem) => void;
}

/** Etiqueta legible para notificaciones que no traen `publicoTexto`. */
const ETIQUETAS: Record<string, string> = {
  sistema: 'Sistema',
  academico: 'Académico',
  usuarios: 'Usuarios',
  horarios: 'Horarios',
};

export function NotificationsModal({
  visible,
  onClose,
  onSelectNotification,
}: NotificationsModalProps) {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifs = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const list = await notificacionesApi.list(user.id);
      setNotificaciones(list);
    } catch (e) {
      console.warn('Error cargando notificaciones:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifs();
    }
  }, [visible, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = connectUsersWebSocket(() => {
      fetchNotifs();
    });
    return () => {
      if (unsub) unsub();
    };
  }, [user?.id]);

  const handlePressNotif = async (notif: NotificationItem) => {
    if (!notif.leido && user?.id) {
      await notificacionesApi.markAsRead(notif.id, user.id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, leido: true } : n)),
      );
    }
    if (onSelectNotification) {
      onSelectNotification(notif);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    setMarkingAll(true);
    try {
      await notificacionesApi.markAllAsRead(user.id);
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leido: true })));
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notificaciones.filter((n) => !n.leido).length;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
        <View className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex-col border border-gray-100">
          {/* Header */}
          <View className="p-4 md:p-5 bg-maroon text-white flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
                <Ionicons name="notifications" size={20} color="#FFFFFF" />
              </View>
              <View>
                <Text className="text-white font-bold text-base md:text-lg">
                  Bandeja de Notificaciones
                </Text>
                <Text className="text-white/80 text-xs">
                  {unreadCount > 0 ? `${unreadCount} no leídas • ` : 'Al día • '}
                  Central de notificaciones (30 días)
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Listado */}
          <ScrollView className="p-4 max-h-[60vh]">
            {loading && notificaciones.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator size="small" color="#801529" />
                <Text className="text-xs text-gray-500 mt-2 font-medium">
                  Consultando notificaciones en tiempo real...
                </Text>
              </View>
            ) : notificaciones.length === 0 ? (
              <View className="py-12 items-center justify-center">
                <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-3">
                  <Ionicons name="notifications-off-outline" size={32} color="#9CA3AF" />
                </View>
                <Text className="text-base font-bold text-gray-800">Sin notificaciones</Text>
                <Text className="text-xs text-gray-400 text-center max-w-xs mt-1">
                  Cuando tus profesores publiquen material o nuevas actividades aparecerán aquí instantáneamente.
                </Text>
              </View>
            ) : (
              <View className="gap-3 pb-4">
                {notificaciones.map((n) => (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => handlePressNotif(n)}
                    activeOpacity={0.8}
                  >
                    <BentoCard
                      className={`p-4 border transition-all ${
                        n.leido
                          ? 'bg-white border-gray-100 opacity-80'
                          : 'bg-maroon/5 border-maroon/20 shadow-sm'
                      }`}
                    >
                      <View className="flex-row items-start justify-between gap-2">
                        <View className="flex-row items-center gap-2">
                          <View
                            className={`w-2.5 h-2.5 rounded-full ${
                              n.leido ? 'bg-gray-300' : 'bg-maroon'
                            }`}
                          />
                          <StatusBadge
                            label={n.publicoTexto ?? ETIQUETAS[n.canal] ?? 'Notificación'}
                            variant={n.tipo === 'material' ? 'brand' : 'warning'}
                          />
                        </View>
                        <Text className="text-[11px] text-gray-400 font-mono">
                          {n.fechaCreacion ? n.fechaCreacion.slice(0, 10) : ''}
                        </Text>
                      </View>

                      {/* Contexto académico para materiales/encargos */}
                      <View className="mt-3 bg-white p-3 rounded-xl border border-gray-100 gap-1">
                        {n.materiaNombre ? (
                          <>
                            <Text className="text-xs text-gray-700">
                              <Text className="font-bold text-gray-900">Profesor: </Text>
                              {n.profesorNombre ?? 'Docente'} - {n.cursoParalelo ?? 'Curso'}
                            </Text>
                            <Text className="text-xs text-gray-700">
                              <Text className="font-bold text-gray-900">Materia: </Text>
                              {n.materiaNombre}
                            </Text>
                          </>
                        ) : (
                          <Text className="text-xs text-gray-700">
                            <Text className="font-bold text-gray-900">Detalle: </Text>
                            {n.mensaje}
                          </Text>
                        )}
                        <Text className="text-xs text-gray-700">
                          <Text className="font-bold text-gray-900">Título: </Text>
                          {n.titulo}
                        </Text>
                        {n.publicoTexto ? (
                          <Text className="text-xs text-gray-700">
                            <Text className="font-bold text-gray-900">Publicó: </Text>
                            {n.publicoTexto}
                          </Text>
                        ) : null}
                        {n.fechaLimite !== undefined && n.fechaLimite !== null ? (
                          <Text className="text-xs text-gray-700">
                            <Text className="font-bold text-gray-900">Fecha límite: </Text>
                            {n.fechaLimite.replace('T', ' ').slice(0, 16)}
                          </Text>
                        ) : null}
                      </View>

                      <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-gray-100/60">
                        <Text className="text-[11px] text-maroon font-semibold">
                          {n.leido ? '✓ Vista confirmada' : '● Nueva notificación'}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-xs font-bold text-maroon">Ir a la actividad</Text>
                          <Ionicons name="arrow-forward" size={14} color="#801529" />
                        </View>
                      </View>
                    </BentoCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View className="p-3.5 bg-gray-50 border-t border-gray-200 flex-row items-center justify-between">
            <TouchableOpacity
              onPress={handleMarkAllRead}
              disabled={unreadCount === 0 || markingAll}
              className={`px-4 py-2 rounded-xl ${
                unreadCount === 0 ? 'bg-gray-100' : 'bg-maroon hover:bg-maroon/90'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  unreadCount === 0 ? 'text-gray-400' : 'text-white'
                }`}
              >
                {markingAll ? 'Marcando…' : 'Marcar todas como leídas'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              className="bg-gray-200 hover:bg-gray-300 px-5 py-2 rounded-xl"
            >
              <Text className="text-xs font-bold text-gray-700">Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
