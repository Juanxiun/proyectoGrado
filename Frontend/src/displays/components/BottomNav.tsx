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
  const visible = items.slice(0, 5);

  return (
    <View className="flex-row bg-maroon border-t border-maroon-dark px-2 py-2 pb-5 items-center justify-around">
      {visible.map((item) => {
        const active = activeRoute === item.route;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onNavigate(item.route)}
            className={`items-center py-1.5 px-3 rounded-xl transition-colors ${
              active ? 'bg-white/20' : ''
            }`}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={active ? '#FFFFFF' : '#FFFFFF99'}
            />
            <Text
              className={`text-[10px] mt-0.5 ${active ? 'text-white font-bold' : 'text-white/70'}`}
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

