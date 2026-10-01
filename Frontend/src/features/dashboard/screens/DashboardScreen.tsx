import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dashboardApi, type DashboardData } from '../../../api/dashboard.api';
import { BentoCard, StatusBadge } from '../../../shared/ui';
import { useRealtimeResource } from '../../../hooks/useRealtimeResource';
import { KpisDelTablero } from '../components/KpisDelTablero';
import { PanelRiesgo } from '../components/PanelRiesgo';
import { PanelAsistencia, PanelAvance } from '../components/PanelesTablero';
import { PanelEconomico } from '../components/PanelEconomico';

/**
 * Página de inicio. Todo lo que muestra viene de ServiceDashboard, que es un
 * servicio de sólo lectura y ya aplicó el recorte por rol.
 */
export function DashboardScreen() {
  const [datos, setDatos] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [periodoId, setPeriodoId] = useState<string>('');
  const [trimestre, setTrimestre] = useState(1);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await dashboardApi.get({ periodoId, trimestre });
      if (respuesta) setDatos(respuesta);
    } catch (err) {
      console.warn('[DashboardScreen] No se pudo cargar el tablero', err);
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, [periodoId, trimestre]);

  useEffect(() => {
    setLoading(true);
    void cargar();
  }, [cargar]);

  // Si un docente registra una nota o asistencia, el tablero se recalcula.
  useRealtimeResource('calificaciones', () => {
    void cargar();
  });
  useRealtimeResource('asistencia', () => {
    void cargar();
  });

  const periodos = datos?.academico?.periodos ?? [];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#801529" />
        <Text className="text-sm text-gray-500 mt-3">Preparando el tablero…</Text>
      </View>
    );
  }

  if (!datos) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Ionicons name="cloud-offline-outline" size={40} color="#9CA3AF" />
        <Text className="text-gray-700 font-semibold mt-3 text-center">
          No se pudo cargar el tablero
        </Text>
        <Text className="text-sm text-gray-500 mt-1 text-center">
          Revisá que el servicio de dashboard esté levantado.
        </Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            void cargar();
          }}
          className="mt-4 bg-maroon px-5 py-2.5 rounded-xl"
        >
          <Text className="text-white font-bold text-sm">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => {
            setRefrescando(true);
            void cargar();
          }}
          tintColor="#801529"
        />
      }
    >
      {/* Contexto: gestión, trimestre y alcance */}
      <BentoCard className="p-4">
        <View className="flex-row items-center justify-between gap-3 flex-wrap">
          <View className="flex-1 min-w-[180px]">
            <Text className="text-[10px] font-bold text-gray-500 uppercase">
              Gestión académica
            </Text>
            <Text className="text-base font-bold text-gray-900">
              {datos.contexto.periodo?.nombre ?? 'Sin gestión activa'}
            </Text>
            <Text className="text-[11px] text-gray-400 mt-0.5">
              {datos.contexto.descripcionAlcance} · generado en{' '}
              {datos.contexto.duracionMs} ms{datos.contexto.cacheado ? ' (caché)' : ''}
            </Text>
          </View>
          <StatusBadge
            label={`Trimestre ${datos.contexto.periodo?.trimestre ?? trimestre}`}
            variant="info"
          />
        </View>

        {periodos.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 pt-3 border-t border-gray-100">
            <View className="flex-row gap-2">
              {periodos.map((periodo) => (
                <TouchableOpacity
                  key={periodo.id}
                  onPress={() => setPeriodoId(periodo.id)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    (periodoId || datos.contexto.periodo?.id) === periodo.id
                      ? 'bg-maroon border-maroon'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${
                      (periodoId || datos.contexto.periodo?.id) === periodo.id
                        ? 'text-white'
                        : 'text-gray-700'
                    }`}
                  >
                    {periodo.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        ) : null}

        <View className="flex-row items-center gap-2 mt-3">
          <Text className="text-xs font-bold text-gray-600">Trimestre</Text>
          <View className="flex-1 flex-row bg-gray-100 rounded-lg p-0.5 max-w-[240px]">
            {[1, 2, 3].map((numero) => (
              <TouchableOpacity
                key={numero}
                onPress={() => setTrimestre(numero)}
                className={`flex-1 py-1.5 rounded-md ${trimestre === numero ? 'bg-maroon' : ''}`}
              >
                <Text
                  className={`text-xs font-bold text-center ${
                    trimestre === numero ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {numero}°
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BentoCard>

      <KpisDelTablero kpis={datos.kpis} />

      {/* Avance de las materias */}
      <BentoCard className="p-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="book-outline" size={17} color="#801529" />
          <Text className="text-sm font-bold text-gray-900">Avance de las materias</Text>
        </View>
        <PanelAvance academico={datos.academico} />
      </BentoCard>

      {/* Asistencia y faltas */}
      <BentoCard className="p-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="calendar-outline" size={17} color="#801529" />
          <Text className="text-sm font-bold text-gray-900">Asistencia y faltas</Text>
        </View>
        <PanelAsistencia asistencia={datos.asistencia} />
      </BentoCard>

      {/* Estudiantes en riesgo */}
      <BentoCard className="p-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="warning-outline" size={17} color="#801529" />
          <Text className="text-sm font-bold text-gray-900">Estudiantes en riesgo</Text>
        </View>
        <PanelRiesgo riesgo={datos.riesgo} />
      </BentoCard>

      {/* Estimación económica */}
      {datos.economicoOculto ? (
        <BentoCard className="p-4 opacity-70">
          <View className="flex-row items-center gap-3">
            <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-gray-600">
                Estimación económica no disponible
              </Text>
              <Text className="text-[11px] text-gray-400">
                Sólo dirección y control pueden ver la cobranza.
              </Text>
            </View>
          </View>
        </BentoCard>
      ) : datos.economico ? (
        <BentoCard className="p-4">
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="cash-outline" size={17} color="#801529" />
            <Text className="text-sm font-bold text-gray-900">Estimación económica</Text>
          </View>
          <PanelEconomico economico={datos.economico} />
        </BentoCard>
      ) : null}
    </ScrollView>
  );
}
