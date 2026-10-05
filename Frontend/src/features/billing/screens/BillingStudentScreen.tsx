import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { billingApi, formatearMonto, getEstadoBadge, type EstudianteDeuda, type PagoRealizado, type CuotaPlanPago } from '../../../api/billing.api';
import { BentoCard, StatusBadge } from '../../../shared/ui';
import { useAuth } from '../../../context/AuthContext';

export function BillingStudentScreen() {
  const { user } = useAuth();
  const [deuda, setDeuda] = useState<EstudianteDeuda | null>(null);
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [cuotas, setCuotas] = useState<CuotaPlanPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    const estudianteId = Number(user.id);
    try {
      setLoading(true);
      const [deudaRes, pagosRes] = await Promise.all([
        billingApi.getDeudaEstudiante(estudianteId),
        billingApi.listPagos(estudianteId),
      ]);
      if (deudaRes) setDeuda(deudaRes);
      if (pagosRes) setPagos(pagosRes);
    } catch (err) {
      console.warn('[BillingStudentScreen] Error cargando', err);
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, [user?.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Cargando tu estado económico…</Text>
      </View>
    );
  }

  if (!deuda) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 px-6">
        <Ionicons name="checkmark-circle-outline" size={48} color="#16A34A" />
        <Text className="text-gray-700 font-semibold mt-3 text-center">Sin deudas pendientes</Text>
        <Text className="text-sm text-gray-500 mt-1 text-center">Estás al día con tus pagos</Text>
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
          onRefresh={cargar}
          tintColor="#801529"
        />
      }
    >
      {/* Resumen de Deuda */}
      <BentoCard className="p-4">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-[10px] font-bold text-gray-500 uppercase">Estado Económico</Text>
            <Text className="text-lg font-bold text-gray-900">Tu deuda actual</Text>
          </View>
          <StatusBadge
            label={deuda.cuotas_pendientes >= 2 ? 'En mora' : deuda.cuotas_pendientes > 0 ? 'Pendiente' : 'Al día'}
            variant={deuda.cuotas_pendientes >= 2 ? 'danger' : deuda.cuotas_pendientes > 0 ? 'warning' : 'success'}
          />
        </View>

        <View className="flex-row flex-wrap gap-3">
          <View className="flex-1 min-w-[140px] bg-gray-50 rounded-xl p-3">
            <Text className="text-[10px] font-bold text-gray-500 uppercase">Total Deuda</Text>
            <Text className="text-2xl font-bold text-red-600 mt-1">{formatearMonto(deuda.total_deuda)}</Text>
          </View>
          <View className="flex-1 min-w-[140px] bg-gray-50 rounded-xl p-3">
            <Text className="text-[10px] font-bold text-gray-500 uppercase">Cuotas Pendientes</Text>
            <Text className="text-2xl font-bold text-amber-600 mt-1">{deuda.cuotas_pendientes}</Text>
          </View>
          <View className="flex-1 min-w-[140px] bg-gray-50 rounded-xl p-3">
            <Text className="text-[10px] font-bold text-gray-500 uppercase">Próximo Vencimiento</Text>
            <Text className="text-lg font-bold text-gray-900 mt-1">
              {deuda.ultima_cuota_vencimiento ? new Date(deuda.ultima_cuota_vencimiento).toLocaleDateString('es-BO') : '—'}
            </Text>
          </View>
        </View>

        {deuda.cuotas_pendientes >= 2 && (
          <View className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
            <View className="flex-row items-center gap-2">
              <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-red-800">Atención: Tienes 2 o más cuotas pendientes</Text>
                <Text className="text-xs text-red-600 mt-0.5">Se ha notificado a dirección y control según política institucional</Text>
              </View>
            </View>
          </View>
        )}
      </BentoCard>

      {/* Historial de Pagos */}
      <BentoCard className="p-4">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-[10px] font-bold text-gray-500 uppercase">Historial</Text>
            <Text className="text-lg font-bold text-gray-900">Pagos realizados</Text>
          </View>
        </View>

        {pagos.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="receipt-outline" size={32} color="#9CA3AF" />
            <Text className="text-gray-500 mt-2">No hay pagos registrados</Text>
          </View>
        ) : (
          <View className="gap-2">
            {pagos.map((pago) => (
              <View key={pago.id} className="flex-row items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="font-semibold text-gray-900">{formatearMonto(pago.monto)}</Text>
                    <StatusBadge label={pago.metodo} variant="info" />
                    <StatusBadge label={pago.estado} variant={pago.estado === 'confirmado' ? 'success' : 'neutral'} />
                  </View>
                  <Text className="text-sm text-gray-500 mt-0.5">
                    {new Date(pago.fecha_pago).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {pago.numero_transaccion ? ` · Ref: ${pago.numero_transaccion}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </BentoCard>

      {/* Alertas de notificación */}
      {deuda.cuotas_pendientes >= 2 && (
        <BentoCard className="p-4 border border-amber-200 bg-amber-50">
          <View className="flex-row items-start gap-3">
            <Ionicons name="information-circle-outline" size={20} color="#B45309" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-amber-800">Notificación enviada</Text>
              <Text className="text-xs text-amber-700 mt-1">
                Al tener 2 o más cuotas pendientes, se ha notificado automáticamente a:
              </Text>
              <View className="flex-row gap-2 mt-2 flex-wrap">
                <View className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">Estudiante</View>
                <View className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">Dirección</View>
                <View className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs">Control</View>
              </View>
            </View>
          </View>
        </BentoCard>
      )}
    </ScrollView>
  );
}