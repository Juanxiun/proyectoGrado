import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { DateTimePicker } from '../../../displays/components/DateTimePicker';
import { useResponsive } from '../../../utils/responsive';

interface AsignacionMateria {
  id: string; // asignacionId
  materiaId: string;
  materiaNombre: string;
  materiaCodigo?: string;
  cursoPeriodoId: string;
  grado: string;
  paralelo: string;
  nivel: string;
  anio?: number | string;
}

interface MaterialItem {
  id: string;
  titulo: string;
  detalle?: string;
  archivoUrl: string;
  nombreArchivo?: string;
  tamanioBytes?: number;
  tipoMime?: string;
  fechaSubida?: string;
  activo?: boolean;
}

interface EncargoItem {
  id: string;
  tipo: string;
  titulo: string;
  descripcion?: string;
  ponderacion: number;
  fechaPublicacion?: string;
  fechaLimite?: string;
  estado: string;
}

interface EntregaItem {
  id: string;
  estudianteId: string;
  archivoUrl: string;
  nombreArchivo?: string;
  comentario?: string;
  fechaEntrega: string;
  estadoEntrega: 'a_tiempo' | 'con_retraso';
  estudiante?: {
    nombre?: string;
    apellidoPaterno?: string;
    apellidoMaterno?: string;
    numeroDoc?: string;
  };
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function MaestroMateriasScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [materias, setMaterias] = useState<AsignacionMateria[]>([]);
  const [selectedAsig, setSelectedAsig] = useState<AsignacionMateria | null>(null);

  // Sub-sección activa en la vista de carga de contenido
  const [contentTab, setContentTab] = useState<'materiales' | 'tareas'>('tareas');

