import { Ionicons } from '@expo/vector-icons';
import { Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  economiaApi,
  formatearMonto,
  getDeudaBadgeVariant,
  getDeudaLabel,
  getDeudaEstado,
  type EstudianteEconomico,
  type KpisEconomia,
  type PlanPago,
  type CuotaPlanPago,
  type PagoRealizado,
} from '../../../api/economia.api';
import { BentoCard, Button, KpiCard, StatusBadge } from '../../../shared/ui';
import { useAuth } from '../../../context/AuthContext';

type FiltroDeuda = 'todos' | 'al_dia' | 'una_cuota' | 'deudores';
type Tab = 'resumen' | 'estudiantes' | 'deudores';

const FILTROS = [
  { value: 'todos', label: 'Todos', icon: 'list-outline' as const },
  { value: 'al_dia', label: 'Al dia', icon: 'checkmark-circle-outline' as const },
  { value: 'una_cuota', label: '1 cuota', icon: 'alert-circle-outline' as const },
  { value: 'deudores', label: 'Deudores (2+)', icon: 'warning-outline' as const },
];

const TABS = [
  { value: 'resumen', label: 'Resumen', icon: 'home-outline' as const },
  { value: 'estudiantes', label: 'Estudiantes', icon: 'people-outline' as const },
  { value: 'deudores', label: 'Deudores', icon: 'warning-outline' as const },
] as const;

