// podio_ranking -> podio del top 3 con fotos de perfil y lista ligera del resto
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserAvatar } from './UserAvatar';
import type { RankingEstudiante } from '../../api/gamificacion.api';

const COLORES_POSICION = ['#F59E0B', '#9CA3AF', '#DC2626']; // oro, plata, bronce

interface PodioRankingProps {
  estudiantes: RankingEstudiante[];
  estudianteLogueadoId?: string | null;
  vistaCurso: boolean;
  onVerMas?: () => void;
}

export function PodioRanking({
  estudiantes,
  estudianteLogueadoId,
  vistaCurso = true,
  onVerMas,
}: PodioRankingProps) {
  const top3 = estudiantes.slice(0, 3);
  const resto = estudiantes.slice(3);

  const estaLogueado = (estudiante: RankingEstudiante) =>
    estudianteLogueadoId ? estudiante.estudianteId === estudianteLogueadoId : false;

  return (
    <View className="gap-4">
      {/* Podio visual del Top 3 */}
      <View className="flex-row items-end justify-center gap-2 mb-1">
        {[2, 1, 0].map((idx) => {
          const est = top3[idx];
          const posicion = idx + 1;
          const color = COLORES_POSICION[idx];
          const esLogueado = est && estaLogueado(est);
          return (
            <View key={`podio-${posicion}`} className="items-center gap-1">
              <View className={`w-10 h-10 rounded-full border-4 border-maroon/20 ${esLogueado ? 'ring-2 ring-maroon' : ''}`}>
                {est ? (
                  <UserAvatar
                    nombre={est.nombre}
                    apellidoPaterno={est.apellidoPaterno}
                    fotoUrl={est.avatarUrl ?? undefined}
                    className="w-10 h-10 rounded-full"
                    textoClassName="text-[10px] font-bold text-white"
                    bordered
                  />
                ) : (
                  <View className="flex-1 items-center justify-center bg-gray-100">
                    <Text className="text-[10px] text-gray-400 font-bold">—</Text>
                  </View>
                )}
              </View>
              <View className={`w-10 h-10 rounded-full ${color} items-center justify-center shadow-md`}>
                <Text className="text-white font-black text-sm">{posicion}</Text>
              </View>
              {est && (
                <View className="w-20 items-center mt-1">
                  <Text className="text-[10px] font-bold text-gray-800 leading-tight">
                    {est.nombre} {est.apellidoPaterno}
                  </Text>
                  <Text className="text-[9px] text-gray-500 mt-0.5">
                    {est.puntosIndividuales.toLocaleString('es-BO')} pts
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Lista ligera del resto (o del top 5 en modo curso) */}
      <View className="gap-1.5">
        {resto.slice(0, vistaCurso ? 2 : 6).map((st, index) => {
          const posicionReal = 4 + index;
          const esLogueado = estaLogueado(st);
          return (
            <TouchableOpacity
              key={st.estudianteId}
              className={`flex-row items-center justify-between gap-2 px-3 py-2 rounded-xl border ${
                esLogueado
                  ? 'bg-maroon/10 border-maroon/30'
                  : 'bg-white border-gray-100'
              }`}
            >
              <View className="flex-row items-center gap-2">
                <View className="w-6 h-6 rounded-full items-center justify-center text-[10px] font-bold text-white bg-gray-300">
                  {posicionReal}
                </View>
                <UserAvatar
                  nombre={st.nombre}
                  apellidoPaterno={st.apellidoPaterno}
                  fotoUrl={st.avatarUrl ?? undefined}
                  className="w-7 h-7 rounded-full"
                  textoClassName="text-[9px] font-bold text-white"
                />
                <View className="flex-1 min-w-0">
                  <Text className="text-xs font-bold text-gray-900 truncate">
                    {st.nombre} {st.apellidoPaterno}
                  </Text>
                  <Text className="text-[9px] text-gray-500">
                    {st.puntosIndividuales.toLocaleString('es-BO')} pts · {st.insigniasCount} insignias
                  </Text>
                </View>
              </View>
              <View className="items-end">
                <Text className="text-xs font-bold text-maroon">
                  {st.puntosIndividuales} pts
                </Text>
                {esLogueado && (
                  <Text className="text-[9px] font-bold text-emerald-700 mt-0.5">Tú</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        {!vistaCurso && resto.length > 6 && (
          <TouchableOpacity onPress={onVerMas} className="items-center py-2">
            <Text className="text-[10px] font-bold text-maroon uppercase">Ver más estudiantes</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
