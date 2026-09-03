import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BentoCard } from '../../../displays/components/BentoCard';
import { useUsuariosList } from '../../../hooks/useUsuarios';
import { getFullName } from '../../../utils/validation';

type Group = 'docente' | 'estudiantil' | 'administrativo';
const GROUPS: Record<Group, { title: string; roles: string[]; icon: keyof typeof Ionicons.glyphMap }> = {
  docente: { title: 'Personal docente', roles: ['profesor', 'docente'], icon: 'school-outline' },
  estudiantil: { title: 'Personal estudiantil', roles: ['estudiante'], icon: 'people-outline' },
  administrativo: { title: 'Personal administrativo', roles: ['director', 'gerencia', 'administrativo'], icon: 'business-outline' },
};

export function PersonalDirectoryScreen({ group }: { group: Group }) {
  const { data, loading, error, fetchList } = useUsuariosList();
  const [search, setSearch] = useState('');
  const config = GROUPS[group];
  useEffect(() => { void fetchList({ limit: 100 }); }, [fetchList]);
  const people = useMemo(() => (data?.data ?? []).filter((person) => {
    const matchesRole = config.roles.includes((person.rol ?? '').toLowerCase());
    const fullName = getFullName(person.nombre, person.apellidoPaterno, person.apellidoMaterno).toLowerCase();
    return matchesRole && (!search || fullName.includes(search.toLowerCase()) || person.username?.toLowerCase().includes(search.toLowerCase()));
  }), [data, config.roles, search]);
  return <View className="gap-4">
    <BentoCard className="p-5 bg-cream"><View className="flex-row items-center gap-3"><View className="w-12 h-12 rounded-2xl bg-maroon items-center justify-center"><Ionicons name={config.icon} size={25} color="#fff" /></View><View className="flex-1"><Text className="text-xl font-bold text-gray-900">{config.title}</Text><Text className="text-sm text-gray-500">{people.length} personas registradas</Text></View></View><View className="flex-row items-center bg-white rounded-xl px-4 py-3 mt-4 border border-gray-100"><Ionicons name="search" size={18} color="#9CA3AF" /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nombre o usuario" placeholderTextColor="#9CA3AF" className="flex-1 ml-2 text-gray-700" /></View></BentoCard>
    {loading ? <View className="py-16 items-center"><ActivityIndicator size="large" color="#801529" /></View> : error ? <BentoCard className="p-5"><Text className="text-red-600">No se pudo cargar el personal: {error}</Text></BentoCard> : <View className="flex-row flex-wrap gap-4">{people.map((person) => <BentoCard key={person.id} className="p-5 w-full md:w-[31%]"><View className="flex-row items-center gap-3">{person.fotoUrl ? <Image source={{ uri: person.fotoUrl }} className="w-16 h-16 rounded-2xl bg-gray-100" /> : <View className="w-16 h-16 rounded-2xl bg-maroon items-center justify-center"><Text className="text-white text-xl font-bold">{person.nombre?.charAt(0) ?? 'U'}</Text></View>}<View className="flex-1"><Text className="font-bold text-gray-900" numberOfLines={2}>{getFullName(person.nombre, person.apellidoPaterno, person.apellidoMaterno)}</Text><Text className="text-xs text-gray-500 mt-1">@{person.username ?? 'sin usuario'}</Text></View></View><View className="mt-4 pt-3 border-t border-gray-100 gap-1"><Text className="text-xs text-gray-500">{person.email ?? 'Sin correo registrado'}</Text><Text className="text-xs font-semibold text-maroon capitalize">{person.rol ?? group}</Text></View></BentoCard>)}{!people.length && <BentoCard className="p-8 w-full items-center"><Ionicons name="people-outline" size={32} color="#9CA3AF" /><Text className="text-gray-500 mt-2">No hay resultados para mostrar.</Text></BentoCard>}</View>}
  </View>;
}
