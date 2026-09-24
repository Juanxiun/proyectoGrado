import React, { useEffect, useState } from 'react';
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
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { DateTimePicker } from '../../../displays/components/DateTimePicker';
import { useResponsive } from '../../../utils/responsive';

interface AsignacionDocente {
  id: string;
  materiaNombre: string;
  grado: string;
  paralelo: string;
  nivel: string;
}

interface EvaluacionItem {
  id: string;
  asignacionId: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  ponderacion: number;
  fechaPublicacion?: string;
  fechaLimite?: string;
  estado: string;
  materiaNombre?: string;
}

export function MaestroEvaluacionesScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [asignaciones, setAsignaciones] = useState<AsignacionDocente[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionItem[]>([]);

  // Formulario de creación/edición
  const [showForm, setShowForm] = useState(false);
  const [editingEval, setEditingEval] = useState<EvaluacionItem | null>(null);

  const [selectedAsignacionId, setSelectedAsignacionId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<'examen' | 'evaluacion' | 'parcial'>('examen');
  const [descripcion, setDescripcion] = useState('');
  const [ponderacion, setPonderacion] = useState('35');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 16));
  const [fechaFin, setFechaFin] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [estado, setEstado] = useState<'borrador' | 'publicado' | 'cerrado'>('publicado');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [asigRes, encRes] = await Promise.all([
        academicServicesApi.list('asignaciones', { limit: 150 }),
        academicServicesApi.list('encargos', { limit: 200 }),
      ]);

      const allAsig = asigRes.data as any[];
      const teacherAsig = allAsig.filter((a) => {
        if (!user) return false;
        if (user.maestroId && String(a.maestroId) === String(user.maestroId)) return true;
        if (a.maestro && String(a.maestro.usuarioId) === String(user.id)) return true;
        return true;
      });

      const mappedAsig: AsignacionDocente[] = teacherAsig.map((a) => ({
        id: String(a.id),
        materiaNombre: a.materia?.nombre || a.materiaNombre || 'Materia',
        grado: a.cursoPeriodo?.curso?.grado || a.grado || '1',
        paralelo: a.cursoPeriodo?.curso?.paralelo || a.paralelo || 'A',
        nivel: a.cursoPeriodo?.curso?.nivel || a.nivel || 'Secundaria',
      }));

      setAsignaciones(mappedAsig);
      if (mappedAsig.length > 0 && !selectedAsignacionId) {
        setSelectedAsignacionId(mappedAsig[0].id);
      }

      // Filtrar encargos que sean de tipo evaluación/examen
      const allEnc = encRes.data as any[];
      const evals = allEnc
        .filter((e) => ['examen', 'evaluacion', 'parcial'].includes(String(e.tipo).toLowerCase()))
        .map((e) => ({
          id: String(e.id),
          asignacionId: String(e.asignacionId || ''),
          tipo: e.tipo,
          titulo: e.titulo,
          descripcion: e.descripcion,
          ponderacion: Number(e.ponderacion) || 0,
          fechaPublicacion: e.fechaPublicacion,
          fechaLimite: e.fechaLimite,
          estado: e.estado || 'publicado',
          materiaNombre: e.asignacion?.materiaNombre || 'Materia',
        }));

      setEvaluaciones(evals);
    } catch (err) {
      console.error('Error cargando evaluaciones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleOpenCreate = () => {
    setEditingEval(null);
    setTitulo('');
    setDescripcion('');
    setPonderacion('35');
    setTipo('examen');
    setFechaInicio(new Date().toISOString().slice(0, 16));
    setFechaFin(new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setEstado('publicado');
    setShowForm(true);
  };

  const handleEdit = (item: EvaluacionItem) => {
    setEditingEval(item);
    setSelectedAsignacionId(item.asignacionId);
    setTitulo(item.titulo);
    setDescripcion(item.descripcion || '');
    setPonderacion(String(item.ponderacion));
    setTipo((item.tipo as any) || 'examen');
    setFechaInicio(item.fechaPublicacion ? item.fechaPublicacion.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setFechaFin(item.fechaLimite ? item.fechaLimite.slice(0, 16) : new Date().toISOString().slice(0, 16));
    setEstado((item.estado as any) || 'publicado');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!selectedAsignacionId) {
      Alert.alert('Selección requerida', 'Seleccione la materia y curso para la evaluación.');
      return;
    }
    if (!titulo.trim()) {
      Alert.alert('Campo requerido', 'Ingrese el nombre de la evaluación.');
      return;
    }
    if (!fechaInicio || !fechaFin) {
      Alert.alert('Fechas requeridas', 'Configure los parámetros de fecha y hora de la prueba.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        asignacionId: selectedAsignacionId,
        tipo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || undefined,
        ponderacion: Number(ponderacion) || 35,
        fechaPublicacion: new Date(fechaInicio).toISOString(),
        fechaLimite: new Date(fechaFin).toISOString(),
        estado,
      };

      if (editingEval) {
        await academicServicesApi.update('encargos', editingEval.id, payload);
        Alert.alert('Actualizado', 'La evaluación ha sido modificada correctamente.');
      } else {
        await academicServicesApi.create('encargos', payload);
        Alert.alert('Programada', 'Evaluación programada con éxito.');
      }

      setShowForm(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la evaluación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 gap-4">
      <BentoCard className="p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Gestión de Evaluaciones</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Diseña, programa y parametriza exámenes y pruebas presenciales o virtuales.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenCreate}
            className="bg-maroon px-4 py-2.5 rounded-xl flex-row items-center gap-2 shadow-sm"
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text className="text-white text-xs font-bold">Nueva Evaluación</Text>
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* Formulario de creación/edición */}
      {showForm && (
        <BentoCard className="p-5 border-2 border-maroon/20">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-maroon">
              {editingEval ? 'Editar Parámetros de Evaluación' : 'Programar Nueva Evaluación'}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View className="gap-3">
            <View>
              <Text className="text-xs font-semibold text-gray-700 mb-1">Materia y Curso *</Text>
              <View className="w-full flex-row flex-wrap gap-2">
                {asignaciones.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => setSelectedAsignacionId(a.id)}
                    className={`flex-1 min-w-[220px] max-w-[320px] px-3 py-2 rounded-xl border ${
                      selectedAsignacionId === a.id
                        ? 'bg-maroon border-maroon'
                        : 'bg-gray-100 border-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        selectedAsignacionId === a.id ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {a.materiaNombre} ({a.grado}° {a.paralelo})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className={`gap-3 ${isMobile ? '' : 'flex-row'}`}>
              <View className="flex-[2]">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Nombre de la Evaluación *</Text>
                <TextInput
                  value={titulo}
                  onChangeText={setTitulo}
                  placeholder="Ej: Examen Parcial 1er Trimestre"
                  className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View className="flex-1">
                <Text className="text-xs font-semibold text-gray-700 mb-1">Ponderación (%) *</Text>
                <TextInput
                  value={ponderacion}
                  onChangeText={setPonderacion}
                  keyboardType="numeric"
                  placeholder="35"
                  className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Parámetros de ejecución temporal con Calendario y Selector de Horas */}
            <View className={`gap-3 ${isMobile ? '' : 'flex-row'}`}>
              <DateTimePicker
                label="📅 Fecha y Hora de Inicio *"
                value={fechaInicio}
                onChange={setFechaInicio}
                className="flex-1"
              />

              <DateTimePicker
                label="⏰ Fecha y Hora de Cierre *"
                value={fechaFin}
                onChange={setFechaFin}
                className="flex-1"
              />
            </View>

            <View>
              <Text className="text-xs font-semibold text-gray-700 mb-1">Parámetros / Instrucciones</Text>
              <TextInput
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Parámetros de la prueba, tiempo límite, materiales permitidos..."
                multiline
                numberOfLines={3}
                className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800 min-h-[60px]"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              onPress={handleSave}
              disabled={saving}
              className="bg-maroon rounded-xl py-3 items-center justify-center mt-2"
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold text-sm">
                  {editingEval ? 'Guardar Cambios' : 'Confirmar y Programar'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </BentoCard>
      )}

      {/* Listado de Evaluaciones */}
      {loading ? (
        <View className="py-12 items-center justify-center">
          <ActivityIndicator size="large" color="#801529" />
          <Text className="text-gray-500 text-sm mt-2">Cargando evaluaciones programadas...</Text>
        </View>
      ) : evaluaciones.length === 0 ? (
        <BentoCard className="p-8 items-center text-center">
          <Ionicons name="clipboard-outline" size={48} color="#D1D5DB" />
          <Text className="text-lg font-bold text-gray-700 mt-3">No hay evaluaciones programadas</Text>
          <Text className="text-sm text-gray-400 mt-1 max-w-sm">
            Puedes programar los exámenes y pruebas trimestrales haciendo clic en &quot;Nueva Evaluación&quot;.
          </Text>
        </BentoCard>
      ) : (
        <View className="gap-3">
          {evaluaciones.map((ev) => (
            <BentoCard key={ev.id} className="p-5">
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="document-text-outline" size={20} color="#801529" />
                    <Text className="text-base font-bold text-gray-900">{ev.titulo}</Text>
                    <StatusBadge
                      label={ev.estado}
                      variant={ev.estado === 'publicado' ? 'success' : 'neutral'}
                    />
                  </View>
                  <Text className="text-xs text-maroon font-semibold mt-1">
                    {ev.materiaNombre} • {ev.tipo.toUpperCase()}
                  </Text>
                  {ev.descripcion ? (
                    <Text className="text-xs text-gray-600 mt-1.5">{ev.descripcion}</Text>
                  ) : null}
                </View>

                <View className="items-end gap-2">
                  <View className="bg-gold/20 px-2.5 py-1 rounded-lg">
                    <Text className="text-xs font-bold text-amber-900">{ev.ponderacion}% Calificación</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleEdit(ev)}
                    className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Ionicons name="create-outline" size={16} color="#374151" />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row flex-wrap gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <View className="flex-row items-center gap-1">
                  <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                  <Text className="text-xs text-gray-500">
                    Apertura: {ev.fechaPublicacion?.replace('T', ' ').slice(0, 16) || 'Inmediato'}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="hourglass-outline" size={14} color="#DC2626" />
                  <Text className="text-xs font-semibold text-red-600">
                    Cierre: {ev.fechaLimite?.replace('T', ' ').slice(0, 16) || 'Sin límite'}
                  </Text>
                </View>
              </View>
            </BentoCard>
          ))}
        </View>
      )}
    </View>
  );
}
