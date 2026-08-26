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
    <View className="flex-row bg-maroon border-t border-maroon-dark px-1 py-2 pb-4">
      {visible.map((item) => {
        const active = activeRoute === item.route;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onNavigate(item.route)}
            className="flex-1 items-center py-1"
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={active ? '#FFFFFF' : '#FFFFFF66'}
            />
            <Text
              className={`text-[10px] mt-1 ${active ? 'text-white font-semibold' : 'text-white/50'}`}
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
