import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_VERSION } from '../../constants/config';
import { useAuth } from '../../context/AuthContext';
import { getFullName } from '../../utils/validation';

export interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

interface SidebarProps {
  items: NavItem[];
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function Sidebar({ items, activeRoute, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const userName = user ? getFullName(user.nombre, user.apellidoPaterno) : 'Usuario';
  const roleName = user?.rol ?? 'Sistema';

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseas salir del sistema?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => void logout() },
      ],
    );
  };

  return (
    <View className="w-60 bg-maroon h-full py-5 px-3 flex-col justify-between border-r border-maroon-dark">
      <View>
        {/* Logo / Header */}
        <View className="flex-row items-center gap-3 px-3 mb-6">
          <View className="w-10 h-10 rounded-xl bg-white/15 items-center justify-center border border-white/20">
            <Ionicons name="school" size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text className="text-white font-bold text-base tracking-tight">SGA Académico</Text>
            <Text className="text-white/60 text-[11px] uppercase tracking-wider">Gestión Escolar</Text>
          </View>
        </View>

        {/* Navigation Items */}
        <View className="gap-1">
          {items.map((item) => {
            const active = activeRoute === item.route;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => onNavigate(item.route)}
                className={`flex-row items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  active ? 'bg-white/20 border border-white/20' : 'hover:bg-white/10'
                }`}
              >
                <Ionicons name={item.icon} size={19} color={active ? '#FFFFFF' : '#FFFFFF99'} />
                <Text className={`text-sm ${active ? 'text-white font-semibold' : 'text-white/75'}`}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Footer / User Profile & Logout */}
      <View className="pt-4 border-t border-white/15 gap-2">
        {user && (
          <TouchableOpacity
            onPress={() => onNavigate('Profile')}
            className={`flex-row items-center gap-2.5 p-2 rounded-xl ${
              activeRoute === 'Profile' ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            <View className="w-8 h-8 rounded-full bg-white/20 items-center justify-center border border-white/30">
              <Text className="text-white font-bold text-xs">{userName.charAt(0)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                {userName}
              </Text>
              <Text className="text-white/60 text-[10px] uppercase font-medium" numberOfLines={1}>
                {roleName}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center gap-2.5 px-3 py-2 rounded-xl bg-black/15 hover:bg-black/25"
        >
          <Ionicons name="log-out-outline" size={17} color="#FCA5A5" />
          <Text className="text-red-200 text-xs font-semibold">Cerrar sesión</Text>
        </TouchableOpacity>

        <Text className="text-white/30 text-[10px] text-center mt-1">{APP_VERSION}</Text>
      </View>
    </View>
  );
}

