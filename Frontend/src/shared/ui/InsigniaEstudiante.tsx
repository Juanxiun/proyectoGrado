// InsigniaEstudiante -> ficha de insignia obtenida o bloqueada
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
  nombre,
  icono,
  color,
  obtenida,
  fecha,
}: InsigniaEstudianteProps) {
  const tono = obtenida ? color : '#94A3B8';
  const bg = obtenida ? `${color}15` : '#F1F5F9';
  const border = obtenida ? `${color}40` : '#E2E8F0';

  return (
    <View
      style={{ backgroundColor: bg, borderColor: border }}
      className="w-24 h-32 rounded-2xl border p-3 gap-2 items-center justify-center"
    >
      <View
        style={{ backgroundColor: obtenida ? '#FFFFFF' : '#E2E8F0' }}
        className="w-10 h-10 rounded-full items-center justify-center shadow-sm"
      >
        <Ionicons name={icono} size={20} color={tono} />
      </View>
      <Text className="text-[10px] font-bold text-gray-800 text-center leading-tight" numberOfLines={2}>
        {nombre}
      </Text>
      {obtenida && fecha ? (
        <Text className="text-[9px] text-gray-500 text-center">{new Date(fecha).toLocaleDateString('es-BO')}</Text>
      ) : null}
      {!obtenida ? (
        <Text className="text-[9px] text-gray-400 text-center font-medium">Bloqueada</Text>
      ) : null}
    </View>
  );
}
