// nav_bar -> barra de navegación inferior
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NavItem } from './Sidebar';

interface BottomNavProps {
  items: NavItem[];
  activeRoute: string;
  onNavigate: (route: string) => void;
}

export function BottomNav({ items, activeRoute, onNavigate }: BottomNavProps) {
  const visible = items.slice(0, 6);

  return (
    <View className="flex-row bg-[#F8F7F6] border-t border-gray-200 px-2 pt-2 pb-3 items-center justify-between">
      {visible.map((item) => {
        const active = activeRoute === item.route;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onNavigate(item.route)}
            className="flex-1 items-center py-1 px-0.5"
          >
            <Ionicons
              name={item.icon}
              size={18}
              color={active ? '#801F3F' : '#6B7280'}
            />
            <Text
              className={`text-[9px] mt-0.5 ${active ? 'text-[#801F3F] font-bold' : 'text-gray-500'}`}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

