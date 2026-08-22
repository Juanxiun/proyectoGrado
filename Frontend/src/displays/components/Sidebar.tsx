import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_VERSION } from '../../constants/config';

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
  return (
    <View className="w-56 bg-maroon h-full py-6 px-3">
      <View className="flex-row items-center gap-2 px-3 mb-8">
        <View className="w-10 h-10 rounded-full bg-white/10 items-center justify-center">
          <Ionicons name="school" size={22} color="#FFFFFF" />
        </View>
        <Text className="text-white font-bold text-base">SGA Académico</Text>
      </View>

      <View className="flex-1 gap-1">
        {items.map((item) => {
          const active = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onNavigate(item.route)}
              className={`flex-row items-center gap-3 px-3 py-3 rounded-xl ${
                active ? 'bg-white/15' : ''
              }`}
            >
              <Ionicons name={item.icon} size={20} color={active ? '#FFFFFF' : '#FFFFFF99'} />
              <Text className={`text-sm ${active ? 'text-white font-semibold' : 'text-white/70'}`}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text className="text-white/40 text-xs text-center mt-4">{APP_VERSION}</Text>
    </View>
  );
}
