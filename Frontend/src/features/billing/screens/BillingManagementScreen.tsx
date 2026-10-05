import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { billingApi, formatearMonto, getEstadoBadge, type PlanPago } from '../../../api/billing.api';
import { BentoCard, Button, StatusBadge, TextField } from '../../../shared/ui';

interface PlanFormData {
  periodo_id: number;
  nivel: string;
  nombre: string;
  cantidad_cuotas: number;
  monto_total: number;
  monto_cuota: number;
  dia_vencimiento: number;
}

const NIVELES = ['Primaria', 'Secundaria'];

export function BillingManagementScreen() {
  const [planes, setPlanes] = useState<PlanPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanPago | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    periodo_id: 0,
    nivel: 'Primaria',
    nombre: '',
    cantidad_cuotas: 10,
    monto_total: 0,
    monto_cuota: 0,
    dia_vencimiento: 10,
  });

  const cargarPlanes = useCallback(async () => {
    try {
      setLoading(true);
      const respuesta = await billingApi.listPlanos({ limit: 100 });
      if (respuesta) setPlanes(respuesta.data.map(d => d.plan));
    } catch (err) {
      console.warn('[BillingManagementScreen] Error cargando planes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPlanes();
  }, [cargarPlanes]);

  const handleSubmit = async () => {
    try {
      if (editingPlan) {
        await billingApi.updatePlan(editingPlan.id, formData);
      } else {
        await billingApi.createPlan(formData);
      }
      setShowModal(false);
      setEditingPlan(null);
      resetForm();
      await cargarPlanes();
    } catch (err) {
      console.warn('[BillingManagementScreen] Error guardando plan', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que quiere anular este plan?')) return;
    try {
      await billingApi.deletePlan(id);
      await cargarPlanes();
    } catch (err) {
      console.warn('[BillingManagementScreen] Error anulando plan', err);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setEditingPlan(null);
    setShowModal(true);
  };

  const openEditModal = (plan: PlanPago) => {
    setEditingPlan(plan);
    setFormData({
      periodo_id: plan.periodo_id,
      nivel: plan.nivel,
      nombre: plan.nombre,
      cantidad_cuotas: plan.cantidad_cuotas,
      monto_total: plan.monto_total,
      monto_cuota: plan.monto_cuota,
      dia_vencimiento: plan.dia_vencimiento,
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      periodo_id: 0,
      nivel: 'Primaria',
      nombre: '',
      cantidad_cuotas: 10,
      monto_total: 0,
      monto_cuota: 0,
      dia_vencimiento: 10,
    });
  };

  const calcularMontoCuota = (montoTotal: number, cuotas: number) => {
    const total = Number(montoTotal) || 0;
    const c = Number(cuotas) || 1;
    setFormData(prev => ({ ...prev, monto_cuota: Math.round(total / c * 100) / 100 }));
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Cargando planes de pago…</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="gap-4 p-4 pb-10">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Gestión de Planes de Pago</Text>
          <Text className="text-sm text-gray-500">Administra planes, cuotas y cobranza</Text>
        </View>
        <Button label="Nuevo Plan" onPress={openCreateModal} variant="primary" icon="add-outline" />
      </View>

      {/* KPIs Resumen */}
      <View className="flex-row flex-wrap gap-3">
        <BentoCard className="flex-1 min-w-[140px] p-4">
          <Text className="text-[10px] font-bold text-gray-500 uppercase">Total Planes</Text>
          <Text className="text-2xl font-bold text-gray-900 mt-1">{planes.length}</Text>
        </BentoCard>
        <BentoCard className="flex-1 min-w-[140px] p-4">
          <Text className="text-[10px] font-bold text-gray-500 uppercase">Activos</Text>
          <Text className="text-2xl font-bold text-green-600 mt-1">
            {planes.filter(p => p.estado === 'generado').length}
          </Text>
        </BentoCard>
        <BentoCard className="flex-1 min-w-[140px] p-4">
          <Text className="text-[10px] font-bold text-gray-500 uppercase">Anulados</Text>
          <Text className="text-2xl font-bold text-gray-500 mt-1">
            {planes.filter(p => p.estado === 'anulado').length}
          </Text>
        </BentoCard>
      </View>

      {/* Lista de Planes */}
      <BentoCard className="p-4">
        <Text className="text-lg font-bold text-gray-900 mb-4">Planes de Pago</Text>

        {planes.length === 0 ? (
          <View className="items-center py-8">
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text className="text-gray-500 mt-2">No hay planes de pago registrados</Text>
            <Text className="text-sm text-gray-400 mt-1">Crea el primer plan para comenzar</Text>
          </View>
        ) : (
          <View className="gap-3">
            {planes.map((plan) => (
              <View key={plan.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-lg font-bold text-gray-900">{plan.nombre}</Text>
                      <StatusBadge label={plan.estado} variant={plan.estado === 'generado' ? 'success' : plan.estado === 'anulado' ? 'neutral' : 'warning'} />
                    </View>
                    <View className="flex-row items-center gap-4 mt-1 text-sm text-gray-600 flex-wrap">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="layers-outline" size={14} color="#9CA3AF" />
                        <Text>{plan.nivel}</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                        <Text>{plan.cantidad_cuotas} cuotas</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="cash-outline" size={14} color="#9CA3AF" />
                        <Text>{formatearMonto(plan.monto_total)} total</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="card-outline" size={14} color="#9CA3AF" />
                        <Text>{formatearMonto(plan.monto_cuota)} c/u</Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="calendar-number-outline" size={14} color="#9CA3AF" />
                        <Text>Vence día {plan.dia_vencimiento}</Text>
                      </View>
                    </View>
                    {plan.cuotas_pendientes !== undefined && plan.cuotas_pendientes > 0 && (
                      <View className="flex-row items-center gap-2 mt-2">
                        <Ionicons name="warning-outline" size={14} color="#DC2626" />
                        <Text className="text-sm text-red-600 font-medium">
                          {plan.cuotas_pendientes} cuotas pendientes
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Button label="Editar" onPress={() => openEditModal(plan)} variant="ghost" size="sm" icon="create-outline" />
                    <Button label="Anular" onPress={() => handleDelete(plan.id)} variant="danger" size="sm" icon="trash-outline" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </BentoCard>

      {/* Modal Crear/Editar */}
      {showModal && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 bg-black/50 justify-center items-center p-4"
        >
          <View className="bg-white rounded-2xl w-full max-w-md max-h-[90%] overflow-hidden">
            <View className="flex-row items-center justify-between p-4 border-b">
              <Text className="text-xl font-bold">{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); setEditingPlan(null); resetForm(); }}>
                <Ionicons name="close-outline" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4 gap-4" contentContainerClassName="pb-8">
              <TextField
                label="Período ID"
                value={String(formData.periodo_id)}
                onChangeText={v => setFormData(prev => ({ ...prev, periodo_id: Number(v) || 0 }))}
                keyboardType="numeric"
                required
              />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField
                    label="Nivel"
                    value={formData.nivel}
                    onChangeText={v => setFormData(prev => ({ ...prev, nivel: v }))}
                  />
                </View>
                <View className="flex-1">
                  <TextField
                    label="Día Vencimiento"
                    value={String(formData.dia_vencimiento)}
                    onChangeText={v => setFormData(prev => ({ ...prev, dia_vencimiento: Number(v) || 10 }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <TextField
                label="Nombre del Plan"
                value={formData.nombre}
                onChangeText={v => setFormData(prev => ({ ...prev, nombre: v }))}
                required
              />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextField
                    label="Cantidad de Cuotas"
                    value={String(formData.cantidad_cuotas)}
                    onChangeText={v => {
                      const n = Number(v) || 1;
                      setFormData(prev => ({ ...prev, cantidad_cuotas: n }));
                      calcularMontoCuota(formData.monto_total, n);
                    }}
                    keyboardType="numeric"
                    required
                  />
                </View>
                <View className="flex-1">
                  <TextField
                    label="Monto Total"
                    value={String(formData.monto_total)}
                    onChangeText={v => {
                      const m = Number(v) || 0;
                      setFormData(prev => ({ ...prev, monto_total: m }));
                      calcularMontoCuota(m, formData.cantidad_cuotas);
                    }}
                    keyboardType="numeric"
                    required
                  />
                </View>
              </View>
              <TextField
                label="Monto por Cuota (auto)"
                value={formatearMonto(formData.monto_cuota)}
                editable={false}
              />
              <View className="flex-row gap-3 pt-4">
                <Button label="Cancelar" onPress={() => { setShowModal(false); setEditingPlan(null); resetForm(); }} variant="secondary" className="flex-1" />
                <Button label={editingPlan ? 'Actualizar' : 'Crear'} onPress={handleSubmit} variant="primary" className="flex-1" />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      )}
    </ScrollView>
  );
}