import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface MateriaItemOption {
  id: string;
  nombre: string;
  codigo: string;
}

interface MateriaSelectorModalProps {
  materias: MateriaItemOption[];
  selectedIds: string[];
  onChange: (newIds: string[]) => void;
}

export function MateriaSelectorModal({
  materias,
  selectedIds,
  onChange,
}: MateriaSelectorModalProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedMaterias = useMemo(() => {
    const map = new Map(materias.map((m) => [m.id, m]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as MateriaItemOption[];
  }, [materias, selectedIds]);

  const filteredMaterias = useMemo(() => {
    if (!search.trim()) return materias;
    const q = search.toLowerCase().trim();
    return materias.filter(
      (m) =>
        m.nombre.toLowerCase().includes(q) ||
        (m.codigo && m.codigo.toLowerCase().includes(q))
    );
  }, [materias, search]);

  const toggleMateria = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const removeMateria = (id: string) => {
    onChange(selectedIds.filter((item) => item !== id));
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredMaterias.map((m) => m.id);
    const set = new Set([...selectedIds, ...idsToAdd]);
    onChange(Array.from(set));
  };

  const deselectAllFiltered = () => {
    const idsToRemove = new Set(filteredMaterias.map((m) => m.id));
    onChange(selectedIds.filter((id) => !idsToRemove.has(id)));
  };

  return (
    <View className="gap-2.5">
      {/* ── Encabezado y resumen del selector ── */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="book-outline" size={16} color="#801529" />
          <Text className="text-xs font-bold text-gray-800 uppercase">
            Materias Asignadas
          </Text>
          <View
            className={`px-2 py-0.5 rounded-full ${
              selectedIds.length > 0 ? 'bg-maroon/10 border border-maroon/20' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-[10px] font-extrabold ${
                selectedIds.length > 0 ? 'text-maroon' : 'text-gray-500'
              }`}
            >
              {selectedIds.length} {selectedIds.length === 1 ? 'materia' : 'materias'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setModalOpen(true)}
          className="flex-row items-center gap-1.5 px-3 py-1.5 bg-maroon/10 hover:bg-maroon/20 rounded-xl border border-maroon/20"
        >
          <Ionicons name="options-outline" size={14} color="#801529" />
          <Text className="text-xs font-bold text-maroon">
            {selectedIds.length > 0 ? 'Modificar materias' : '+ Seleccionar materias'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Tags de materias seleccionadas ── */}
      {selectedMaterias.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5 bg-white/70 p-2.5 rounded-2xl border border-gray-200/80">
          {selectedMaterias.map((materia) => (
            <View
              key={materia.id}
              className="flex-row items-center gap-1.5 bg-maroon/5 border border-maroon/20 pl-2.5 pr-1.5 py-1 rounded-xl"
            >
              <Text className="text-xs font-bold text-maroon">
                {materia.nombre}
              </Text>
              {materia.codigo ? (
                <View className="bg-maroon/15 px-1.5 py-0.5 rounded-md">
                  <Text className="text-[9px] font-mono font-bold text-maroon">
                    {materia.codigo}
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                onPress={() => removeMateria(materia.id)}
                className="w-4 h-4 rounded-full bg-maroon/15 items-center justify-center hover:bg-red-500 ml-0.5"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={10} color="#801529" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setModalOpen(true)}
          className="p-3.5 rounded-2xl bg-white border border-dashed border-gray-300 items-center justify-center flex-row gap-2"
        >
          <Ionicons name="add-circle-outline" size={18} color="#801529" />
          <Text className="text-xs font-medium text-gray-500">
            Ninguna materia seleccionada. Toque para elegir las materias del docente.
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Modal Selector Organizado con Buscador ── */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 flex-col max-h-[85vh]">
            {/* Header del Modal */}
            <View className="p-5 pb-3 border-b border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="w-10 h-10 rounded-2xl bg-maroon/10 border border-maroon/20 items-center justify-center">
                  <Ionicons name="book" size={20} color="#801529" />
                </View>
                <View>
                  <Text className="text-base font-bold text-gray-900">
                    Seleccionar Materias
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {selectedIds.length} seleccionada(s) de {materias.length} disponibles
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Buscador + Botones Rápidos */}
            <View className="p-4 pb-2 gap-2 bg-gray-50/60 border-b border-gray-100">
              <View className="flex-row items-center bg-white rounded-xl px-3 py-2 border border-gray-200">
                <Ionicons name="search" size={16} color="#9CA3AF" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar materia por nombre o código..."
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 ml-2 text-sm text-gray-800"
                  autoCapitalize="none"
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View className="flex-row items-center justify-between">
                <Text className="text-[11px] text-gray-500 font-medium">
                  Mostrando {filteredMaterias.length} resultados
                </Text>
                <View className="flex-row items-center gap-1.5">
                  <TouchableOpacity
                    onPress={selectAllFiltered}
                    className="px-2 py-1 bg-white border border-gray-200 rounded-lg"
                  >
                    <Text className="text-[11px] font-bold text-gray-700">
                      Marcar todas
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={deselectAllFiltered}
                    className="px-2 py-1 bg-white border border-gray-200 rounded-lg"
                  >
                    <Text className="text-[11px] font-bold text-red-600">
                      Limpiar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Lista Scrollable de Materias */}
            <ScrollView className="flex-1 p-3" contentContainerClassName="gap-1.5 pb-4">
              {filteredMaterias.length === 0 ? (
                <View className="py-12 items-center justify-center">
                  <Ionicons name="search-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-bold text-gray-600 mt-2">
                    No se encontraron materias
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5 text-center">
                    Intente con otro término de búsqueda o verifique la estructura académica.
                  </Text>
                </View>
              ) : (
                filteredMaterias.map((materia) => {
                  const isChecked = selectedIds.includes(materia.id);
                  return (
                    <TouchableOpacity
                      key={materia.id}
                      onPress={() => toggleMateria(materia.id)}
                      className={`p-3 rounded-2xl border flex-row items-center justify-between transition-colors ${
                        isChecked
                          ? 'bg-maroon/5 border-maroon/30 shadow-xs'
                          : 'bg-white border-gray-150 hover:bg-gray-50'
                      }`}
                    >
                      <View className="flex-row items-center gap-3 flex-1 pr-2">
                        <View
                          className={`w-6 h-6 rounded-lg items-center justify-center border ${
                            isChecked
                              ? 'bg-maroon border-maroon'
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          {isChecked ? (
                            <Ionicons name="checkmark" size={16} color="#ffffff" />
                          ) : null}
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`text-sm font-semibold ${
                              isChecked ? 'text-maroon' : 'text-gray-800'
                            }`}
                          >
                            {materia.nombre}
                          </Text>
                          {materia.codigo ? (
                            <Text className="text-[10px] text-gray-400 font-mono">
                              Código: {materia.codigo}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {isChecked ? (
                        <View className="px-2 py-0.5 bg-maroon/10 rounded-md">
                          <Text className="text-[10px] font-bold text-maroon">
                            Seleccionada
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Footer de Confirmación */}
            <View className="p-4 border-t border-gray-100 bg-gray-50/50 flex-row items-center justify-between">
              <Text className="text-xs text-gray-600 font-semibold">
                {selectedIds.length} {selectedIds.length === 1 ? 'materia lista' : 'materias listas'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                className="px-5 py-2.5 bg-maroon rounded-xl shadow-sm"
              >
                <Text className="text-xs font-bold text-white">
                  Listo / Aplicar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
