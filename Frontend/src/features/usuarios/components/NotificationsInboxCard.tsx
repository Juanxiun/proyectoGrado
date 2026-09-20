import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { BentoCard } from '../../../displays/components/BentoCard';
import { notificacionesApi, NotificationItem } from '../../../api/notificaciones.api';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { useAuth } from '../../../context/AuthContext';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { NotificationsModal } from './NotificationsModal';

export function NotificationsInboxCard() {
  const { user } = useAuth();
  const [notificaciones, setNotificaciones] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchNotifs = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const list = await notificacionesApi.list(user.id);
      setNotificaciones(list);
    } catch (e) {
      console.warn('Error fetching notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const unsub = connectUsersWebSocket(() => {
      fetchNotifs();
    });
    return () => {
      if (unsub) unsub();
    };
  }, [user?.id]);

  const unreadCount = notificaciones.filter((n) => !n.leido).length;

  return (
    <BentoCard className="p-5 bg-white">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-maroon/10 items-center justify-center">
            <Ionicons name="notifications-outline" size={21} color="#7A1F3D" />
          </View>
          <View>
            <Text className="text-base font-bold text-gray-900">Bandeja de Notificaciones</Text>
            <Text className="text-xs text-gray-500">
              {unreadCount > 0 ? `${unreadCount} pendientes de lectura` : 'Todas leídas'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setModalOpen(true)}
          className="bg-maroon px-3 py-1.5 rounded-xl flex-row items-center gap-1.5"
        >
          <Ionicons name="open-outline" size={14} color="#FFFFFF" />
          <Text className="text-xs font-bold text-white">Ver Todas</Text>
        </TouchableOpacity>
      </View>

      {loading && notificaciones.length === 0 ? (
        <View className="py-6 items-center justify-center">
          <ActivityIndicator size="small" color="#801529" />
        </View>
      ) : notificaciones.length === 0 ? (
        <View className="py-6 items-center justify-center bg-gray-50 rounded-2xl">
          <Ionicons name="notifications-off-outline" size={28} color="#9CA3AF" />
          <Text className="text-xs text-gray-500 mt-1 font-medium">
            No tienes avisos pendientes
          </Text>
        </View>
      ) : (
        <View className="gap-2.5">
          {notificaciones.slice(0, 3).map((n) => (
            <TouchableOpacity
              key={n.id}
              onPress={() => setModalOpen(true)}
              className={`p-3 rounded-xl border ${
                n.leido ? 'bg-gray-50 border-gray-100' : 'bg-cream/40 border-gold/40'
              }`}
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-xs text-gray-800" numberOfLines={1}>
                  {n.titulo}
                </Text>
                <StatusBadge label={n.publicoTexto} variant={n.tipo === 'material' ? 'info' : 'warning'} />
              </View>
              <Text className="text-[11px] text-gray-600 mt-1" numberOfLines={1}>
                Prof. {n.profesorNombre} • {n.materiaNombre}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <NotificationsModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          fetchNotifs();
        }}
      />
    </BentoCard>
  );
}
