import { memo } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_VERSION } from '../../constants/config';

const INSTITUTION_LOGO = require('../../../assets/favicon.png');

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

export const Sidebar = memo(function Sidebar({ items, activeRoute, onNavigate }: SidebarProps) {
  return (
    <View className="w-64 bg-maroon h-full py-5 px-3 flex-col justify-between border-r border-maroon-dark">
      <View className="flex-row items-center gap-3 px-2 mb-5 pb-4 border-b border-white/10">
        <View className="w-24 h-24 items-center justify-center">
          <Image source={INSTITUTION_LOGO} style={{ width: 88, height: 88 }} resizeMode="contain" />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-white font-black text-xs leading-tight tracking-tight">
            Centro Educativo Cristiano Shalom
          </Text>
          <Text className="text-white/75 text-[11px] font-semibold leading-tight tracking-wide">
            El Alto
          </Text>
        </View>
      </View>

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

      <View className="pt-3 border-t border-white/10">
        <Text className="text-white/50 text-[10px] text-center font-mono">
          {APP_VERSION}
        </Text>
      </View>
    </View>
  );
});
