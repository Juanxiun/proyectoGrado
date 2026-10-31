import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
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
    <View className="w-64 bg-maroon h-full py-5 px-3 flex-col justify-between border-r border-maroon-dark">
      {/* Cabecera / Marca */}
      <View className="flex-row items-center gap-3 px-3 mb-5 pb-4 border-b border-white/10">
        <View className="w-10 h-10 rounded-xl bg-white/15 items-center justify-center border border-white/20 shadow-sm">
          <Ionicons name="school" size={22} color="#FFFFFF" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-black text-base tracking-tight">SGA Shalom</Text>
          <Text className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">
            Plataforma Integral
          </Text>
        </View>
      </View>

      {/* Lista Navegable Scrollable Bento */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="gap-1.5 pb-4">
        {items.map((item) => {
          const active = activeRoute === item.route;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onNavigate(item.route)}
              className={`flex-row items-center gap-3 px-3.5 py-2.5 rounded-2xl transition-all ${
                active
                  ? 'bg-white text-maroon font-bold shadow-md'
                  : 'hover:bg-white/10'
              }`}
            >
              <View
                className={`w-7 h-7 rounded-lg items-center justify-center ${
                  active ? 'bg-maroon/10' : 'bg-transparent'
                }`}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={active ? '#801529' : '#FFFFFFB3'}
                />
              </View>
              <Text
                className={`text-xs flex-1 ${
                  active ? 'text-maroon font-black' : 'text-white/80 font-medium'
                }`}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {active && (
                <View className="w-1.5 h-1.5 rounded-full bg-maroon" />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pie de Barra */}
      <View className="pt-3 border-t border-white/10">
        <Text className="text-white/40 text-[10px] text-center font-mono">
          v{APP_VERSION}
        </Text>
      </View>
    </View>
  );
}


