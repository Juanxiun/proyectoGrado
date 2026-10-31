import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import {
  seguimientoApi,
  type PanelEstudiante,
  type ResumenAsistencia,
} from '../../../api/seguimiento.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { KpiCard } from '../../../displays/components/KpiCard';
import { useResponsive } from '../../../utils/responsive';

export function EstudianteAsistenciaScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [trimestre, setTrimestre] = useState<number>(1);
  const [panelData, setPanelData] = useState<PanelEstudiante | null>(null);

  const estudianteId = user?.estudianteId || user?.id || '1';
  const periodoId = user?.periodoId || '1';

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await seguimientoApi.panelEstudiante({
          estudianteId,
          periodoId,
          trimestre,
        });
        setPanelData(data);
      } catch (err) {
        console.error('Error al cargar asistencia:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [estudianteId, periodoId, trimestre]);

  const periodoActual = panelData?.periodos?.[0];
  const asistenciaGlobal: ResumenAsistencia = periodoActual?.asistencia || {
    presentes: 0,
    ausentes: 0,
    atrasos: 0,
    justificadas: 0,
    total: 0,
    tasa: null,
  };

  const materias = periodoActual?.materias || [];

  const tasaGeneral = asistenciaGlobal.tasa ?? (asistenciaGlobal.total > 0
    ? ((asistenciaGlobal.presentes + asistenciaGlobal.justificadas) / asistenciaGlobal.total) * 100
    : 100);

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-8">
      {/* Cabecera Principal */}
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <View>
            <Text className="text-2xl font-black text-gray-900">
              Control de Asistencias y Faltas
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              Registro oficial de presencias, retrasos y justificaciones de inasistencia.
            </Text>
          </View>

          {/* Selector de Trimestre */}
          <View className="flex-row bg-gray-100 p-1 rounded-xl">
            {[1, 2, 3].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTrimestre(t)}
                className={`px-3 py-1.5 rounded-lg ${
                  trimestre === t ? 'bg-maroon' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    trimestre === t ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {t}° Trimestre
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </BentoCard>

      {/* Tarjetas KPI de Asistencia */}
      <View className="flex-row flex-wrap gap-3">
        <KpiCard
          label="Tasa Asistencia"
          value={`${tasaGeneral.toFixed(1)}%`}
          icon="calendar-outline"
          iconColor="#10B981"
          trend={tasaGeneral >= 85 ? 'Asistencia Regular' : 'Atención Requerida'}
          trendUp={tasaGeneral >= 85}
        />
        <KpiCard
          label="Presentes"
          value={`${asistenciaGlobal.presentes}`}
          icon="checkmark-circle-outline"
          iconColor="#10B981"
          trend="Puntual"
          trendUp={true}
        />
        <KpiCard
          label="Faltas (Ausente)"
          value={`${asistenciaGlobal.ausentes}`}
          icon="close-circle-outline"
          iconColor="#EF4444"
          trend={asistenciaGlobal.ausentes > 3 ? 'Límite Crítico' : 'Dentro de límite'}
          trendUp={asistenciaGlobal.ausentes === 0}
        />
        <KpiCard
          label="Atrasos / Justificadas"
          value={`${asistenciaGlobal.atrasos} / ${asistenciaGlobal.justificadas}`}
          icon="time-outline"
          iconColor="#F59E0B"
        />
      </View>

      {/* Alerta de Inasistencia si aplica */}
      {asistenciaGlobal.ausentes >= 3 && (
        <View className="bg-red-50 border border-red-200 p-4 rounded-2xl flex-row items-center gap-3">
          <Ionicons name="warning" size={24} color="#DC2626" />
          <View className="flex-1">
            <Text className="text-xs font-bold text-red-900">
              Aviso de Inasistencias Acumuladas
            </Text>
            <Text className="text-xs text-red-700">
              Tienes {asistenciaGlobal.ausentes} faltas registradas en el trimestre. Recuerda presentar tus cartas de justificación a la Dirección Académica.
            </Text>
          </View>
        </View>
      )}

      {/* Desglose por Materias */}
      {loading ? (
        <View className="py-16 items-center justify-center">
          <ActivityIndicator size="large" color="#801529" />
          <Text className="text-xs text-gray-500 font-medium mt-3">
            Cargando historial de asistencias...
          </Text>
        </View>
      ) : materias.length === 0 ? (
        <BentoCard className="p-8 items-center text-center">
          <Ionicons name="calendar-clear-outline" size={40} color="#9CA3AF" />
          <Text className="text-base font-bold text-gray-700 mt-2">
            Sin registros de asistencia para este período
          </Text>
          <Text className="text-xs text-gray-400 mt-1">
            Aún no se han asentado partes de asistencia en el libro de clases.
          </Text>
        </BentoCard>
      ) : (
        <View className="gap-3">
          <Text className="text-sm font-bold text-gray-800 ml-1">
            Asistencia por Asignatura ({materias.length})
          </Text>

          <View className={`gap-3 ${isMobile ? '' : 'grid grid-cols-2'}`}>
            {materias.map((m) => {
              const ast = m.asistencia;
              const pct = ast?.tasa ?? (ast?.total > 0 ? (ast.presentes / ast.total) * 100 : 100);

              return (
                <BentoCard
                  key={m.materiaId}
                  className="p-4 border border-gray-100 hover:border-maroon/20 transition-all gap-3"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
                        {m.materia}
                      </Text>
                      <Text className="text-xs text-gray-500 font-medium capitalize">
                        {m.tipoMateria}
                      </Text>
                    </View>
                    <StatusBadge
                      label={pct >= 85 ? 'Óptima' : pct >= 75 ? 'Regular' : 'Riesgo'}
                      variant={pct >= 85 ? 'success' : pct >= 75 ? 'warning' : 'danger'}
                    />
                  </View>

                  {/* Barra de Porcentaje */}
                  <View className="bg-gray-50 p-3 rounded-2xl gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs text-gray-500 font-medium">Asistencia Efectiva:</Text>
                      <Text className="text-base font-black text-gray-900">{pct.toFixed(0)}%</Text>
                    </View>
                    <View className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                      <View
                        className={`h-full rounded-full ${
                          pct >= 85 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </View>
                  </View>

                  {/* Resumen Detallado de Clases */}
                  <View className="flex-row items-center justify-around pt-2 border-t border-gray-100">
                    <View className="items-center">
                      <Text className="text-xs font-bold text-emerald-700">{ast?.presentes ?? 0}</Text>
                      <Text className="text-[10px] text-gray-400">Presentes</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-xs font-bold text-red-600">{ast?.ausentes ?? 0}</Text>
                      <Text className="text-[10px] text-gray-400">Faltas</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-xs font-bold text-amber-600">{ast?.atrasos ?? 0}</Text>
                      <Text className="text-[10px] text-gray-400">Atrasos</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-xs font-bold text-blue-600">{ast?.justificadas ?? 0}</Text>
                      <Text className="text-[10px] text-gray-400">Justificadas</Text>
                    </View>
                  </View>
                </BentoCard>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