  // Datos de la materia seleccionada
  const [materialesList, setMaterialesList] = useState<MaterialItem[]>([]);
  const [encargosList, setEncargosList] = useState<EncargoItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // Formulario: Crear/Publicar Material
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [matTitulo, setMatTitulo] = useState('');
  const [matDetalle, setMatDetalle] = useState('');
  const [matFile, setMatFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [savingMat, setSavingMat] = useState(false);

  // Formulario: Crear Asignación / Tarea
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [tareaTitulo, setTareaTitulo] = useState('');
  const [tareaDescripcion, setTareaDescripcion] = useState('');
  const [tareaPonderacion, setTareaPonderacion] = useState('100');
  const [tareaFechaInicio, setTareaFechaInicio] = useState(new Date().toISOString().slice(0, 16)); // YYYY-MM-DDTHH:mm
  const [tareaFechaCierre, setTareaFechaCierre] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [savingTarea, setSavingTarea] = useState(false);

  // Modal Ver Entregas de una tarea
  const [entregasModalOpen, setEntregasModalOpen] = useState(false);
  const [selectedEncargoForEntregas, setSelectedEncargoForEntregas] = useState<EncargoItem | null>(null);
  const [entregas, setEntregas] = useState<EntregaItem[]>([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  const loadMaterias = async () => {
    try {
      setLoading(true);
      const res = await academicServicesApi.list('asignaciones', { limit: 200 });
      const all = res.data as any[];

      const filtered = all.filter((asig) => {
        if (!user) return false;
        const m = asig.maestro;
        if (!m) return true;
        if (user.maestroId && String(asig.maestroId) === String(user.maestroId)) return true;
        if (String(m.usuarioId) === String(user.id)) return true;
        if (
          user.nombre &&
          m.nombre &&
          String(m.nombre).toLowerCase() === user.nombre.toLowerCase() &&
          String(m.apellidoPaterno ?? '').toLowerCase() === (user.apellidoPaterno ?? '').toLowerCase()
        ) {
          return true;
        }
        return false;
      });

      const listSource = filtered.length > 0 ? filtered : all;

      const mapped: AsignacionMateria[] = listSource.map((asig) => {
        const c = asig.cursoPeriodo?.curso || {};
        return {
          id: String(asig.id),
          materiaId: String(asig.materiaId || asig.materia?.id || ''),
          materiaNombre: asig.materia?.nombre || asig.materiaNombre || 'Materia',
          materiaCodigo: asig.materia?.codigo,
          cursoPeriodoId: String(asig.cursoPeriodoId || asig.cursoPeriodo?.id || ''),
          grado: c.grado || asig.grado || '1',
          paralelo: c.paralelo || asig.paralelo || 'A',
          nivel: c.nivel || asig.nivel || 'Secundaria',
          anio: asig.cursoPeriodo?.periodo?.anio || asig.anio,
        };
      });

      setMaterias(mapped);
    } catch (err) {
      console.error('Error cargando materias asignadas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaterias();
  }, [user?.id]);

  const handleSelectSubject = async (asig: AsignacionMateria) => {
    setSelectedAsig(asig);
    setLoadingContent(true);
    setShowMaterialForm(false);
    setShowTareaForm(false);
    try {
      // Cargar materiales y encargos en paralelo
      const [matRes, encRes] = await Promise.all([
        academicServicesApi.list('materiales', { asignacionId: asig.id, limit: 100 }),
        academicServicesApi.list('encargos', { asignacionId: asig.id, limit: 100 }),
      ]);
      setMaterialesList(matRes.data as any[]);
      setEncargosList(encRes.data as any[]);
    } catch (err) {
      console.error('Error cargando contenido de la materia:', err);
    } finally {
      setLoadingContent(false);
    }
  };

  // Subir Material
  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 150 * 1024 * 1024) {
      Alert.alert('Archivo excedido', 'El archivo no puede superar los 150 MB.');
      return;
    }
    setMatFile(asset);
  };

  const handleSaveMaterial = async () => {
    if (!selectedAsig) return;
    if (!matTitulo.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa el título del material.');
      return;
    }
    if (!matFile) {
      Alert.alert('Archivo requerido', 'Debes adjuntar un archivo (PDF, Word, Excel).');
      return;
    }

    try {
      setSavingMat(true);
      const data = new FormData();
      data.append('asignacionId', selectedAsig.id);
      data.append('titulo', matTitulo.trim());
      if (matDetalle.trim()) data.append('detalle', matDetalle.trim());

      if (Platform.OS === 'web' && (matFile as any).file) {
        data.append('file', (matFile as any).file);
      } else {
        const response = await fetch(matFile.uri);
        const blob = await response.blob();
        data.append('file', blob, matFile.name);
      }

      await academicServicesApi.uploadMaterial(data);
      Alert.alert('¡Éxito!', 'Material pedagógico publicado correctamente.');
      setMatTitulo('');
      setMatDetalle('');
      setMatFile(null);
      setShowMaterialForm(false);

      // Recargar materiales
      const matRes = await academicServicesApi.list('materiales', {
        asignacionId: selectedAsig.id,
      });
      setMaterialesList(matRes.data as any[]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo subir el material.');
    } finally {
      setSavingMat(false);
    }
  };

  // Crear Tarea / Deber con Fechas de Inicio y Cierre
  const handleSaveTarea = async () => {
    if (!selectedAsig) return;
    if (!tareaTitulo.trim()) {
      Alert.alert('Campo requerido', 'Ingresa el título de la tarea.');
      return;
    }
    if (!tareaFechaInicio || !tareaFechaCierre) {
      Alert.alert('Fechas requeridas', 'Define tanto la fecha de inicio como la fecha de cierre.');
      return;
    }
    if (new Date(tareaFechaCierre).getTime() <= new Date(tareaFechaInicio).getTime()) {
      Alert.alert('Rango inválido', 'La fecha y hora de cierre debe ser posterior a la fecha de inicio.');
      return;
    }

    try {
      setSavingTarea(true);
      await academicServicesApi.create('encargos', {
        asignacionId: selectedAsig.id,
        tipo: 'tarea',
        titulo: tareaTitulo.trim(),
        descripcion: tareaDescripcion.trim() || undefined,
        ponderacion: Number(tareaPonderacion) || 100,
        fechaPublicacion: new Date(tareaFechaInicio).toISOString(),
        fechaLimite: new Date(tareaFechaCierre).toISOString(),
        estado: 'publicado',
      });

      Alert.alert('¡Publicado!', 'Tarea y rango temporal configurados con éxito.');
      setTareaTitulo('');
      setTareaDescripcion('');
      setShowTareaForm(false);

      // Recargar encargos
      const encRes = await academicServicesApi.list('encargos', {
        asignacionId: selectedAsig.id,
      });
      setEncargosList(encRes.data as any[]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo programar la tarea.');
    } finally {
      setSavingTarea(false);
    }
  };

  // Ver Entregas de Tarea
  const handleOpenEntregas = async (encargo: EncargoItem) => {
    setSelectedEncargoForEntregas(encargo);
    setEntregasModalOpen(true);
    setLoadingEntregas(true);
    try {
      const res = await academicServicesApi.list('entregas', {
        encargoId: encargo.id,
        limit: 150,
      });
      setEntregas(res.data as any[]);
    } catch (err) {
      console.error('Error cargando entregas:', err);
      setEntregas([]);
    } finally {
      setLoadingEntregas(false);
    }
  };

  return (
    <View className="flex-1 gap-4">
      {/* Vista de Selección de Materia */}
      {!selectedAsig ? (
        <>
          <BentoCard className="p-5">
            <Text className="text-2xl font-bold text-gray-900">Materias y Contenido Pedagógico</Text>
            <Text className="text-sm text-gray-500 mt-1">
              Selecciona una materia para gestionar recursos didácticos, tareas y rangos temporales de entrega.
            </Text>
          </BentoCard>

          {loading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#801529" />
              <Text className="text-gray-500 text-sm mt-3">Cargando materias impartidas...</Text>
            </View>
          ) : materias.length === 0 ? (
            <BentoCard className="p-8 items-center text-center">
              <Ionicons name="book-outline" size={48} color="#D1D5DB" />
              <Text className="text-lg font-bold text-gray-700 mt-3">No hay materias asignadas</Text>
              <Text className="text-sm text-gray-400 mt-1">
                No tienes materias activas asociadas en la gestión académica actual.
              </Text>
            </BentoCard>
          ) : (
            <View className={`gap-4 ${isMobile ? '' : 'flex-row flex-wrap'}`}>
              {materias.map((item) => (
                <BentoCard
                  key={item.id}
                  className={`p-5 ${isMobile ? 'w-full' : 'w-[48%]'}`}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="w-12 h-12 rounded-xl bg-maroon/10 items-center justify-center">
                        <Ionicons name="book" size={24} color="#801529" />
                      </View>
                      <View>
                        <Text className="text-lg font-bold text-gray-900">
                          {item.materiaNombre}
                        </Text>
                        <Text className="text-sm text-gray-600 font-medium">
                          {item.grado}° &quot;{item.paralelo}&quot; {item.nivel}
                        </Text>
                      </View>
                    </View>
                    <StatusBadge label={item.nivel} variant="info" />
                  </View>

                  <Text className="text-xs text-gray-400 mt-3">
                    Código de Asignación: #{item.id} {item.anio ? `• Gestión ${item.anio}` : ''}
                  </Text>

                  <TouchableOpacity
                    onPress={() => handleSelectSubject(item)}
                    className="mt-5 bg-maroon rounded-xl py-2.5 px-4 flex-row items-center justify-center gap-2"
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                    <Text className="text-white text-sm font-semibold">Administrar Contenido y Tareas</Text>
                  </TouchableOpacity>
                </BentoCard>
              ))}
            </View>
          )}
        </>
      ) : (
        /* Pantalla de Carga y Gestión de Contenido Dedicada */
        <View className="flex-1 gap-4">
          {/* Header con botón volver */}
          <BentoCard className="p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => setSelectedAsig(null)}
                  className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center"
                >
                  <Ionicons name="arrow-back" size={20} color="#374151" />
                </TouchableOpacity>
                <View>
                  <Text className="text-xl font-bold text-gray-900">
                    {selectedAsig.materiaNombre} — {selectedAsig.grado}° &quot;{selectedAsig.paralelo}&quot; {selectedAsig.nivel}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Panel pedagógico docente: subida de material y control de asignaciones
                  </Text>
                </View>
              </View>
              <StatusBadge label="En Edición" variant="success" />
            </View>

            {/* Pestañas de la materia: Materiales vs Tareas */}
            <View className="flex-row gap-2 mt-4 pt-3 border-t border-gray-100">
              <TouchableOpacity
                onPress={() => setContentTab('tareas')}
                className={`px-4 py-2 rounded-xl flex-row items-center gap-2 ${
                  contentTab === 'tareas' ? 'bg-maroon' : 'bg-gray-100'
                }`}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={16}
                  color={contentTab === 'tareas' ? '#FFFFFF' : '#4B5563'}
                />
                <Text
                  className={`text-xs font-bold ${
                    contentTab === 'tareas' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Deberes y Tareas ({encargosList.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setContentTab('materiales')}
                className={`px-4 py-2 rounded-xl flex-row items-center gap-2 ${
                  contentTab === 'materiales' ? 'bg-maroon' : 'bg-gray-100'
                }`}
              >
                <Ionicons
                  name="folder-open-outline"
                  size={16}
                  color={contentTab === 'materiales' ? '#FFFFFF' : '#4B5563'}
                />
                <Text
                  className={`text-xs font-bold ${
                    contentTab === 'materiales' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Material de Estudio ({materialesList.length})
                </Text>
              </TouchableOpacity>
            </View>
          </BentoCard>

          {loadingContent ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#801529" />
              <Text className="text-xs text-gray-500 mt-2">Cargando recursos didácticos...</Text>
            </View>
          ) : contentTab === 'tareas' ? (
            /* SECCIÓN TAREAS / ASIGNACIONES */
            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-gray-900">Tareas y Deberes Programados</Text>
                <TouchableOpacity
                  onPress={() => setShowTareaForm(!showTareaForm)}
                  className="bg-maroon px-4 py-2 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name={showTareaForm ? 'close' : 'add'} size={18} color="#FFFFFF" />
                  <Text className="text-white text-xs font-bold">
                    {showTareaForm ? 'Cancelar' : 'Nueva Tarea'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Formulario de Nueva Tarea */}
              {showTareaForm && (
                <BentoCard className="p-5 border-2 border-maroon/20">
                  <Text className="text-base font-bold text-maroon mb-3">
                    Publicar Tarea con Restricción Temporal
                  </Text>

                  <View className="gap-3">
                    <View>
                      <Text className="text-xs font-semibold text-gray-700 mb-1">Título de la Tarea *</Text>
                      <TextInput
                        value={tareaTitulo}
                        onChangeText={setTareaTitulo}
                        placeholder="Ej: Ensayo sobre el ciclo del agua"
                        className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View>
                      <Text className="text-xs font-semibold text-gray-700 mb-1">Descripción / Consigna</Text>
                      <TextInput
                        value={tareaDescripcion}
                        onChangeText={setTareaDescripcion}
                        placeholder="Instrucciones detalladas de entrega..."
                        multiline
                        numberOfLines={3}
                        className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800 min-h-[70px]"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className="text-xs font-semibold text-gray-700 mb-1">Ponderación (Puntos)</Text>
                        <TextInput
                          value={tareaPonderacion}
                          onChangeText={setTareaPonderacion}
                          keyboardType="numeric"
                          placeholder="100"
                          className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    </View>

                    {/* Controles de Fecha y Hora con Calendario y Selector de Horas */}
                    <View className={`gap-3 ${isMobile ? '' : 'flex-row'}`}>
                      <DateTimePicker
                        label="📅 Fecha y Hora de Inicio *"
                        value={tareaFechaInicio}
                        onChange={setTareaFechaInicio}
                        className="flex-1"
                      />

                      <DateTimePicker
                        label="⏰ Fecha y Hora de Cierre *"
                        value={tareaFechaCierre}
                        onChange={setTareaFechaCierre}
                        className="flex-1"
                      />
                    </View>

                    <TouchableOpacity
                      onPress={handleSaveTarea}
                      disabled={savingTarea}
                      className="bg-maroon rounded-xl py-3 items-center justify-center mt-2"
                    >
                      {savingTarea ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-white font-bold text-sm">Publicar Tarea</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </BentoCard>
              )}

              {/* Listado de Encargos/Tareas */}
              {encargosList.length === 0 ? (
                <BentoCard className="p-6 items-center">
                  <Ionicons name="clipboard-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-semibold text-gray-600 mt-2">
                    No hay tareas publicadas todavía.
                  </Text>
                </BentoCard>
              ) : (
                <View className="gap-3">
                  {encargosList.map((enc) => {
                    const isClosed = enc.fechaLimite && new Date() > new Date(enc.fechaLimite);
                    return (
                      <BentoCard key={enc.id} className="p-4">
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1 pr-3">
                            <View className="flex-row items-center gap-2">
                              <Text className="text-base font-bold text-gray-900">{enc.titulo}</Text>
                              <StatusBadge
                                label={isClosed ? 'Cerrada' : 'Abierta'}
                                variant={isClosed ? 'danger' : 'success'}
                              />
                            </View>
                            {enc.descripcion ? (
                              <Text className="text-xs text-gray-600 mt-1">{enc.descripcion}</Text>
                            ) : null}
                          </View>
                          <View className="bg-maroon/10 px-2.5 py-1 rounded-lg">
                            <Text className="text-xs font-bold text-maroon">{enc.ponderacion} pts</Text>
                          </View>
                        </View>

                        <View className="flex-row flex-wrap gap-4 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
                          <View className="flex-row items-center gap-1">
                            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                            <Text className="text-xs text-gray-500">
                              Inicio: {enc.fechaPublicacion?.replace('T', ' ').slice(0, 16) || 'Inmediato'}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-1">
                            <Ionicons name="time-outline" size={14} color="#DC2626" />
                            <Text className="text-xs font-semibold text-red-600">
                              Cierre: {enc.fechaLimite?.replace('T', ' ').slice(0, 16) || 'Sin límite'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleOpenEntregas(enc)}
                          className="mt-3 bg-gray-100 hover:bg-gray-200 rounded-xl py-2 px-3 flex-row items-center justify-center gap-1.5"
                        >
                          <Ionicons name="documents-outline" size={16} color="#801529" />
                          <Text className="text-xs font-bold text-maroon">
                            Revisar Entregas de Alumnos
                          </Text>
                        </TouchableOpacity>
                      </BentoCard>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            /* SECCIÓN MATERIALES DIDÁCTICOS */
            <View className="gap-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold text-gray-900">Material de Estudio Subido</Text>
                <TouchableOpacity
                  onPress={() => setShowMaterialForm(!showMaterialForm)}
                  className="bg-maroon px-4 py-2 rounded-xl flex-row items-center gap-2"
                >
                  <Ionicons name={showMaterialForm ? 'close' : 'cloud-upload'} size={18} color="#FFFFFF" />
                  <Text className="text-white text-xs font-bold">
                    {showMaterialForm ? 'Cancelar' : 'Subir Material'}
                  </Text>
                </TouchableOpacity>
              </View>

              {showMaterialForm && (
                <BentoCard className="p-5 border-2 border-maroon/20">
                  <Text className="text-base font-bold text-maroon mb-3">
                    Subir Archivo de Consulta (PDF, Word, Excel - Máx. 150MB)
                  </Text>

                  <View className="gap-3">
                    <View>
                      <Text className="text-xs font-semibold text-gray-700 mb-1">Título del Material *</Text>
                      <TextInput
                        value={matTitulo}
                        onChangeText={setMatTitulo}
                        placeholder="Ej: Guía de Ejercicios N° 3"
                        className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View>
                      <Text className="text-xs font-semibold text-gray-700 mb-1">Detalle / Instrucciones</Text>
                      <TextInput
                        value={matDetalle}
                        onChangeText={setMatDetalle}
                        placeholder="Descripción o contexto del material..."
                        multiline
                        numberOfLines={2}
                        className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    {/* Selector de Archivo */}
                    <View>
                      <Text className="text-xs font-semibold text-gray-700 mb-1">Archivo Adjunto *</Text>
                      <TouchableOpacity
                        onPress={handlePickFile}
                        className="p-4 border-2 border-dashed border-gray-300 rounded-xl items-center justify-center bg-gray-50"
                      >
                        <Ionicons name="document-attach-outline" size={28} color="#801529" />
                        <Text className="text-xs font-semibold text-gray-700 mt-2">
                          {matFile ? matFile.name : 'Seleccionar PDF, DOCX o XLSX'}
                        </Text>
                        <Text className="text-[11px] text-gray-400">
                          {matFile ? `${Math.round((matFile.size ?? 0) / 1024)} KB` : 'Hasta 150 MB'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={handleSaveMaterial}
                      disabled={savingMat}
                      className="bg-maroon rounded-xl py-3 items-center justify-center mt-2"
                    >
                      {savingMat ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text className="text-white font-bold text-sm">Publicar Recurso</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </BentoCard>
              )}

              {materialesList.length === 0 ? (
                <BentoCard className="p-6 items-center">
                  <Ionicons name="folder-open-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-semibold text-gray-600 mt-2">
                    No hay materiales publicados para esta materia.
                  </Text>
                </BentoCard>
              ) : (
                <View className="gap-3">
                  {materialesList.map((mat) => (
                    <BentoCard key={mat.id} className="p-4 flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="w-10 h-10 rounded-xl bg-gold/20 items-center justify-center">
                          <Ionicons name="document-text" size={22} color="#B45309" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-gray-800">{mat.titulo}</Text>
                          {mat.detalle ? (
                            <Text className="text-xs text-gray-500">{mat.detalle}</Text>
                          ) : null}
                          <Text className="text-[11px] text-gray-400 mt-0.5">
                            {mat.nombreArchivo || 'Documento'} {mat.fechaSubida ? `• ${mat.fechaSubida.slice(0, 10)}` : ''}
                          </Text>
                        </View>
                      </View>
                      <StatusBadge label="Activo" variant="success" />
                    </BentoCard>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Modal de Entregas de Alumnos */}
      <Modal
        visible={entregasModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEntregasModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            <View className="p-5 border-b border-gray-100 flex-row items-center justify-between bg-gray-50">
              <View>
                <Text className="text-lg font-bold text-gray-900">
                  Entregas de Alumnos: {selectedEncargoForEntregas?.titulo}
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Fecha límite: {selectedEncargoForEntregas?.fechaLimite?.replace('T', ' ').slice(0, 16) || 'Sin límite'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEntregasModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4 max-h-[55vh]">
              {loadingEntregas ? (
                <View className="py-10 items-center justify-center">
                  <ActivityIndicator size="small" color="#801529" />
                  <Text className="text-xs text-gray-500 mt-2">Consultando entregas...</Text>
                </View>
              ) : entregas.length === 0 ? (
                <View className="py-8 items-center justify-center">
                  <Ionicons name="file-tray-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-semibold text-gray-600 mt-2">
                    Ningún estudiante ha entregado esta tarea todavía.
                  </Text>
                </View>
              ) : (
                <View className="gap-3 pb-4">
                  {entregas.map((ent) => {
                    const isOntime = ent.estadoEntrega === 'a_tiempo';
                    return (
                      <View
                        key={ent.id}
                        className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex-row items-center justify-between"
                      >
                        <View className="flex-1 pr-3">
                          <Text className="text-sm font-bold text-gray-800">
                            {ent.estudiante?.apellidoPaterno} {ent.estudiante?.apellidoMaterno} {ent.estudiante?.nombre || 'Estudiante'}
                          </Text>
                          <Text className="text-xs text-gray-500">
                            Entregado: {ent.fechaEntrega?.replace('T', ' ').slice(0, 19)}
                          </Text>
                          {ent.nombreArchivo ? (
                            <Text className="text-xs text-maroon font-medium mt-1">
                              📎 {ent.nombreArchivo}
                            </Text>
                          ) : null}
                          {ent.comentario ? (
                            <Text className="text-[11px] text-gray-500 italic mt-0.5">
                              &quot;{ent.comentario}&quot;
                            </Text>
                          ) : null}
                        </View>

                        <StatusBadge
                          label={isOntime ? 'A tiempo' : 'Con retraso'}
                          variant={isOntime ? 'success' : 'danger'}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View className="p-4 border-t border-gray-100 bg-gray-50 flex-row justify-end">
              <TouchableOpacity
                onPress={() => setEntregasModalOpen(false)}
                className="bg-gray-200 px-5 py-2.5 rounded-xl"
              >
                <Text className="text-sm font-semibold text-gray-700">Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
