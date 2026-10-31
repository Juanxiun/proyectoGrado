// insignia_estudiante -> ficha de insignia obtenida o bloqueada
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InsigniaEstudianteProps {
  codigo: string;
  nombre: string;
  descripcion?: string;
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
  obtenida: boolean;
  fecha?: string | null;
}

export function InsigniaEstudiante({
  codigo,
  nombre,
  descripcion,
  icono,
  color,
  obtenida,
  fecha,
}: InsigniaEstudianteProps) {
  const tono = obtenida ? color : '#CBD5E1';
  const bg = obtenida ? `${color}10` : '#F1F5F9';
  const border = obtenida ? `${color}30` : '#E2E8F0';

  return (
    <View className={`w-24 h-32 rounded-2xl border p-3 gap-2 ${bg} ${border} items-center`}>
      <View className={`w-10 h-10 rounded-full flex items-center justify-center ${obtenida ? 'bg-white shadow-sm' : bg}`}>
        <Ionicons name={icono} size={20} color={tono} />
      </View>
      <Text className="text-[10px] font-bold text-gray-800 text-center leading-tight">{nombre}</Text>
      {obtenida && fecha && (
        <Text className="text-[9px] text-gray-500 text-center">{new Date(fecha).toLocaleDateString('es-BO')}</Text>
      )}
      {!obtenida && (
        <Text className="text-[9px] text-gray-400 text-center font-medium">Bloqueada</Text>
      )}
    </View>
  );
}
