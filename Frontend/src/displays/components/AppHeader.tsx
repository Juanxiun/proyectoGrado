import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificacionesApi } from '../../api/notificaciones.api';
import { connectUsersWebSocket } from '../../api/users.websocket';
import { wsClient } from '../../api/websocket.client';
import { useAuth } from '../../context/AuthContext';
import { NotificationsModal } from '../../features/usuarios/components/NotificationsModal';
import { BentoCard } from '../../shared/ui';

interface AppHeaderProps {
  title: string;
  userName: string;
  userEmail: string;
  userPhoto?: string | null;
  onProfilePress?: () => void;
}

export function AppHeader({ title, userName, userEmail, userPhoto, onProfilePress }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = async () => {
    if (!user?.id) return;
    try {
      const { noLeidas } = await notificacionesApi.count(user.id);
      setUnreadCount(noLeidas);
    } catch (e) {
      console.warn('Error fetching unread count:', e);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    fetchUnread();

    const unsubNotif = wsClient.subscribeToNotifications(user.id, () => {
      setUnreadCount((prev) => prev + 1);
    });

    const unsub = connectUsersWebSocket(() => {
      fetchUnread();
    });

    return () => {
      unsubNotif();
      if (unsub) unsub();
    };
  }, [user?.id]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    Alert.alert(
      'Cerrar sesión',
      '¿Desea salir del sistema?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => void logout() },
      ],
    );
  };

  return (
    <View className="flex-row items-center justify-between px-5 py-3.5 bg-white border-b border-gray-200">
      <View className="flex-row items-center gap-3">
        <Text className="text-xl font-bold text-gray-900 tracking-tight">{title}</Text>
      </View>

      <View className="flex-row items-center gap-3">
        {/* Notificaciones */}
        <TouchableOpacity
          onPress={() => setNotifModalOpen(true)}
          className="relative w-10 h-10 rounded-xl bg-gray-100 items-center justify-center hover:bg-gray-200"
        >
          <Ionicons name="notifications-outline" size={20} color="#374151" />
          {unreadCount > 0 && (
            <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-600 rounded-full items-center justify-center px-1 border-2 border-white">
              <Text className="text-[10px] font-bold text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* User Chip */}
        <TouchableOpacity
          onPress={() => setUserMenuOpen(true)}
          className="flex-row items-center gap-2.5 pl-2 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100"
        >
          {userPhoto ? (
            <Image source={{ uri: userPhoto }} className="w-8 h-8 rounded-full bg-maroon" />
          ) : (
            <View className="w-8 h-8 rounded-full bg-maroon items-center justify-center">
              <Text className="text-white font-bold text-xs">{userName.charAt(0)}</Text>
            </View>
          )}
          <View className="hidden md:flex">
            <Text className="text-xs font-bold text-gray-800" numberOfLines={1}>{userName}</Text>
            <Text className="text-[10px] text-gray-500 uppercase font-medium">{user?.rol ?? 'Usuario'}</Text>
          </View>
          <Ionicons name="chevron-down" size={14} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Notificaciones Modal */}
      <NotificationsModal
        visible={notifModalOpen}
        onClose={() => {
          setNotifModalOpen(false);
          fetchUnread();
        }}
      />

      {/* User Menu Modal */}
      <Modal
        visible={userMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setUserMenuOpen(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/30 justify-start items-end p-4 pt-16"
          activeOpacity={1}
          onPress={() => setUserMenuOpen(false)}
        >
          <View
            className="w-72 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 gap-3"
            onStartShouldSetResponder={() => true}
          >
            <View className="flex-row items-center gap-3 pb-3 border-b border-gray-100">
              <View className="w-12 h-12 rounded-full bg-maroon items-center justify-center">
                <Text className="text-white font-bold text-lg">{userName.charAt(0)}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-gray-900" numberOfLines={1}>{userName}</Text>
                <Text className="text-xs text-gray-500" numberOfLines={1}>{userEmail}</Text>
                <View className="bg-maroon/10 px-2 py-0.5 rounded-md self-start mt-1">
                  <Text className="text-[10px] font-bold text-maroon uppercase">{user?.rol ?? 'Usuario'}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                setUserMenuOpen(false);
                if (onProfilePress) onProfilePress();
              }}
              className="flex-row items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50"
            >
              <Ionicons name="person-circle-outline" size={20} color="#374151" />
              <Text className="text-sm font-medium text-gray-700">Mi Perfil y Cuenta</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setUserMenuOpen(false);
                setNotifModalOpen(true);
              }}
              className="flex-row items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50"
            >
              <Ionicons name="notifications-outline" size={20} color="#374151" />
              <Text className="text-sm font-medium text-gray-700">Notificaciones</Text>
              {unreadCount > 0 && (
                <View className="ml-auto bg-red-600 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-white">{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View className="pt-2 border-t border-gray-100">
              <TouchableOpacity
                onPress={handleLogout}
                className="flex-row items-center gap-3 p-2.5 rounded-xl bg-red-50 hover:bg-red-100"
              >
                <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                <Text className="text-sm font-semibold text-red-600">Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