export function EconomyManagementScreen() {
  const { user } = useAuth();
  const isAdmin = user?.rol?.toLowerCase() === 'director' || user?.rol?.toLowerCase() === 'control' || user?.rol?.toLowerCase() === 'admin';

  const [kpis, setKpis] = useState<KpisEconomia | null>(null);
  const [estudiantes, setEstudiantes] = useState<EstudianteEconomico[]>([]);
  const [planes, setPlanes] = useState<PlanPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('resumen');
  const [filtroDeuda, setFiltroDeuda] = useState<FiltroDeuda>('todos');
  const [selectedPlan, setSelectedPlan] = useState<PlanPago | null>(null);
  const [detalleEstudiante, setDetalleEstudiante] = useState<{
    estudiante: EstudianteEconomico;
    plan: PlanPago;
    cuotas: CuotaPlanPago[];
    pagos: PagoRealizado[];
  } | null>(null);
  const [showDetalleModal, setShowDetalleModal] = useState(false);

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      const [kpisRes, estudiantesRes, planesRes] = await Promise.all([
        economiaApi.getKpis(),
        economiaApi.getEstudiantesPorPlan({ filtro_deuda: filtroDeuda }),
        economiaApi.listPlanos({ limit: 100 }),
      ]);
      if (kpisRes) setKpis(kpisRes);
      if (estudiantesRes) setEstudiantes(estudiantesRes.data);
      if (planesRes) setPlanes(planesRes.data.map(d => d.plan));
    } catch (err) {
      console.warn('[EconomyManagementScreen] Error cargando', err);
    } finally {
      setLoading(false);
      setRefrescando(false);
    }
  }, [filtroDeuda]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const handleVerDetalle = async (estudiante: EstudianteEconomico) => {
    try {
      const detalle = await economiaApi.getEstudianteDetalle(estudiante.id);
      if (detalle) {
        setDetalleEstudiante(detalle);
        setShowDetalleModal(true);
      }
    } catch (err) {
      console.warn('[EconomyManagementScreen] Error cargando detalle', err);
    }
  };

  const estudiantesAgrupados = useMemo(() => {
    const grupos: Record<string, Record<string, Record<string, EstudianteEconomico[]>>> = {};
    for (const est of estudiantes) {
      const nivel = est.nivel || 'Sin nivel';
      const grado = est.grado || 'Sin grado';
      const paralelo = est.paralelo || 'Sin paralelo';
      if (!grupos[nivel]) grupos[nivel] = {};
      if (!grupos[nivel][grado]) grupos[nivel][grado] = {};
      if (!grupos[nivel][grado][paralelo]) grupos[nivel][grado][paralelo] = [];
      grupos[nivel][grado][paralelo].push(est);
    }
    return grupos;
  }, [estudiantes]);

  const niveles = useMemo(() => Object.keys(estudiantesAgrupados).sort(), [estudiantesAgrupados]);

  const kpiItems = kpis ? [
    { label: 'Total Estudiantes', value: String(kpis.total_estudiantes), icon: 'people-outline' as const, color: '#801529' },
    { label: 'Pagos este Mes', value: String(kpis.pagos_mes_actual), icon: 'calendar-outline' as const, color: '#16A34A' },
    { label: 'Recaudado', value: formatearMonto(kpis.monto_recaudado_mes), icon: 'cash-outline' as const, color: '#0D9488' },
    { label: 'Pendiente', value: formatearMonto(kpis.monto_pendiente), icon: 'time-outline' as const, color: '#B45309' },
  ] : [];

  const estudiantesFiltrados = useMemo(() => {
    if (filtroDeuda === 'todos') return estudiantes;
    return estudiantes.filter(e => getDeudaEstado(e.cuotas_pendientes) === filtroDeuda);
  }, [estudiantes, filtroDeuda]);

  // Pre-compute complex nested structures to avoid nested map in JSX
  const resumenTabContent = useMemo(() => {
    const activePlanes = planes.filter(p => p.estado === 'generado');
    const planCards = activePlanes.map((plan) => (
      <TouchableOpacity
        key={plan.id}
        onPress={() => setSelectedPlan(plan)}
        className="bg-white border border-gray-200 rounded-xl p-4"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="font-bold text-gray-900">{plan.nombre}</Text>
            <View className="flex-row items-center gap-3 mt-1 text-sm text-gray-600 flex-wrap">
              <View className="flex-row items-center gap-1">
                <Ionicons name="layers-outline" size={14} color="#9CA3AF" />
                <Text>{plan.nivel}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                <Text>{plan.cantidad_cuotas} cuotas . {formatearMonto(plan.monto_cuota)} c/u</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Ionicons name="cash-outline" size={14} color="#9CA3AF" />
                <Text>Total: {formatearMonto(plan.monto_total)}</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    ));

    return (
      <View className="gap-4">
        <BentoCard className="p-4">
          <Text className="text-lg font-bold text-gray-900 mb-4">Estudiantes por Estado</Text>
          <View className="flex-row flex-wrap gap-3">
            <BentoCard className="flex-1 min-w-[140px] p-4 border-l-4 border-green-500">
              <Text className="text-[10px] font-bold text-gray-500 uppercase">Al dia</Text>
              <Text className="text-2xl font-bold text-green-600 mt-1">{kpis?.estudiantes_al_dia ?? 0}</Text>
            </BentoCard>
            <BentoCard className="flex-1 min-w-[140px] p-4 border-l-4 border-amber-500">
              <Text className="text-[10px] font-bold text-gray-500 uppercase">1 Cuota</Text>
              <Text className="text-2xl font-bold text-amber-600 mt-1">{kpis?.estudiantes_una_cuota ?? 0}</Text>
            </BentoCard>
            <BentoCard className="flex-1 min-w-[140px] p-4 border-l-4 border-red-500">
              <Text className="text-[10px] font-bold text-gray-500 uppercase">Deudores (2+)</Text>
              <Text className="text-2xl font-bold text-red-600 mt-1">{kpis?.estudiantes_deudores ?? 0}</Text>
            </BentoCard>
          </View>
        </BentoCard>

        <BentoCard className="p-4">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Planes de Pago Activos</Text>
            {isAdmin && <Button label="Crear" size="sm" onPress={() => setSelectedPlan({} as PlanPago)} variant="secondary" icon="add-outline" />}
          </View>
          {activePlanes.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 mt-2">No hay planes activos</Text>
            </View>
          ) : (
            <View className="gap-3">{planCards}</View>
          )}
        </BentoCard>
      </View>
    );
  }, [kpis, planes, isAdmin, formatearMonto]);

  // Pre-compute estudiantes tab content
  const estudiantesTabContent = useMemo(() => {
    if (niveles.length === 0) {
      return (
        <BentoCard className="p-8 items-center">
          <Ionicons name="people-outline" size={48} color="#9CA3AF" />
          <Text className="text-gray-500 mt-2">No hay estudiantes registrados</Text>
        </BentoCard>
      );
    }

    // Build nivel sections
    const nivelSections = niveles.map((nivel) => {
      const gradoSections = Object.keys(estudiantesAgrupados[nivel]).sort().map((grado) => {
        const paraleloItems = Object.keys(estudiantesAgrupados[nivel][grado]).sort().map((paralelo) => {
          const estudianteItems = estudiantesAgrupados[nivel][grado][paralelo].map((est) => {
            const deudaEstado = getDeudaEstado(est.cuotas_pendientes);
            return (
              <TouchableOpacity
                key={est.id}
                onPress={() => handleVerDetalle(est)}
                className="flex-row items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100"
              >
                <View className="flex-row items-center gap-2 flex-1 min-w-0">
                  <View className="w-8 h-8 rounded-full bg-maroon/10 items-center justify-center">
                    <Ionicons name="person-outline" size={16} color="#801529" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="font-medium text-gray-900 truncate">{est.nombre} {est.apellido_paterno}</Text>
                    <View className="flex-row items-center gap-2 mt-0.5">
                      <StatusBadge
                        label={getDeudaLabel(getDeudaEstado(est.cuotas_pendientes))}
                        variant={getDeudaBadgeVariant(getDeudaEstado(est.cuotas_pendientes))}
                      />
                      <Text className="text-xs text-gray-500">{est.cuotas_pagadas}/{est.cuotas_pagadas + est.cuotas_pendientes} cuotas</Text>
                    </View>
                  </View>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-bold text-red-600">{formatearMonto(est.total_deuda)}</Text>
                  <Ionicons name="chevron-forward-outline" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          });

          return (
            <View key={paralelo} className="ml-3 mt-2 gap-1">
              <Text className="text-xs font-medium text-gray-500 uppercase">Paralelo {paralelo}</Text>
              <View className="gap-1">{estudianteItems}</View>
            </View>
          );
        });

        return (
          <View key={grado} className="ml-4 mt-3 gap-2 border-l-2 border-gray-200 pl-3">
            <Text className="text-sm font-semibold text-gray-700">{grado} Grado</Text>
            {paraleloItems}
          </View>
        );
      });

      return (
        <BentoCard key={nivel} className="p-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center gap-2">
              <Ionicons name={nivel === 'Primaria' ? 'school-outline' : 'book-outline'} size={20} color="#801529" />
              <Text className="text-lg font-bold text-gray-900">{nivel}</Text>
            </View>
            <StatusBadge label={`${Object.values(estudiantesAgrupados[nivel]).flatMap(g => Object.values(g)).flat().length} estudiantes`} variant="info" />
          </View>
          {gradoSections}
        </BentoCard>
      );
    });

    return (
      <View className="gap-4">
        <View className="flex-row flex-wrap gap-2">
          {FILTROS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFiltroDeuda(f.value as FiltroDeuda)}
              className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg border ${filtroDeuda === f.value ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'}`}
            >
              <Ionicons name={f.icon} size={16} color={filtroDeuda === f.value ? '#801529' : '#9CA3AF'} />
              <Text className={`text-sm font-semibold ${filtroDeuda === f.value ? 'text-maroon' : 'text-gray-700'}`}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="gap-4">{nivelSections}</View>
      </View>
    );
  }, [estudiantes, estudiantesAgrupados, niveles, filtroDeuda, estudiantesFiltrados, formatearMonto]);

  const deudoresTabContent = useMemo(() => {
    const deudores = estudiantesFiltrados.filter(e => e.cuotas_pendientes >= 2);

    const deudorItems = deudores
      .sort((a, b) => b.cuotas_pendientes - a.cuotas_pendientes || b.total_deuda - a.total_deuda)
      .map((est) => (
        <TouchableOpacity
          key={est.id}
          onPress={() => handleVerDetalle(est)}
          className="flex-row items-center justify-between p-3 bg-red-50 border border-red-100 rounded-xl"
        >
          <View className="flex-row items-center gap-3 flex-1 min-w-0">
            <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center">
              <Ionicons name="person-outline" size={20} color="#DC2626" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="font-bold text-gray-900 truncate">{est.nombre} {est.apellido_paterno}</Text>
              <View className="flex-row items-center gap-2 mt-0.5">
                <Text className="text-xs text-gray-500">{est.nivel} . {est.grado} Grado {est.paralelo}</Text>
                <StatusBadge label={`${est.cuotas_pendientes} cuotas`} variant="danger" />
                <Text className="text-xs text-gray-500">Debe: {formatearMonto(est.total_deuda)}</Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward-outline" size={20} color="#DC2626" />
        </TouchableOpacity>
      ));

      return (
        <View className="gap-4">
          <BentoCard className="p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900">Estudiantes Deudores (2+ cuotas)</Text>
              <StatusBadge label={`${deudores.length} estudiantes`} variant="danger" />
            </View>

            {deudores.length === 0 ? (
              <View className="items-center py-8">
                <Ionicons name="checkmark-circle-outline" size={48} color="#16A34A" />
                <Text className="text-gray-700 font-semibold mt-3">No hay deudores con 2+ cuotas</Text>
                <Text className="text-sm text-gray-500 mt-1">Todos los estudiantes estan al dia o con 1 cuota pendiente</Text>
              </View>
            ) : (
              <View className="gap-2">{deudorItems}</View>
            )}
          </BentoCard>
        </View>
      );
    }, [estudiantesFiltrados, formatearMonto]);

  const detalleModalContent = useMemo(() => {
    if (!showDetalleModal || !detalleEstudiante) return null;

    const est = detalleEstudiante.estudiante;
    const deudaEstado = getDeudaEstado(est.cuotas_pendientes);
    const badgeVariant = getDeudaBadgeVariant(deudaEstado);
    const badgeColor = badgeVariant === 'danger' ? '#DC2626' : badgeVariant === 'warning' ? '#B45309' : '#16A34A';
    const badgeBg = badgeVariant === 'danger' ? 'bg-red-100' : badgeVariant === 'warning' ? 'bg-amber-100' : 'bg-green-100';

    const cuotaItems = detalleEstudiante.cuotas.map((cuota) => (
      <View
        key={cuota.id}
        className={`flex-row items-center justify-between p-3 rounded-lg ${cuota.estado === 'pagado' ? 'bg-green-50' : cuota.estado === 'pendiente' ? 'bg-amber-50' : 'bg-gray-50'}`}
      >
        <View className="flex-row items-center gap-2 flex-1">
          <View className={`w-6 h-6 rounded-full border-2 ${cuota.estado === 'pagado' ? 'border-green-500 bg-green-500' : cuota.estado === 'pendiente' ? 'border-amber-500' : 'border-gray-300'}`} />
          <View>
            <Text className="font-medium text-gray-900">Cuota {cuota.numero} - {cuota.mes}/{cuota.anio}</Text>
            <Text className="text-xs text-gray-500">Vence: {new Date(cuota.fecha_vencimiento).toLocaleDateString('es-BO')}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <Text className="font-bold text-gray-900">{formatearMonto(cuota.monto)}</Text>
          <StatusBadge
            label={cuota.estado}
            variant={cuota.estado === 'pagado' ? 'success' : cuota.estado === 'pendiente' ? 'warning' : 'neutral'}
          />
        </View>
      </View>
    ));

    const pagoItems = detalleEstudiante.pagos.map((pago) => (
      <View key={pago.id} className="flex-row items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-semibold text-gray-900">{formatearMonto(pago.monto)}</Text>
            <StatusBadge label={pago.metodo} variant="info" />
            <StatusBadge label={pago.estado} variant={pago.estado === 'confirmado' ? 'success' : 'neutral'} />
          </View>
          <Text className="text-sm text-gray-500 mt-0.5">
            {new Date(pago.fecha_pago).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {pago.numero_transaccion ? ` . Ref: ${pago.numero_transaccion}` : ''}
          </Text>
        </View>
      </View>
    ));

    return (
      <Modal visible={showDetalleModal} animationType="slide" transparent>
        <TouchableOpacity onPress={() => { setShowDetalleModal(false); setDetalleEstudiante(null); }} activeOpacity={1}>
          <View className="flex-1 bg-black/50 justify-center items-center p-4">
            <View className="bg-white rounded-2xl w-full max-w-lg max-h-[90%] overflow-hidden">
              <View className="flex-row items-center justify-between p-4 border-b bg-red-50">
                <View className="flex-row items-center gap-2">
                  <View className={`w-8 h-8 rounded-full ${badgeBg} items-center justify-center`}>
                    <Ionicons name="person-outline" size={20} color={badgeColor} />
                  </View>
                  <View>
                    <Text className="font-bold text-gray-900">{est.nombre} {est.apellido_paterno}</Text>
                    <Text className="text-xs text-gray-500">{est.nivel} . {est.grado} Grado {est.paralelo}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => { setShowDetalleModal(false); setDetalleEstudiante(null); }}>
                  <Ionicons name="close-outline" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView className="p-4 gap-4" contentContainerClassName="pb-8">
                <BentoCard className="p-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-bold text-gray-900">Estado Economico</Text>
                    <StatusBadge label={getDeudaLabel(deudaEstado)} variant={badgeVariant} />
                  </View>
                  <View className="flex-row flex-wrap gap-3">
                    <View className="flex-1 min-w-[120px] bg-gray-50 rounded-xl p-3">
                      <Text className="text-[10px] font-bold text-gray-500 uppercase">Total Deuda</Text>
                      <Text className="text-2xl font-bold text-red-600 mt-1">{formatearMonto(est.total_deuda)}</Text>
                    </View>
                    <View className="flex-1 min-w-[120px] bg-gray-50 rounded-xl p-3">
                      <Text className="text-[10px] font-bold text-gray-500 uppercase">Cuotas Pendientes</Text>
                      <Text className="text-2xl font-bold text-amber-600 mt-1">{est.cuotas_pendientes}</Text>
                    </View>
                    <View className="flex-1 min-w-[120px] bg-gray-50 rounded-xl p-3">
                      <Text className="text-[10px] font-bold text-gray-500 uppercase">Cuotas Pagadas</Text>
                      <Text className="text-2xl font-bold text-green-600 mt-1">{est.cuotas_pagadas}</Text>
                    </View>
                    <View className="flex-1 min-w-[120px] bg-gray-50 rounded-xl p-3">
                      <Text className="text-[10px] font-bold text-gray-500 uppercase">Recaudado</Text>
                      <Text className="text-xl font-bold text-gray-900 mt-1">{formatearMonto(est.monto_pagado)}</Text>
                    </View>
                  </View>
                </BentoCard>

                <BentoCard className="p-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-lg font-bold text-gray-900">Plan de Pago</Text>
                    <StatusBadge label={detalleEstudiante.plan.estado} variant={detalleEstudiante.plan.estado === 'generado' ? 'success' : 'neutral'} />
                  </View>
                  <View className="gap-2 text-sm text-gray-600">
                    <View className="flex-row justify-between">
                      <Text>{detalleEstudiante.plan.nombre}</Text>
                      <Text className="font-semibold">{formatearMonto(detalleEstudiante.plan.monto_total)}</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text>{detalleEstudiante.plan.cantidad_cuotas} cuotas de {formatearMonto(detalleEstudiante.plan.monto_cuota)}</Text>
                      <Text className="font-semibold">Vence dia {detalleEstudiante.plan.dia_vencimiento}</Text>
                    </View>
                  </View>
                </BentoCard>

                <BentoCard className="p-4">
                  <Text className="text-lg font-bold text-gray-900 mb-3">Detalle de Cuotas</Text>
                  <View className="gap-1">
                    {detalleEstudiante.cuotas.map((cuota) => (
                      <View
                        key={cuota.id}
                        className={`flex-row items-center justify-between p-3 rounded-lg ${cuota.estado === 'pagado' ? 'bg-green-50' : cuota.estado === 'pendiente' ? 'bg-amber-50' : 'bg-gray-50'}`}
                      >
                        <View className="flex-row items-center gap-2 flex-1">
                          <View className={`w-6 h-6 rounded-full border-2 ${cuota.estado === 'pagado' ? 'border-green-500 bg-green-500' : cuota.estado === 'pendiente' ? 'border-amber-500' : 'border-gray-300'}`} />
                          <View>
                            <Text className="font-medium text-gray-900">Cuota {cuota.numero} - {cuota.mes}/{cuota.anio}</Text>
                            <Text className="text-xs text-gray-500">Vence: {new Date(cuota.fecha_vencimiento).toLocaleDateString('es-BO')}</Text>
                          </View>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <Text className="font-bold text-gray-900">{formatearMonto(cuota.monto)}</Text>
                          <StatusBadge
                            label={cuota.estado}
                            variant={cuota.estado === 'pagado' ? 'success' : cuota.estado === 'pendiente' ? 'warning' : 'neutral'}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </BentoCard>

                {detalleEstudiante.pagos.length > 0 && (
                  <BentoCard className="p-4">
                    <Text className="text-lg font-bold text-gray-900 mb-3">Pagos Realizados</Text>
                    <View className="gap-2">
                      {detalleEstudiante.pagos.map((pago) => (
                        <View key={pago.id} className="flex-row items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <Text className="font-semibold text-gray-900">{formatearMonto(pago.monto)}</Text>
                              <StatusBadge label={pago.metodo} variant="info" />
                              <StatusBadge label={pago.estado} variant={pago.estado === 'confirmado' ? 'success' : 'neutral'} />
                            </View>
                            <Text className="text-sm text-gray-500 mt-0.5">
                              {new Date(pago.fecha_pago).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              {pago.numero_transaccion ? ` . Ref: ${pago.numero_transaccion}` : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </BentoCard>
                )}
              </ScrollView>
            </View>
          </View>
          </TouchableOpacity>
        </Modal>
      );
    }, [showDetalleModal, detalleEstudiante, formatearMonto]);

  const planModalContent = useMemo(() => {
    if (!selectedPlan) return null;
    const isNew = !selectedPlan.id;
    return (
      <Modal visible={true} animationType="slide" transparent>
        <TouchableOpacity onPress={() => setSelectedPlan(null)} activeOpacity={1}>
          <View className="flex-1 bg-black/50 justify-center items-center p-4">
            <View className="bg-white rounded-2xl w-full max-w-md max-h-[90%] overflow-hidden">
              <View className="flex-row items-center justify-between p-4 border-b">
                <Text className="text-xl font-bold">{selectedPlan.id ? 'Editar Plan: ' + selectedPlan.nombre : 'Nuevo Plan de Pago'}</Text>
                <TouchableOpacity onPress={() => setSelectedPlan(null)}>
                  <Ionicons name="close-outline" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              <View className="p-4">
                <Text className="text-center text-gray-500 py-8">Formulario de plan (pendiente implementar)</Text>
                <Button label="Cerrar" onPress={() => setSelectedPlan(null)} variant="primary" className="mt-4" />
              </View>
            </View>
          </View>
          </TouchableOpacity>
        </Modal>
      );
    }, [selectedPlan]);

  // ===== LOADING STATE =====
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Text className="text-gray-500">Cargando economia...</Text>
      </View>
    );
  }

  // ===== MAIN RETURN =====
  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={cargarDatos}
          tintColor="#801529"
        />
      }
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-2xl font-bold text-gray-900">Economia</Text>
          <Text className="text-sm text-gray-500">Gestion de cobranza y planes de pago</Text>
        </View>
        {isAdmin && (
          <Button label="Nuevo Plan" onPress={() => setSelectedPlan({} as PlanPago)} variant="primary" icon="add-outline" />
        )}
      </View>

      <View className="flex-row flex-wrap gap-3">
        {kpiItems.map((kpi, i) => (
          <KpiCard
            key={i}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            iconColor={kpi.color}
          />
        ))}
      </View>

      <View className="flex-row gap-2 border-b border-gray-200 pb-2">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            onPress={() => setActiveTab(tab.value)}
            className={`flex-row items-center gap-1.5 px-3 py-2 rounded-lg ${activeTab === tab.value ? 'bg-maroon/10 border border-maroon' : 'bg-white border border-gray-200'}`}
          >
            <Ionicons name={tab.icon} size={18} color={activeTab === tab.value ? '#801529' : '#9CA3AF'} />
            <Text className={`text-sm font-semibold ${activeTab === tab.value ? 'text-maroon' : 'text-gray-700'}`}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'resumen' && resumenTabContent}
      {activeTab === 'estudiantes' && estudiantesTabContent}
      {activeTab === 'deudores' && deudoresTabContent}

      {detalleModalContent}
      {planModalContent}
    </ScrollView>
  );
}