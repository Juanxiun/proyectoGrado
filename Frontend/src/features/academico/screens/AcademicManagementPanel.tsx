import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicManagementApi, academicServicesApi, type EstadoGestion } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { BirthDatePicker } from '../../usuarios/components/BirthDatePicker';
import { useRealtimeResource } from '../../../hooks/useRealtimeResource';
import { GestionWizardModal } from '../components/GestionWizardModal';

type PeriodRow = {
  id: string;
  anio: number;
  nombre: string;
  estado: string;
  activo: boolean;
  inicioGestion: string;
  finGestion: string;
};

type FormState = {
  anio: string;
  nombre: string;
  inicioGestion: string;
  finGestion: string;
  inicio1: string;
  fin1: string;
  inicio2: string;
  fin2: string;
  inicio3: string;
  fin3: string;
  paralelos: string;
  capacidadMaxima: string;
  turno: 'manana' | 'tarde';
  montoCuota: string;
};

const dateString = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const makeForm = (): FormState => {
  const year = new Date().getFullYear();
  return {
    anio: String(year),
    nombre: `Gestión Escolar ${year}`,
    inicioGestion: dateString(year, 2, 2),
    finGestion: dateString(year, 12, 18),
    inicio1: dateString(year, 2, 2),
    fin1: dateString(year, 5, 29),
    inicio2: dateString(year, 5, 30),
    fin2: dateString(year, 9, 18),
    inicio3: dateString(year, 9, 19),
    fin3: dateString(year, 12, 18),
    paralelos: '1',
    capacidadMaxima: '30',
    turno: 'manana',
    montoCuota: '350',
  };
};

const inputClass = 'bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800';
const buttonClass = 'rounded-xl px-3 py-2.5 items-center justify-center';

