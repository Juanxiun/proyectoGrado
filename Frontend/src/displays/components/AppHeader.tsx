import { Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar...' }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-2.5 flex-1 max-w-md">
      <Ionicons name="search" size={18} color="#9CA3AF" />
      <TextInput
        className="flex-1 ml-2 text-gray-700 text-sm"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
      />
    </View>
  );
}

interface AppHeaderProps {
  title: string;
  userName: string;
  userEmail: string;
  userPhoto?: string | null;
  onProfilePress?: () => void;
}

export function AppHeader({ title, userName, userEmail, userPhoto, onProfilePress }: AppHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      <Text className="text-lg font-bold text-gray-900">{title}</Text>
      <View className="hidden md:flex flex-1 mx-6">
        <SearchBar value="" onChangeText={() => {}} />
      </View>
      <View className="flex-row items-center gap-3">
        <View className="relative">
          <Ionicons name="notifications-outline" size={22} color="#374151" />
          <View className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
        </View>
        <TouchableOpacity onPress={onProfilePress} className="flex-row items-center gap-2">
          {userPhoto ? <Image source={{ uri: userPhoto }} className="w-9 h-9 rounded-full bg-maroon" /> : <View className="w-9 h-9 rounded-full bg-maroon items-center justify-center"><Text className="text-white font-bold text-sm">{userName.charAt(0)}</Text></View>}
          <View className="hidden md:flex">
            <Text className="text-sm font-semibold text-gray-800">{userName}</Text>
            <Text className="text-xs text-gray-400">{userEmail}</Text>
          </View>
          <Ionicons name="chevron-down" size={14} color="#9CA3AF" className="hidden md:flex" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
