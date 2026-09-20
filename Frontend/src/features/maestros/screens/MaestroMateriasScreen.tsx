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
import { DateTimePicker } from '../../../displays/components/DateTimePicker';
import { InAppDocumentViewerModal } from '../../../displays/components/InAppDocumentViewerModal';
import { ConfirmDeleteModal } from '../../../displays/components/ConfirmDeleteModal';
import { connectUsersWebSocket } from '../../../api/users.websocket';

interface AsignacionMateria {
  id: string;
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
  estudiante?: { nombre?: string; apellidoPaterno?: string; apellidoMaterno?: string };
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ENCARGO_ESTADOS = ['borrador', 'publicado', 'cerrado', 'cancelado'] as const;
const ENCARGO_TIPOS = ['tarea', 'práctica', 'examen', 'proyecto', 'quiz'] as const;

function getExtBadge(fn?: string): { bg: string; text: string; label: string } {
  const ext = (fn?.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return { bg: 'bg-red-100', text: 'text-red-700', label: 'PDF' };
  if (['docx', 'doc'].includes(ext)) return { bg: 'bg-blue-100', text: 'text-blue-700', label: ext.toUpperCase() };
  if (['xlsx', 'xls'].includes(ext)) return { bg: 'bg-green-100', text: 'text-green-700', label: ext.toUpperCase() };
  return { bg: 'bg-gray-100', text: 'text-gray-600', label: ext.toUpperCase() || 'DOC' };
}

function fmtBytes(b?: number) {
  if (!b) return '';
  return b > 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(2)} MB` : `${(b / 1024).toFixed(1)} KB`;
}

export function MaestroMateriasScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [materias, setMaterias] = useState<AsignacionMateria[]>([]);
  const [selectedAsig, setSelectedAsig] = useState<AsignacionMateria | null>(null);
  const [contentTab, setContentTab] = useState<'materiales' | 'tareas'>('tareas');
  const [materialesList, setMaterialesList] = useState<MaterialItem[]>([]);
  const [encargosList, setEncargosList] = useState<EncargoItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);

  // Material form
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialItem | null>(null);
  const [matTitulo, setMatTitulo] = useState('');
  const [matDetalle, setMatDetalle] = useState('');
  const [matFile, setMatFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [savingMat, setSavingMat] = useState(false);

  // Encargo form
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [editingEncargo, setEditingEncargo] = useState<EncargoItem | null>(null);
  const [tareaTitulo, setTareaTitulo] = useState('');
  const [tareaDescripcion, setTareaDescripcion] = useState('');
  const [tareaPonderacion, setTareaPonderacion] = useState('100');
  const [tareaTipo, setTareaTipo] = useState<string>('tarea');
  const [tareaEstado, setTareaEstado] = useState<string>('publicado');
  const [tareaFechaInicio, setTareaFechaInicio] = useState(new Date().toISOString().slice(0, 16));
  const [tareaFechaCierre, setTareaFechaCierre] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  );
  const [savingTarea, setSavingTarea] = useState(false);

  // Entregas
  const [entregasModalOpen, setEntregasModalOpen] = useState(false);
  const [selectedEncargoForEntregas, setSelectedEncargoForEntregas] = useState<EncargoItem | null>(null);
  const [entregas, setEntregas] = useState<EntregaItem[]>([]);
  const [loadingEntregas, setLoadingEntregas] = useState(false);

  // Viewer
  const [viewerDoc, setViewerDoc] = useState<{
    visible: boolean; title: string; url?: string | null;
    fileName?: string; mimeType?: string; fileSize?: number; uploadedAt?: string;
  }>({ visible: false, title: '' });

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'material' | 'encargo'; item: MaterialItem | EncargoItem } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        if (user.nombre && m.nombre &&
          String(m.nombre).toLowerCase() === user.nombre.toLowerCase() &&
          String(m.apellidoPaterno ?? '').toLowerCase() === (user.apellidoPaterno ?? '').toLowerCase()) return true;
        return false;
      });
      const src = filtered.length > 0 ? filtered : all;
      setMaterias(src.map((asig) => {
        const c = asig.cursoPeriodo?.curso || {};
        return {
          id: String(asig.id),
          materiaId: String(asig.materiaId || asig.materia?.id || ''),
          materiaNombre: asig.materia?.nombre || 'Materia',
          materiaCodigo: asig.materia?.codigo,
          cursoPeriodoId: String(asig.cursoPeriodoId || asig.cursoPeriodo?.id || ''),
          grado: c.grado || '1',
          paralelo: c.paralelo || 'A',
          nivel: c.nivel || 'Secundaria',
          anio: asig.cursoPeriodo?.periodo?.anio,
        };
      }));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadMaterias(); }, [user?.id]);

  useEffect(() => {
    if (!selectedAsig) return;
    const unsub = connectUsersWebSocket(() => {
      academicServicesApi.list('materiales', { asignacionId: selectedAsig.id, limit: 100 })
        .then((r) => setMaterialesList(r.data as any[])).catch(() => {});
      academicServicesApi.list('encargos', { asignacionId: selectedAsig.id, limit: 100 })
        .then((r) => setEncargosList(r.data as any[])).catch(() => {});
    });
    return () => { if (unsub) unsub(); };
  }, [selectedAsig?.id]);

  const reloadContent = async (asig: AsignacionMateria) => {
    const [mRes, eRes] = await Promise.all([
      academicServicesApi.list('materiales', { asignacionId: asig.id, limit: 100 }),
      academicServicesApi.list('encargos', { asignacionId: asig.id, limit: 100 }),
    ]);
    setMaterialesList(mRes.data as any[]);
    setEncargosList(eRes.data as any[]);
  };

  const handleSelectSubject = async (asig: AsignacionMateria) => {
    setSelectedAsig(asig);
    setLoadingContent(true);
    setShowMaterialForm(false);
    setShowTareaForm(false);
    try { await reloadContent(asig); } catch (e) { console.error(e); } finally { setLoadingContent(false); }
  };

  // ── MATERIAL CRUD ─────────────────────────────────────────────────────────
  const openNewMaterial = () => { setEditingMaterial(null); setMatTitulo(''); setMatDetalle(''); setMatFile(null); setShowMaterialForm(true); };
  const openEditMaterial = (m: MaterialItem) => { setEditingMaterial(m); setMatTitulo(m.titulo); setMatDetalle(m.detalle || ''); setMatFile(null); setShowMaterialForm(true); };
  const closeMaterialForm = () => { setShowMaterialForm(false); setEditingMaterial(null); setMatTitulo(''); setMatDetalle(''); setMatFile(null); };

  const handlePickFile = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ALLOWED_TYPES, copyToCacheDirectory: true });
    if (r.canceled) return;
    const a = r.assets[0];
    if ((a.size ?? 0) > 150 * 1024 * 1024) { Alert.alert('Archivo excedido', 'Máximo 150 MB.'); return; }
    setMatFile(a);
  };

  const handleSaveMaterial = async () => {
    if (!selectedAsig) return;
    if (!matTitulo.trim()) { Alert.alert('Campo requerido', 'Ingresa el título del material.'); return; }
    if (!editingMaterial && !matFile) { Alert.alert('Archivo requerido', 'Adjunta un PDF, Word o Excel.'); return; }
    try {
      setSavingMat(true);
      const buildFormData = async () => {
        const data = new FormData();
        data.append('titulo', matTitulo.trim());
        if (matDetalle.trim()) data.append('detalle', matDetalle.trim());
        if (matFile) {
          if (Platform.OS === 'web' && (matFile as any).file) { data.append('file', (matFile as any).file); }
          else { const b = await (await fetch(matFile.uri)).blob(); data.append('file', b, matFile.name); }
        }
        return data;
      };
      if (editingMaterial && matFile) {
        await academicServicesApi.updateMaterialWithFile(editingMaterial.id, await buildFormData());
      } else if (editingMaterial) {
        await academicServicesApi.update('materiales', editingMaterial.id, { titulo: matTitulo.trim(), detalle: matDetalle.trim() || null });
      } else {
        const data = await buildFormData();
        data.append('asignacionId', selectedAsig.id);
        await academicServicesApi.uploadMaterial(data);
      }
      closeMaterialForm();
      await reloadContent(selectedAsig);
    } catch (e: any) { Alert.alert('Error', e.message || 'No se pudo guardar.'); } finally { setSavingMat(false); }
  };

  const handleDeleteMaterial = (mat: MaterialItem) => {
    setDeleteTarget({ type: 'material', item: mat });
  };

  const handleDeleteEncargo = (enc: EncargoItem) => {
    setDeleteTarget({ type: 'encargo', item: enc });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === 'material') {
        await academicServicesApi.remove('materiales', deleteTarget.item.id);
      } else {
        await academicServicesApi.remove('encargos', deleteTarget.item.id);
      }
      setDeleteTarget(null);
      if (selectedAsig) await reloadContent(selectedAsig);
    } catch (e: any) {
      Alert.alert('Error al eliminar', e.message || 'No se pudo eliminar el registro.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── ENCARGO CRUD ──────────────────────────────────────────────────────────
  const openNewEncargo = () => {
    setEditingEncargo(null); setTareaTitulo(''); setTareaDescripcion(''); setTareaPonderacion('100');
    setTareaTipo('tarea'); setTareaEstado('publicado');
    setTareaFechaInicio(new Date().toISOString().slice(0, 16));
    setTareaFechaCierre(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setShowTareaForm(true);
  };
  const openEditEncargo = (enc: EncargoItem) => {
    setEditingEncargo(enc); setTareaTitulo(enc.titulo); setTareaDescripcion(enc.descripcion || '');
    setTareaPonderacion(String(enc.ponderacion)); setTareaTipo(enc.tipo || 'tarea'); setTareaEstado(enc.estado || 'publicado');
    setTareaFechaInicio(enc.fechaPublicacion?.slice(0, 16) || new Date().toISOString().slice(0, 16));
    setTareaFechaCierre(enc.fechaLimite?.slice(0, 16) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setShowTareaForm(true);
  };
  const closeTareaForm = () => { setShowTareaForm(false); setEditingEncargo(null); };

  const handleSaveTarea = async () => {
    if (!selectedAsig) return;
    if (!tareaTitulo.trim()) { Alert.alert('Campo requerido', 'Ingresa el título.'); return; }
    if (!tareaFechaInicio || !tareaFechaCierre) { Alert.alert('Fechas requeridas', 'Define inicio y cierre.'); return; }
    if (new Date(tareaFechaCierre) <= new Date(tareaFechaInicio)) { Alert.alert('Rango inválido', 'El cierre debe ser posterior al inicio.'); return; }
    try {
      setSavingTarea(true);
      const payload = {
        asignacionId: selectedAsig.id, tipo: tareaTipo, titulo: tareaTitulo.trim(),
        descripcion: tareaDescripcion.trim() || undefined, ponderacion: Number(tareaPonderacion) || 100,
        fechaPublicacion: new Date(tareaFechaInicio).toISOString(),
        fechaLimite: new Date(tareaFechaCierre).toISOString(), estado: tareaEstado,
      };
      if (editingEncargo) await academicServicesApi.update('encargos', editingEncargo.id, payload);
      else await academicServicesApi.create('encargos', payload);
      closeTareaForm();
      await reloadContent(selectedAsig);
    } catch (e: any) { Alert.alert('Error', e.message || 'No se pudo guardar.'); } finally { setSavingTarea(false); }
  };

  const handleOpenEntregas = async (enc: EncargoItem) => {
    setSelectedEncargoForEntregas(enc); setEntregasModalOpen(true); setLoadingEntregas(true);
    try { setEntregas((await academicServicesApi.list('entregas', { encargoId: enc.id, limit: 150 })).data as any[]); }
    catch { setEntregas([]); } finally { setLoadingEntregas(false); }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-10">

      {/* ── Header ── */}
      <BentoCard className="p-5">
        <View className="flex-row items-center gap-3">
          {selectedAsig && (
            <TouchableOpacity
              onPress={() => { setSelectedAsig(null); setShowMaterialForm(false); setShowTareaForm(false); }}
              className="w-10 h-10 rounded-2xl bg-gray-100 items-center justify-center"
            >
              <Ionicons name="arrow-back" size={20} color="#374151" />
            </TouchableOpacity>
          )}
          <View className="flex-1">
            <Text className="text-2xl font-black text-gray-900">
              {selectedAsig ? selectedAsig.materiaNombre : 'Mis Materias'}
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              {selectedAsig
                ? `${selectedAsig.grado}° "${selectedAsig.paralelo}" · ${selectedAsig.nivel}${selectedAsig.anio ? ` · Gestión ${selectedAsig.anio}` : ''}`
                : 'Selecciona una materia para gestionar contenido y evaluaciones'}
            </Text>
          </View>
          {selectedAsig && (
            <View className="bg-green-100 px-3 py-1.5 rounded-full">
              <Text className="text-xs font-black text-green-700">EN EDICIÓN</Text>
            </View>
          )}
        </View>

        {selectedAsig && (
          <View className="flex-row gap-2 mt-4 pt-4 border-t border-gray-100">
            {(['tareas', 'materiales'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setContentTab(tab)}
                className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2 ${contentTab === tab ? 'bg-maroon' : 'bg-gray-100'}`}
              >
                <Ionicons name={tab === 'tareas' ? 'clipboard-outline' : 'folder-open-outline'} size={16} color={contentTab === tab ? '#fff' : '#4B5563'} />
                <Text className={`text-xs font-bold ${contentTab === tab ? 'text-white' : 'text-gray-700'}`}>
                  {tab === 'tareas' ? `Evaluaciones (${encargosList.length})` : `Materiales (${materialesList.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </BentoCard>

      {/* ── Selección de materia ── */}
      {!selectedAsig ? (
        loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator size="large" color="#801529" />
            <Text className="text-gray-500 text-sm mt-3 font-medium">Cargando materias asignadas...</Text>
          </View>
        ) : materias.length === 0 ? (
          <BentoCard className="p-10 items-center">
            <View className="w-16 h-16 rounded-3xl bg-gray-100 items-center justify-center mb-3">
              <Ionicons name="book-outline" size={32} color="#D1D5DB" />
            </View>
            <Text className="text-lg font-bold text-gray-700">Sin materias asignadas</Text>
            <Text className="text-sm text-gray-400 mt-1 text-center">No tienes materias activas en la gestión académica actual.</Text>
          </BentoCard>
        ) : (
          <View className="flex-row flex-wrap -mx-2">
            {materias.map((item) => (
              <View key={item.id} className="w-full md:w-1/2 lg:w-1/3 p-2">
                <BentoCard className="p-5 h-full flex-col justify-between">
                  <View>
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="w-12 h-12 rounded-2xl bg-maroon/10 border border-maroon/20 items-center justify-center">
                        <Ionicons name="book" size={24} color="#801529" />
                      </View>
                      <View className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                        <Text className="text-[10px] font-black text-blue-700 uppercase">{item.nivel}</Text>
                      </View>
                    </View>
                    <Text className="text-lg font-black text-gray-900" numberOfLines={2}>{item.materiaNombre}</Text>
                    {item.materiaCodigo && <Text className="text-xs text-gray-400 font-mono mt-0.5">{item.materiaCodigo}</Text>}
                    <View className="flex-row flex-wrap gap-2 mt-3">
                      <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                        <Text className="text-[10px] text-gray-500 font-semibold">Grado</Text>
                        <Text className="text-xs font-bold text-gray-800">{item.grado}° "{item.paralelo}"</Text>
                      </View>
                      {item.anio && (
                        <View className="bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/40">
                          <Text className="text-[10px] text-amber-700 font-semibold">Gestión</Text>
                          <Text className="text-xs font-bold text-amber-800">{item.anio}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => handleSelectSubject(item)} className="mt-4 bg-maroon rounded-xl py-2.5 flex-row items-center justify-center gap-2">
                    <Ionicons name="folder-open-outline" size={17} color="#fff" />
                    <Text className="text-white text-sm font-bold">Gestionar Contenido</Text>
                  </TouchableOpacity>
                </BentoCard>
              </View>
            ))}
          </View>
        )

      ) : loadingContent ? (
        <View className="py-16 items-center">
          <ActivityIndicator size="large" color="#801529" />
          <Text className="text-xs text-gray-500 mt-3 font-medium">Cargando recursos didácticos...</Text>
        </View>

      ) : contentTab === 'tareas' ? (
        /* ─────────── EVALUACIONES ─────────── */
        <View className="gap-4">
          <BentoCard className="p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-black text-gray-900">Evaluaciones y Tareas</Text>
                <Text className="text-xs text-gray-500 mt-0.5">{encargosList.length} registros en esta materia</Text>
              </View>
              <TouchableOpacity
                onPress={showTareaForm ? closeTareaForm : openNewEncargo}
                className={`px-4 py-2.5 rounded-xl flex-row items-center gap-2 ${showTareaForm ? 'bg-gray-200' : 'bg-maroon'}`}
              >
                <Ionicons name={showTareaForm ? 'close' : 'add'} size={18} color={showTareaForm ? '#374151' : '#fff'} />
                <Text className={`text-xs font-bold ${showTareaForm ? 'text-gray-700' : 'text-white'}`}>{showTareaForm ? 'Cancelar' : 'Nueva'}</Text>
              </TouchableOpacity>
            </View>
          </BentoCard>

          {showTareaForm && (
            <BentoCard className="p-5 border-2 border-maroon/20">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-xl bg-maroon items-center justify-center">
                  <Ionicons name="clipboard" size={16} color="#fff" />
                </View>
                <Text className="text-base font-black text-gray-900">{editingEncargo ? 'Editar evaluación' : 'Nueva evaluación'}</Text>
              </View>
              <View className="gap-3">
                <View>
                  <Text className="text-xs font-semibold text-gray-600 mb-1.5">Tipo *</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {ENCARGO_TIPOS.map((t) => (
                      <TouchableOpacity key={t} onPress={() => setTareaTipo(t)} className={`px-3 py-2 rounded-xl ${tareaTipo === t ? 'bg-maroon' : 'bg-gray-100'}`}>
                        <Text className={`text-xs font-bold capitalize ${tareaTipo === t ? 'text-white' : 'text-gray-600'}`}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View>
                  <Text className="text-xs font-semibold text-gray-600 mb-1.5">Título *</Text>
                  <TextInput value={tareaTitulo} onChangeText={setTareaTitulo} placeholder="Ej: Examen de unidad 2" className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800" placeholderTextColor="#9CA3AF" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-gray-600 mb-1.5">Descripción / Consigna</Text>
                  <TextInput value={tareaDescripcion} onChangeText={setTareaDescripcion} placeholder="Instrucciones para los estudiantes..." multiline numberOfLines={3} className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800 min-h-[70px]" placeholderTextColor="#9CA3AF" />
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-gray-600 mb-1.5">Ponderación (pts)</Text>
                    <TextInput value={tareaPonderacion} onChangeText={setTareaPonderacion} keyboardType="numeric" placeholder="100" className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800" placeholderTextColor="#9CA3AF" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-gray-600 mb-1.5">Estado</Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {ENCARGO_ESTADOS.map((e) => (
                        <TouchableOpacity key={e} onPress={() => setTareaEstado(e)} className={`px-2.5 py-2 rounded-xl ${tareaEstado === e ? 'bg-maroon' : 'bg-gray-100'}`}>
                          <Text className={`text-[10px] font-bold ${tareaEstado === e ? 'text-white' : 'text-gray-600'}`}>{e}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <DateTimePicker label="📅 Fecha Inicio *" value={tareaFechaInicio} onChange={setTareaFechaInicio} className="flex-1" />
                  <DateTimePicker label="⏰ Fecha Cierre *" value={tareaFechaCierre} onChange={setTareaFechaCierre} className="flex-1" />
                </View>
                <TouchableOpacity onPress={handleSaveTarea} disabled={savingTarea} className="bg-maroon rounded-xl py-3 items-center mt-1 shadow">
                  {savingTarea ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-black text-sm">{editingEncargo ? 'Guardar cambios' : 'Publicar evaluación'}</Text>}
                </TouchableOpacity>
              </View>
            </BentoCard>
          )}

          {encargosList.length === 0 ? (
            <BentoCard className="p-10 items-center">
              <View className="w-14 h-14 rounded-3xl bg-gray-100 items-center justify-center mb-3">
                <Ionicons name="clipboard-outline" size={28} color="#D1D5DB" />
              </View>
              <Text className="text-sm font-bold text-gray-600">Sin evaluaciones publicadas</Text>
              <Text className="text-xs text-gray-400 mt-1">Usa "Nueva" para crear la primera.</Text>
            </BentoCard>
          ) : (
            <View className="flex-row flex-wrap -mx-2">
              {encargosList.map((enc) => {
                const isClosed = enc.fechaLimite ? new Date() > new Date(enc.fechaLimite) : false;
                const tipoColor: Record<string, string> = { tarea:'bg-blue-100 text-blue-700', examen:'bg-red-100 text-red-700', práctica:'bg-purple-100 text-purple-700', proyecto:'bg-amber-100 text-amber-700', quiz:'bg-cyan-100 text-cyan-700' };
                const tc = (tipoColor[enc.tipo] ?? 'bg-gray-100 text-gray-700').split(' ');
                return (
                  <View key={enc.id} className="w-full md:w-1/2 lg:w-1/3 p-2">
                    <BentoCard className="p-4 h-full flex-col justify-between">
                      <View>
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="w-10 h-10 rounded-2xl bg-maroon/10 border border-maroon/20 items-center justify-center">
                            <Ionicons name="clipboard" size={20} color="#801529" />
                          </View>
                          <View className="flex-row gap-1.5 flex-wrap justify-end">
                            <View className={`px-2 py-0.5 rounded-md ${tc[0]}`}>
                              <Text className={`text-[10px] font-black uppercase ${tc[1]}`}>{enc.tipo}</Text>
                            </View>
                            <View className={`px-2 py-0.5 rounded-md ${isClosed ? 'bg-red-100' : 'bg-green-100'}`}>
                              <Text className={`text-[10px] font-black ${isClosed ? 'text-red-700' : 'text-green-700'}`}>{isClosed ? 'CERRADA' : 'ABIERTA'}</Text>
                            </View>
                          </View>
                        </View>
                        <Text className="font-black text-gray-900 text-sm mb-1" numberOfLines={2}>{enc.titulo}</Text>
                        {enc.descripcion ? <Text className="text-xs text-gray-500 mb-2" numberOfLines={2}>{enc.descripcion}</Text> : null}
                        <View className="flex-row flex-wrap gap-2 mt-1">
                          <View className="bg-maroon/10 px-2.5 py-1 rounded-lg border border-maroon/20">
                            <Text className="text-[10px] text-maroon font-semibold">Ponderación</Text>
                            <Text className="text-xs font-black text-maroon">{enc.ponderacion} pts</Text>
                          </View>
                          {enc.fechaLimite && (
                            <View className={`px-2.5 py-1 rounded-lg border ${isClosed ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                              <Text className={`text-[10px] font-semibold ${isClosed ? 'text-red-600' : 'text-amber-700'}`}>Cierre</Text>
                              <Text className={`text-xs font-bold ${isClosed ? 'text-red-700' : 'text-amber-800'}`}>{enc.fechaLimite.replace('T',' ').slice(0,16)}</Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => handleOpenEntregas(enc)} className="mt-2 py-2 px-3 bg-gray-100 rounded-xl flex-row items-center justify-center gap-1.5">
                          <Ionicons name="documents-outline" size={15} color="#801529" />
                          <Text className="text-xs font-bold text-maroon">Revisar Entregas</Text>
                        </TouchableOpacity>
                      </View>
                      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
                        <Text className="text-[10px] text-gray-400 font-mono">#{enc.id}</Text>
                        <View className="flex-row gap-1.5">
                          <TouchableOpacity onPress={() => openEditEncargo(enc)} className="p-2 bg-gray-100 rounded-xl">
                            <Ionicons name="create-outline" size={16} color="#801529" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteEncargo(enc)} className="p-2 bg-red-50 rounded-xl">
                            <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </BentoCard>
                  </View>
                );
              })}
            </View>
          )}
        </View>

      ) : (
        /* ─────────── MATERIALES ─────────── */
        <View className="gap-4">
          <BentoCard className="p-4">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-base font-black text-gray-900">Material Pedagógico</Text>
                <Text className="text-xs text-gray-500 mt-0.5">{materialesList.length} archivos · PDF, Word, Excel (máx. 150 MB)</Text>
              </View>
              <TouchableOpacity
                onPress={showMaterialForm ? closeMaterialForm : openNewMaterial}
                className={`px-4 py-2.5 rounded-xl flex-row items-center gap-2 ${showMaterialForm ? 'bg-gray-200' : 'bg-maroon'}`}
              >
                <Ionicons name={showMaterialForm ? 'close' : 'cloud-upload'} size={18} color={showMaterialForm ? '#374151' : '#fff'} />
                <Text className={`text-xs font-bold ${showMaterialForm ? 'text-gray-700' : 'text-white'}`}>{showMaterialForm ? 'Cancelar' : 'Subir'}</Text>
              </TouchableOpacity>
            </View>
          </BentoCard>

          {showMaterialForm && (
            <BentoCard className="p-5 border-2 border-maroon/20">
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-8 h-8 rounded-xl bg-maroon items-center justify-center">
                  <Ionicons name="document-attach" size={16} color="#fff" />
                </View>
                <Text className="text-base font-black text-gray-900">{editingMaterial ? 'Editar material' : 'Subir nuevo material'}</Text>
              </View>
              <View className="gap-3">
                <View>
                  <Text className="text-xs font-semibold text-gray-600 mb-1.5">Título *</Text>
                  <TextInput value={matTitulo} onChangeText={setMatTitulo} placeholder="Ej: Guía de Ejercicios N° 3" className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800" placeholderTextColor="#9CA3AF" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-gray-600 mb-1.5">Detalle / Instrucciones</Text>
                  <TextInput value={matDetalle} onChangeText={setMatDetalle} placeholder="Descripción o contexto del material..." multiline numberOfLines={2} className="bg-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-800 min-h-[60px]" placeholderTextColor="#9CA3AF" />
                </View>
                <View>
                  <Text className="text-xs font-semibold text-gray-600 mb-1.5">{editingMaterial ? 'Reemplazar Archivo (opcional)' : 'Archivo *'}</Text>
                  <TouchableOpacity onPress={handlePickFile} className="p-4 border-2 border-dashed border-maroon/30 rounded-xl bg-gray-50 flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-maroon/10 items-center justify-center">
                      <Ionicons name="document-attach-outline" size={22} color="#801529" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-bold text-maroon" numberOfLines={1}>
                        {matFile ? matFile.name : editingMaterial?.nombreArchivo ? `📎 ${editingMaterial.nombreArchivo}` : 'Seleccionar PDF, DOCX o XLSX'}
                      </Text>
                      <Text className="text-[10px] text-gray-400 mt-0.5">
                        {matFile ? `${Math.round((matFile.size ?? 0) / 1024)} KB · Nuevo archivo seleccionado` : editingMaterial ? 'Toca para reemplazar' : 'Hasta 150 MB'}
                      </Text>
                    </View>
                    {matFile && (
                      <TouchableOpacity onPress={() => setMatFile(null)} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={handleSaveMaterial} disabled={savingMat} className="bg-maroon rounded-xl py-3 items-center mt-1 shadow">
                  {savingMat ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white font-black text-sm">{editingMaterial ? 'Guardar cambios' : 'Publicar recurso'}</Text>}
                </TouchableOpacity>
              </View>
            </BentoCard>
          )}

          {materialesList.length === 0 ? (
            <BentoCard className="p-10 items-center">
              <View className="w-14 h-14 rounded-3xl bg-gray-100 items-center justify-center mb-3">
                <Ionicons name="folder-open-outline" size={28} color="#D1D5DB" />
              </View>
              <Text className="text-sm font-bold text-gray-600">Sin materiales publicados</Text>
              <Text className="text-xs text-gray-400 mt-1">Usa "Subir" para añadir el primer recurso.</Text>
            </BentoCard>
          ) : (
            <View className="flex-row flex-wrap -mx-2">
              {materialesList.map((mat) => {
                const badge = getExtBadge(mat.nombreArchivo);
                return (
                  <View key={mat.id} className="w-full md:w-1/2 lg:w-1/3 p-2">
                    <BentoCard className="p-4 h-full flex-col justify-between">
                      <View>
                        <View className="flex-row items-start justify-between mb-2">
                          <View className="w-10 h-10 rounded-2xl bg-gold/20 border border-gold/30 items-center justify-center">
                            <Ionicons name="document-text" size={20} color="#B45309" />
                          </View>
                          <View className="flex-row gap-1.5">
                            <View className={`px-2 py-0.5 rounded-md ${badge.bg}`}>
                              <Text className={`text-[10px] font-black ${badge.text}`}>{badge.label}</Text>
                            </View>
                            {mat.activo !== false && (
                              <View className="px-2 py-0.5 bg-green-100 rounded-md">
                                <Text className="text-[10px] font-black text-green-700">ACTIVO</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text className="font-black text-gray-900 text-sm mb-1" numberOfLines={2}>{mat.titulo}</Text>
                        {mat.detalle ? <Text className="text-xs text-gray-500 mb-2" numberOfLines={2}>{mat.detalle}</Text> : null}
                        <View className="gap-0.5 mt-1">
                          {mat.nombreArchivo && <Text className="text-xs text-gray-600 font-medium" numberOfLines={1}>📎 {mat.nombreArchivo}</Text>}
                          <View className="flex-row items-center gap-2">
                            {mat.tamanioBytes != null && <Text className="text-[10px] text-gray-400 font-mono">{fmtBytes(mat.tamanioBytes)}</Text>}
                            {mat.fechaSubida && <Text className="text-[10px] text-gray-400">· {mat.fechaSubida.slice(0,10)}</Text>}
                          </View>
                        </View>
                        {mat.archivoUrl && (
                          <TouchableOpacity
                            onPress={() => setViewerDoc({ visible:true, title:mat.titulo, url:mat.archivoUrl, fileName:mat.nombreArchivo, mimeType:mat.tipoMime, fileSize:mat.tamanioBytes, uploadedAt:mat.fechaSubida })}
                            className="mt-2 py-2 px-3 bg-blue-50 rounded-xl flex-row items-center justify-center gap-1.5"
                          >
                            <Ionicons name="eye-outline" size={15} color="#2563EB" />
                            <Text className="text-xs font-bold text-blue-700">{badge.label === 'PDF' ? 'Vista previa PDF' : 'Abrir en Docs'}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View className="flex-row items-center justify-between mt-3 pt-2.5 border-t border-gray-100">
                        <Text className="text-[10px] text-gray-400 font-mono">#{mat.id}</Text>
                        <View className="flex-row gap-1.5">
                          <TouchableOpacity onPress={() => openEditMaterial(mat)} className="p-2 bg-gray-100 rounded-xl">
                            <Ionicons name="create-outline" size={16} color="#801529" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteMaterial(mat)} className="p-2 bg-red-50 rounded-xl">
                            <Ionicons name="trash-outline" size={16} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </BentoCard>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── Modal Entregas ── */}
      <Modal visible={entregasModalOpen} animationType="fade" transparent onRequestClose={() => setEntregasModalOpen(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
          <View className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
            <View className="p-5 bg-maroon flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-lg font-black text-white" numberOfLines={1}>Entregas: {selectedEncargoForEntregas?.titulo}</Text>
                <Text className="text-xs text-white/70 mt-0.5">Cierre: {selectedEncargoForEntregas?.fechaLimite?.replace('T',' ').slice(0,16) || 'Sin límite'}</Text>
              </View>
              <TouchableOpacity onPress={() => setEntregasModalOpen(false)} className="w-9 h-9 rounded-xl bg-white/20 items-center justify-center">
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView className="p-4 max-h-[55vh]">
              {loadingEntregas ? (
                <View className="py-10 items-center"><ActivityIndicator size="small" color="#801529" /><Text className="text-xs text-gray-500 mt-2">Consultando entregas...</Text></View>
              ) : entregas.length === 0 ? (
                <View className="py-10 items-center">
                  <Ionicons name="file-tray-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-bold text-gray-600 mt-2">Sin entregas todavía</Text>
                </View>
              ) : (
                <View className="gap-3 pb-4">
                  {entregas.map((ent) => {
                    const ok = ent.estadoEntrega === 'a_tiempo';
                    return (
                      <View key={ent.id} className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-sm font-bold text-gray-800">{ent.estudiante?.apellidoPaterno} {ent.estudiante?.apellidoMaterno} {ent.estudiante?.nombre || 'Estudiante'}</Text>
                          <Text className="text-xs text-gray-500 mt-0.5">Entregado: {ent.fechaEntrega?.replace('T',' ').slice(0,16)}</Text>
                          {ent.nombreArchivo ? <Text className="text-xs text-maroon font-semibold mt-1">📎 {ent.nombreArchivo}</Text> : null}
                          {ent.comentario ? <Text className="text-[11px] text-gray-500 italic mt-0.5">"{ent.comentario}"</Text> : null}
                          {ent.archivoUrl ? (
                            <TouchableOpacity
                              onPress={() => setViewerDoc({ visible:true, title:`${ent.estudiante?.nombre||'Est.'} ${ent.estudiante?.apellidoPaterno||''}`, url:ent.archivoUrl, fileName:ent.nombreArchivo, uploadedAt:ent.fechaEntrega })}
                              className="mt-2 bg-maroon/10 px-3 py-1.5 rounded-lg flex-row items-center self-start gap-1.5"
                            >
                              <Ionicons name="eye-outline" size={14} color="#801529" />
                              <Text className="text-xs font-bold text-maroon">Ver entrega</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <View className={`px-2.5 py-1 rounded-xl ${ok ? 'bg-green-100' : 'bg-red-100'}`}>
                          <Text className={`text-[10px] font-black ${ok ? 'text-green-700' : 'text-red-700'}`}>{ok ? 'A TIEMPO' : 'RETRASO'}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
            <View className="p-4 border-t border-gray-100 bg-gray-50 flex-row justify-end">
              <TouchableOpacity onPress={() => setEntregasModalOpen(false)} className="bg-gray-200 px-5 py-2.5 rounded-xl">
                <Text className="text-sm font-bold text-gray-700">Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Visor de Documentos ── */}
      <InAppDocumentViewerModal
        visible={viewerDoc.visible}
        onClose={() => setViewerDoc({ visible: false, title: '' })}
        title={viewerDoc.title}
        url={viewerDoc.url}
        fileName={viewerDoc.fileName}
        mimeType={viewerDoc.mimeType}
        fileSize={viewerDoc.fileSize}
        uploadedAt={viewerDoc.uploadedAt}
      />

      {/* ── Confirmación de Eliminación ── */}
      <ConfirmDeleteModal
        visible={Boolean(deleteTarget)}
        title={deleteTarget?.type === 'material' ? 'Eliminar Material' : 'Eliminar Evaluación'}
        itemName={deleteTarget?.item.titulo}
        message={
          deleteTarget?.type === 'material'
            ? '¿Está seguro de que desea eliminar este recurso pedagógico?'
            : '¿Está seguro de que desea eliminar esta evaluación o tarea? Se borrarán las calificaciones y entregas vinculadas.'
        }
        warningNote={
          deleteTarget?.type === 'material'
            ? 'El archivo adjunto también será eliminado permanentemente de MinIO.'
            : undefined
        }
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </ScrollView>
  );
}