export function AcademicManagementPanel({ onNavigate }: { onNavigate?: (route: string, params?: { periodoId?: string }) => void }) {
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [state, setState] = useState<EstadoGestion | null>(null);
  const [form, setForm] = useState<FormState>(makeForm);
  const [mode, setMode] = useState<'scratch' | 'clone'>('scratch');
  const [sourceId, setSourceId] = useState('');
  const [subjects, setSubjects] = useState<Array<Record<string, any>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, any>>>([]);
  const [malla, setMalla] = useState({ nivel: 'primaria', grado: '1°', materiaId: '', tipoMateria: 'principal', cargaHorariaSemanal: '5', pesoSintactico: '3' });
  const [showForm, setShowForm] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPeriods = useCallback(async () => {
    try {
      const response = await academicManagementApi.listPeriods({});
      const rows = (response.data ?? []) as unknown as PeriodRow[];
      setPeriods(rows);
      if (!selectedId && rows.length) {
        const currentYear = new Date().getFullYear();
        const preferred = rows.find((row) => row.anio === currentYear)
          ?? rows.find((row) => !row.activo)
          ?? rows[0];
        setSelectedId(preferred.id);
      }
    } catch (error) {
      Alert.alert('No se pudieron cargar las gestiones', error instanceof Error ? error.message : 'Intente nuevamente');
    }
  }, [selectedId]);

  const loadState = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setState(await academicManagementApi.getState(id));
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => { void loadPeriods(); }, [loadPeriods]);
  useEffect(() => { void loadState(selectedId); }, [loadState, selectedId]);
  useEffect(() => {
    academicServicesApi.list('materias', { activo: 'true', limit: 100 })
      .then((response) => setSubjects((response.data ?? []) as Array<Record<string, any>>))
      .catch(() => undefined);
    academicManagementApi.listEnrollmentRequests()
      .then((response) => setRequests(response as Array<Record<string, any>>))
      .catch(() => undefined);
  }, []);

  // Escuchar cambios de datos vía SignalR/Webhooks en tiempo real
  useRealtimeResource('periodos', () => {
    void loadPeriods();
    if (selectedId) void loadState(selectedId);
  });
  useRealtimeResource('cursos', () => {
    if (selectedId) void loadState(selectedId);
  });

  const processRequest = async (id: string, approve: boolean) => {
    setSaving(true);
    try {
      if (approve) await academicManagementApi.approveEnrollmentRequest(id);
      else await academicManagementApi.rejectEnrollmentRequest(id);
      setRequests((current) => current.filter((request) => String(request.id) !== id));
    } catch (error) {
      Alert.alert('No se pudo procesar la solicitud', error instanceof Error ? error.message : 'Intente nuevamente');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const isEditing = Boolean(state && ['borrador', 'configuracion'].includes(state.estado));

  const refresh = async (id = selectedId) => {
    await Promise.all([loadPeriods(), loadState(id)]);
  };

  const submitPeriod = async () => {
    const payload = {
      anio: Number(form.anio),
      nombre: form.nombre.trim(),
      inicioGestion: form.inicioGestion,
      finGestion: form.finGestion,
      trimestres: [
        { numero: 1, inicio: form.inicio1, fin: form.fin1 },
        { numero: 2, inicio: form.inicio2, fin: form.fin2 },
        { numero: 3, inicio: form.inicio3, fin: form.fin3 },
      ],
    };
    if (mode === 'clone' && !sourceId) {
      Alert.alert('Gestión origen requerida', 'Seleccione la gestión que desea clonar.');
      return;
    }
    setSaving(true);
    try {
      const response = mode === 'clone'
        ? await academicManagementApi.clone(sourceId, payload)
        : await academicManagementApi.create(payload);
      const id = String((response as { id?: string }).id ?? '');
      setSelectedId(id);
      setShowForm(false);
      await refresh(id);
      Alert.alert('Gestión guardada', 'La configuración quedó creada en estado borrador/configuración.');
    } catch (error) {
      Alert.alert('No se pudo guardar la gestión', error instanceof Error ? error.message : 'Revise las fechas y trimestres.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (label: string, action: () => Promise<EstadoGestion>) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const result = await action();
      setState(result);
      Alert.alert(label, 'La operación se completó correctamente.');
      await loadPeriods();
    } catch (error) {
      Alert.alert(label, error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setSaving(false);
    }
  };

  const deactivateSelectedPeriod = () => {
    const period = periods.find((item) => item.id === selectedId);
    if (!period) return;
    Alert.alert(
      `Desactivar gestión ${period.anio}`,
      'La gestión dejará de estar activa y podrá editarse antes de completar su nueva activación.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar',
          style: 'destructive',
          onPress: () => {
            void runAction('Gestión desactivada', () => academicManagementApi.deactivate(period.id));
          },
        },
      ],
    );
  };

  const removeSelectedPeriod = () => {
    const period = periods.find((item) => item.id === selectedId);
    if (!period) return;
    Alert.alert(
      'Eliminar gestión escolar',
      `Se eliminarán “${period.nombre}” y sus cursos, inscripciones, datos de estudiantes, pensiones, pagos, horarios, materiales y calificaciones relacionados. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSaving(true);
              let result: Awaited<ReturnType<typeof academicManagementApi.deletePeriod>>;
              try {
                result = await academicManagementApi.deletePeriod(period.id);
              } catch (error) {
                Alert.alert('No se pudo eliminar la gestión', error instanceof Error ? error.message : 'Intente nuevamente');
                setSaving(false);
                return;
              }

              try {
                const response = await academicManagementApi.listPeriods({});
                const nextRows = (response.data ?? []) as unknown as PeriodRow[];
                setPeriods(nextRows);
                const nextId = nextRows[0]?.id ?? '';
                setSelectedId(nextId);
                setState(null);
                if (nextId) {
                  try {
                    setState(await academicManagementApi.getState(nextId));
                  } catch {
                    // La eliminación ya se confirmó; una falla al refrescar la
                    // gestión siguiente no debe mostrarse como eliminación fallida.
                  }
                }
              } catch {
                // La eliminación ya se confirmó; si falla el refresco, se
                // recarga la pantalla la próxima vez que se abra el panel.
              }
              Alert.alert(
                'Gestión eliminada',
                `Se eliminaron ${result.cursos} curso(s), ${result.inscripciones} inscripción(es) y los registros de ${result.estudiantes} estudiante(s) vinculados.`,
              );
              setSaving(false);
            })();
          },
        },
      ],
    );
  };

  const addMalla = async () => {
    if (!selectedId || !malla.materiaId) {
      Alert.alert('Malla incompleta', 'Seleccione una materia antes de guardar.');
      return;
    }
    setSaving(true);
    try {
      await academicManagementApi.saveCurriculumEntry({
        periodoId: selectedId,
        nivel: malla.nivel,
        grado: malla.grado,
        materiaId: malla.materiaId,
        tipoMateria: malla.tipoMateria,
        cargaHorariaSemanal: Number(malla.cargaHorariaSemanal) || 1,
        pesoSintactico: Number(malla.pesoSintactico) || 1,
      });
      setMalla((current) => ({ ...current, materiaId: '' }));
      await loadState(selectedId);
      Alert.alert('Malla guardada', 'La materia se agregó a la malla curricular.');
    } catch (error) {
      Alert.alert('No se pudo guardar la malla', error instanceof Error ? error.message : 'Intente nuevamente');
    } finally {
      setSaving(false);
    }
  };

  const hasPaymentAmount = Boolean(form.montoCuota && Number(form.montoCuota) > 0);
  const canEditPaymentPlan = Boolean(state && !['cerrado', 'cancelado'].includes(state.estado));

  const activateWithPaymentPlans = async () => {
    if (!state?.planPagosGenerado) {
      await academicManagementApi.generatePaymentPlan(selectedId, {
        montosPorNivel: {
          primaria: Number(form.montoCuota),
          secundaria: Number(form.montoCuota),
        },
        diaVencimiento: 10,
      });
    }
    return academicManagementApi.activate(selectedId);
  };

  const structureTurnos = Object.fromEntries(
    ['primaria', 'secundaria'].flatMap((nivel) => ['1°', '2°', '3°', '4°', '5°', '6°'].flatMap((grado) => Array.from({ length: Math.max(1, Number(form.paralelos) || 1) }, (_, index) => [`${nivel}:${grado}:${String.fromCharCode(65 + index)}`, form.turno])))
  );

  return (
    <BentoCard className="p-5 border border-maroon/20">
      <View className="flex-row items-start justify-between gap-3 flex-wrap">
        <View className="flex-1 min-w-[200px]">
          <Text className="text-lg font-bold text-gray-900">Configuración de la gestión</Text>
          <Text className="text-xs text-gray-500 mt-1">Cree la gestión mediante el asistente guiado paso a paso o personalice manualmente.</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setShowWizard(true)}
            className="flex-row items-center gap-1.5 px-4 py-2.5 bg-emerald-700 rounded-xl shadow"
          >
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text className="text-xs font-bold text-white">Configurar Nueva Gestión</Text>
          </TouchableOpacity>
        </View>
      </View>

      <GestionWizardModal
        visible={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={(newGestion) => {
          void refresh(newGestion.id);
          setSelectedId(newGestion.id);
          setShowWizard(false);
          onNavigate?.('Horarios', { periodoId: newGestion.id });
        }}
      />

      <View className="mt-4 gap-2">
        <Text className="text-xs font-bold text-gray-700">Gestión seleccionada</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {periods.map((period) => (
            <TouchableOpacity
              key={period.id}
              onPress={() => setSelectedId(period.id)}
              className={`mr-2 px-3 py-2 rounded-xl border ${selectedId === period.id ? 'bg-maroon border-maroon' : 'bg-white border-gray-200'}`}
            >
              <Text className={`text-xs font-bold ${selectedId === period.id ? 'text-white' : 'text-gray-700'}`}>{period.nombre}</Text>
              <Text className={`text-[10px] ${selectedId === period.id ? 'text-white/80' : 'text-gray-400'}`}>{period.estado}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {state && (
        <View className="mt-4 gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-bold text-gray-800">Estado de configuración</Text>
            <StatusBadge label={state.estado} variant={state.activo ? 'success' : 'warning'} />
          </View>
          <Text className="text-xs text-gray-500">Cursos: {state.totalCursos} · Horarios: {state.totalHorarios} · Planes: {state.totalPlanes}</Text>
           {state.anio === new Date().getFullYear() && state.activo && !state.horariosGenerados && (
             <Text className="text-xs text-amber-700">La gestión {state.anio} está activa para recibir inscripciones. Puedes continuar completando los horarios.</Text>
           )}
          {state.bloqueos.length > 0 && (
            <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 gap-1">
              {state.bloqueos.map((block) => <Text key={block} className="text-xs text-amber-800">• {block}</Text>)}
            </View>
          )}
          <View className="flex-row flex-wrap gap-2 mt-1">
            <TouchableOpacity disabled={!isEditing || saving} onPress={() => runAction('Estructura generada', () => academicManagementApi.generateStructure(selectedId, {
              niveles: [
                { nivel: 'primaria', grados: ['1°', '2°', '3°', '4°', '5°', '6°'], paralelos: Object.fromEntries(['1°', '2°', '3°', '4°', '5°', '6°'].map((grade) => [grade, Number(form.paralelos) || 1])) },
                { nivel: 'secundaria', grados: ['1°', '2°', '3°', '4°', '5°', '6°'], paralelos: Object.fromEntries(['1°', '2°', '3°', '4°', '5°', '6°'].map((grade) => [grade, Number(form.paralelos) || 1])) },
              ],
              turnoPorCurso: structureTurnos,
              capacidadMaxima: Number(form.capacidadMaxima) || 30,
            }))} className={`${buttonClass} bg-gray-100`}><Text className="text-xs font-bold text-gray-700">Generar cursos</Text></TouchableOpacity>
            <TouchableOpacity disabled={!isEditing || saving} onPress={() => onNavigate?.('Horarios', { periodoId: selectedId })} className={`${buttonClass} bg-gray-100`}><Text className="text-xs font-bold text-gray-700">Construir horarios</Text></TouchableOpacity>
            <TouchableOpacity disabled={!canEditPaymentPlan || saving || !hasPaymentAmount} onPress={() => runAction('Plan de pagos generado', () => academicManagementApi.generatePaymentPlan(selectedId, { montosPorNivel: { primaria: Number(form.montoCuota), secundaria: Number(form.montoCuota) }, diaVencimiento: 10 }))} className={`${buttonClass} bg-gray-100`}><Text className="text-xs font-bold text-gray-700">Generar plan de pagos</Text></TouchableOpacity>
            <TouchableOpacity disabled={!isEditing || saving || !hasPaymentAmount} onPress={() => runAction('Gestión activada', activateWithPaymentPlans)} className={`${buttonClass} bg-maroon`}><Text className="text-xs font-bold text-white">Activar gestión</Text></TouchableOpacity>
            {(state.activo || state.estado === 'activo') && <TouchableOpacity disabled={saving} onPress={deactivateSelectedPeriod} className={`${buttonClass} border border-amber-300 bg-amber-50 flex-row gap-1`}><Ionicons name="pause-circle-outline" size={15} color="#92400E" /><Text className="text-xs font-bold text-amber-800">Desactivar {state.anio}</Text></TouchableOpacity>}
            <TouchableOpacity disabled={saving} onPress={removeSelectedPeriod} className={`${buttonClass} border border-red-200 bg-red-50 flex-row gap-1`}><Ionicons name="trash-outline" size={15} color="#b91c1c" /><Text className="text-xs font-bold text-red-700">Eliminar gestión y datos</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {showForm && (
        <View className="mt-4 border-t border-gray-100 pt-4 gap-4">
          <View className="flex-row gap-2">
            {(['scratch', 'clone'] as const).map((option) => (
              <TouchableOpacity key={option} onPress={() => setMode(option)} className={`${buttonClass} flex-1 ${mode === option ? 'bg-maroon' : 'bg-gray-100'}`}>
                <Text className={`text-xs font-bold ${mode === option ? 'text-white' : 'text-gray-600'}`}>{option === 'scratch' ? 'Desde cero' : 'Clonar anterior'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {mode === 'clone' && (
            <View>
              <Text className="text-xs font-semibold text-gray-600 mb-1">Gestión origen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {periods.map((period) => (
                  <TouchableOpacity key={period.id} onPress={() => setSourceId(period.id)} className={`mr-2 px-3 py-2 rounded-lg ${sourceId === period.id ? 'bg-maroon' : 'bg-gray-100'}`}>
                    <Text className={`text-xs ${sourceId === period.id ? 'text-white' : 'text-gray-600'}`}>{period.nombre}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bloque 1: Datos Generales de la Gestión */}
          <View className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80 gap-3">
            <View className="flex-row items-center gap-1.5 mb-1">
              <Ionicons name="calendar" size={16} color="#801529" />
              <Text className="text-xs font-bold text-gray-800 uppercase tracking-wide">Datos de la Gestión</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-1 min-w-[120px]">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Año</Text>
                <TextInput
                  value={form.anio}
                  onChangeText={(value) => update('anio', value.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  className={inputClass}
                />
              </View>
              <View className="flex-[2] min-w-[180px]">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Nombre</Text>
                <TextInput value={form.nombre} onChangeText={(value) => update('nombre', value)} className={inputClass} />
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-1 min-w-[150px]">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Inicio de Gestión *</Text>
                <BirthDatePicker
                  value={form.inicioGestion}
                  onChange={(value) => update('inicioGestion', value)}
                  placeholder="Inicio gestión"
                  minYear={2020}
                  maxYear={2050}
                />
              </View>
              <View className="flex-1 min-w-[150px]">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Fin de Gestión *</Text>
                <BirthDatePicker
                  value={form.finGestion}
                  onChange={(value) => update('finGestion', value)}
                  placeholder="Fin gestión"
                  minYear={2020}
                  maxYear={2050}
                />
              </View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              <View className="flex-1 min-w-[130px]">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Paralelos por grado</Text>
                <TextInput
                  value={form.paralelos}
                  onChangeText={(value) => update('paralelos', value.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  className={inputClass}
                />
              </View>
              <View className="flex-1 min-w-[120px]">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Capacidad Máx.</Text>
                <TextInput
                  value={form.capacidadMaxima}
                  onChangeText={(value) => update('capacidadMaxima', value.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  className={inputClass}
                />
              </View>
              <View className="flex-1 min-w-[120px]">
                <Text className="text-xs font-semibold text-gray-600 mb-1">Turno</Text>
                <View className="flex-row gap-1">
                  {(['manana', 'tarde'] as const).map((turno) => (
                    <TouchableOpacity
                      key={turno}
                      onPress={() => update('turno', turno)}
                      className={`flex-1 items-center px-2 py-2.5 rounded-xl ${form.turno === turno ? 'bg-maroon' : 'bg-gray-100'}`}
                    >
                      <Text className={`text-xs font-bold ${form.turno === turno ? 'text-white' : 'text-gray-600'}`}>
                        {turno === 'manana' ? 'Mañana' : 'Tarde'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Bloque 2: Rangos Trimestrales Rediseñados con Cajas Segmentadas UX */}
          <View className="gap-2.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="time" size={16} color="#801529" />
                <Text className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                  Cronograma de Trimestres
                </Text>
              </View>
              <Text className="text-[11px] text-gray-400">Selección por calendario</Text>
            </View>

            {([
              { num: '1° Trimestre', startKey: 'inicio1' as const, endKey: 'fin1' as const, color: 'border-blue-200 bg-blue-50/40', badge: 'bg-blue-600 text-white' },
              { num: '2° Trimestre', startKey: 'inicio2' as const, endKey: 'fin2' as const, color: 'border-amber-200 bg-amber-50/40', badge: 'bg-amber-600 text-white' },
              { num: '3° Trimestre', startKey: 'inicio3' as const, endKey: 'fin3' as const, color: 'border-emerald-200 bg-emerald-50/40', badge: 'bg-emerald-600 text-white' },
            ]).map((t) => (
              <View key={t.num} className={`p-3.5 rounded-2xl border ${t.color} gap-2`}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View className={`px-2.5 py-0.5 rounded-full ${t.badge}`}>
                      <Text className="text-[11px] font-bold text-white">{t.num}</Text>
                    </View>
                    <Text className="text-xs font-semibold text-gray-700">Período lectivo</Text>
                  </View>
                  <Ionicons name="calendar-outline" size={15} color="#6B7280" />
                </View>

                <View className="flex-row flex-wrap gap-2 pt-1">
                  <View className="flex-1 min-w-[140px]">
                    <Text className="text-[11px] font-semibold text-gray-600 mb-1 flex-row items-center gap-1">
                      <Text className="text-[11px]">▶</Text> Fecha de Inicio *
                    </Text>
                    <BirthDatePicker
                      value={form[t.startKey]}
                      onChange={(value) => update(t.startKey, value)}
                      placeholder={`Inicio ${t.num}`}
                      minYear={2020}
                      maxYear={2050}
                    />
                  </View>
                  <View className="flex-1 min-w-[140px]">
                    <Text className="text-[11px] font-semibold text-gray-600 mb-1 flex-row items-center gap-1">
                      <Text className="text-[11px]">■</Text> Fecha de Cierre *
                    </Text>
                    <BirthDatePicker
                      value={form[t.endKey]}
                      onChange={(value) => update(t.endKey, value)}
                      placeholder={`Fin ${t.num}`}
                      minYear={2020}
                      maxYear={2050}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Bloque 3: Monto Único General para Todos los Grados */}
          <View className="bg-gray-50/70 p-4 rounded-2xl border border-gray-200/80 gap-2">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="cash-outline" size={16} color="#801529" />
              <Text className="text-xs font-bold text-gray-800 uppercase tracking-wide">
                Plan de Pagos / Mensualidad
              </Text>
            </View>
            <Text className="text-xs text-gray-500">
              Monto general de la cuota mensual para todos los grados y niveles.
            </Text>
            <View className="mt-1">
              <Text className="text-xs font-semibold text-gray-700 mb-1">Monto de cuota mensual (Bs.) *</Text>
              <TextInput
                value={form.montoCuota}
                onChangeText={(value) => update('montoCuota', value.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="Ej. 350.00"
                className={inputClass}
              />
            </View>
          </View>

          <TouchableOpacity onPress={submitPeriod} disabled={saving} className={`${buttonClass} bg-maroon shadow`}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-bold text-white">Guardar configuración</Text>}
          </TouchableOpacity>
        </View>
      )}

      {selectedId && isEditing && (
        <View className="mt-4 border-t border-gray-100 pt-4 gap-2">
          <Text className="text-sm font-bold text-gray-800">Malla curricular</Text>
          <Text className="text-xs text-gray-500">Asigne materias por grado. Las extracurriculares reciben un peso menor para la generación de horarios.</Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[110px]"><Text className="text-xs text-gray-600 mb-1">Nivel</Text><TextInput value={malla.nivel} onChangeText={(value) => setMalla((current) => ({ ...current, nivel: value }))} className={inputClass} /></View>
            <View className="flex-1 min-w-[90px]"><Text className="text-xs text-gray-600 mb-1">Grado</Text><TextInput value={malla.grado} onChangeText={(value) => setMalla((current) => ({ ...current, grado: value }))} className={inputClass} /></View>
            <View className="flex-1 min-w-[110px]"><Text className="text-xs text-gray-600 mb-1">Materia</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View className="flex-row gap-1">{subjects.map((subject) => <TouchableOpacity key={String(subject.id)} onPress={() => setMalla((current) => ({ ...current, materiaId: String(subject.id) }))} className={`px-2 py-2 rounded-lg ${malla.materiaId === String(subject.id) ? 'bg-maroon' : 'bg-gray-100'}`}><Text className={`text-[10px] ${malla.materiaId === String(subject.id) ? 'text-white' : 'text-gray-600'}`}>{String(subject.nombre).slice(0, 14)}</Text></TouchableOpacity>)}</View></ScrollView></View>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <View className="flex-1 min-w-[100px]"><Text className="text-xs text-gray-600 mb-1">Horas/semana</Text><TextInput value={malla.cargaHorariaSemanal} onChangeText={(value) => setMalla((current) => ({ ...current, cargaHorariaSemanal: value.replace(/[^0-9]/g, '') }))} keyboardType="numeric" className={inputClass} /></View>
            <View className="flex-1 min-w-[100px]"><Text className="text-xs text-gray-600 mb-1">Peso</Text><TextInput value={malla.pesoSintactico} onChangeText={(value) => setMalla((current) => ({ ...current, pesoSintactico: value.replace(/[^0-9]/g, '') }))} keyboardType="numeric" className={inputClass} /></View>
            <TouchableOpacity onPress={() => setMalla((current) => { const tipo = current.tipoMateria === 'principal' ? 'extracurricular' : 'principal'; return { ...current, tipoMateria: tipo, pesoSintactico: tipo === 'extracurricular' ? '1' : '3' }; })} className={`${buttonClass} bg-gray-100`}><Text className="text-xs font-bold text-gray-700">{malla.tipoMateria === 'principal' ? 'Principal' : 'Extracurricular'}</Text></TouchableOpacity>
            <TouchableOpacity onPress={addMalla} disabled={saving} className={`${buttonClass} bg-maroon`}><Text className="text-xs font-bold text-white">Agregar</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {requests.length > 0 && (
        <View className="mt-4 border-t border-gray-100 pt-4 gap-2">
          <Text className="text-sm font-bold text-gray-800">Solicitudes de inscripción</Text>
          {requests.map((request) => (
            <View key={String(request.id)} className="flex-row items-center justify-between gap-2 bg-gray-50 rounded-xl p-3">
              <View className="flex-1"><Text className="text-xs font-bold text-gray-700">{request.tipo} · estudiante {request.estudianteId}</Text><Text className="text-[10px] text-gray-500">Destino {request.cursoPeriodoDestinoId} · {request.estado}</Text></View>
              <View className="flex-row gap-1"><TouchableOpacity disabled={saving} onPress={() => processRequest(String(request.id), true)} className="px-2 py-1 rounded-lg bg-maroon"><Text className="text-[10px] font-bold text-white">Aprobar</Text></TouchableOpacity><TouchableOpacity disabled={saving} onPress={() => processRequest(String(request.id), false)} className="px-2 py-1 rounded-lg bg-gray-200"><Text className="text-[10px] font-bold text-gray-700">Rechazar</Text></TouchableOpacity></View>
            </View>
          ))}
        </View>
      )}
    </BentoCard>
  );
}
