import React, { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { billingApi, formatearMonto, type EstudianteDeuda, type PagoRealizado, type CuotaPlanPago, type PlanPago } from '../../../api/billing.api';
import { BentoCard, StatusBadge, Button } from '../../../shared/ui';
import { useAuth } from '../../../context/AuthContext';

export function BillingStudentScreen() {
  const { user } = useAuth();
  const [deuda, setDeuda] = useState<EstudianteDeuda | null>(null);
  const [pagos, setPagos] = useState<PagoRealizado[]>([]);
  const [cuotas, setCuotas] = useState<CuotaPlanPago[]>([]);
  const [plan, setPlan] = useState<PlanPago | null>(null);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);

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
      if (deudaRes?.plan_id) {
        const planRes = await billingApi.getPlan(deudaRes.plan_id);
        setPlan(planRes);
        setCuotas(planRes ? await billingApi.listCuotas(planRes.id) : []);
      }
      // Verificar si hay notificación de pago reciente
      if ((deudaRes?.cuotas_pendientes ?? 0) > 0 && pagosRes?.length > 0) {
        const ultimaPago = pagosRes[0];
        setNotificacion(
          `Pago de $${formatearMonto(ultimaPago.monto)} registrado el ${new Date(ultimaPago.fecha_pago).toLocaleDateString('es-BO')}`
        );
      }
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
      contentContainerClassName="gap-3 pb-8"
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={cargar}
          tintColor="#801529"
        />
      }
    >
      {/* Resumen de Deuda */}
      <View className="rounded-2xl bg-[#801F3F] p-5">
        <View className="flex-row items-center justify-between"><View className="bg-[#F3D9B7] rounded-full px-2.5 py-1"><Text className="text-[#801F3F] text-[9px] font-extrabold">ESTADO DE CUENTA</Text></View><Ionicons name="shield-checkmark-outline" size={22} color="#F3D9B7" /></View>
        <Text className="text-white text-xl font-black mt-2">Resumen de pagos</Text>
        <View className="flex-row items-end justify-between mt-4"><View><Text className="text-white/70 text-[9px] font-bold">TOTAL PAGADO</Text><Text className="text-white text-2xl font-black mt-1">{formatearMonto(pagos.filter((p) => p.estado === 'confirmado').reduce((sum, p) => sum + Number(p.monto), 0))}</Text></View><View className="items-end"><Text className="text-[#F3D9B7] text-[9px] font-bold">META DEL PLAN</Text><Text className="text-white text-sm font-bold mt-1">{plan ? formatearMonto(plan.monto_total) : '—'}</Text></View></View>
        <View className="flex-row justify-between mt-3"><Text className="text-white/80 text-[9px] font-bold">PROGRESO DEL PLAN</Text><Text className="text-white text-[9px] font-bold">{cuotas.length ? `${cuotas.filter((c) => c.estado === 'pagado').length} DE ${cuotas.length} CUOTAS` : `${deuda.cuotas_pendientes} PENDIENTES`}</Text></View>
        <View className="h-2 rounded-full bg-white/20 mt-1.5 overflow-hidden"><View className="h-full rounded-full bg-[#F3D9B7]" style={{ width: `${plan?.monto_total ? Math.min(100, (pagos.filter((p) => p.estado === 'confirmado').reduce((sum, p) => sum + Number(p.monto), 0) / plan.monto_total) * 100) : 0}%` }} /></View>

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
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-[#F3D9B7] p-4"><View className="w-8 h-8 rounded-lg bg-[#801F3F]/10 items-center justify-center"><Ionicons name="calendar-outline" size={17} color="#801F3F" /></View><Text className="text-[#9C5367] text-[9px] font-bold mt-3">SIGUIENTE PAGO</Text><Text className="text-[#801F3F] text-base font-black mt-1">{cuotas.find((c) => c.estado === 'pendiente')?.fecha_vencimiento ? new Date(cuotas.find((c) => c.estado === 'pendiente')!.fecha_vencimiento).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) : 'Sin cuotas'}</Text><Text className="text-gray-500 text-[9px] mt-1">{deuda.cuotas_pendientes} cuotas pendientes</Text></View>
        <View className="flex-1 rounded-2xl bg-[#FBF5EC] p-4"><View className="w-8 h-8 rounded-lg bg-[#801F3F]/10 items-center justify-center"><Ionicons name="trending-up-outline" size={17} color="#801F3F" /></View><Text className="text-gray-500 text-[9px] font-bold mt-3">SALDO PENDIENTE</Text><Text className="text-[#801F3F] text-base font-black mt-1">{formatearMonto(deuda.total_deuda)}</Text><Text className="text-gray-500 text-[9px] mt-1">Consulta vencimientos</Text></View>
      </View>

      {/* Historial de Pagos */}
      <BentoCard className="p-4 bg-[#FBF5EC] border border-[#EFE6DB]">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-[10px] font-bold text-gray-500 uppercase">Ledger {new Date().getFullYear()}</Text>
            <Text className="text-lg font-bold text-[#801F3F]">Historial de cuotas</Text>
          </View>
        </View>

        {pagos.length === 0 ? (
          <View className="items-center py-6">
            <Ionicons name="receipt-outline" size={32} color="#9CA3AF" />
            <Text className="text-gray-500 mt-2">No hay pagos registrados</Text>
          </View>
        ) : (
          <View className="gap-2">
            {pagos.map((pago: PagoRealizado) => (
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

      {/* Estado de Cuotas */}
      <BentoCard className="p-4">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-[10px] font-bold text-gray-500 uppercase">Detalle de Cuotas</Text>
          </View>
        </View>

        {cuotas.length === 0 && deuda.cuotas_pendientes > 0 ? (
          <View className="items-center py-4">
            <Text className="text-gray-500">No hay cuotas definidas para este plan</Text>
          </View>
        ) : (
          <View className="p-3">
            {cuotas.map((cuota: CuotaPlanPago) => (
              <View key={cuota.id} className="flex-row items-center justify-between p-2 bg-gray-50 rounded">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-gray-700">Cuota {cuota.numero} - {cuota.mes}/{cuota.anio}</Text>
                  <StatusBadge label={cuota.estado} variant={cuota.estado === 'pagado' ? 'success' : 'warning'} />
                </View>
                <Text className="text-sm text-gray-600">{formatearMonto(cuota.monto)}</Text>
              </View>
            ))}
          </View>
        )}
      </BentoCard>

      {/* Notificación de pago */}
      {notificacion ? (
        <BentoCard className="p-4 border border-amber-200 bg-amber-50">
          <View className="flex-row items-start gap-3">
            <Ionicons name="information-circle-outline" size={20} color="#B45309" />
            <View className="flex-1">
              <Text className="text-sm font-semibold text-amber-800">Notificación de pago</Text>
              <Text className="text-xs text-amber-700 mt-1">{notificacion}</Text>
            </View>
          </View>
        </BentoCard>
      ) : null}
    </ScrollView>
  );
}
