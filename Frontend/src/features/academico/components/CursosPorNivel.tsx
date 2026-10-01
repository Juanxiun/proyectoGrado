import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { NIVEL_LABEL, nivelDe, type CursoAgrupable } from '../utils/niveles';
import { BentoCard } from '../../../shared/ui';

export type CursoHabilitado = CursoAgrupable & {
  capacidadMaxima?: number;
  estado?: string;
};

interface CursosPorNivelProps {
  cursos: CursoHabilitado[];
  loading: boolean;
  onSelect: (cursoPeriodoId: string) => void;
  onRefresh?: () => void;
}

export function CursosPorNivel({
  cursos,
  loading,
  onSelect,
  onRefresh,
}: CursosPorNivelProps) {
  const [activeNivel, setActiveNivel] = useState<'primaria' | 'secundaria'>('primaria');

  if (loading) {
    return (
      <View className="py-20 items-center justify-center bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <ActivityIndicator size="large" color="#801529" />
        <Text className="text-sm font-semibold text-gray-700 mt-4">Cargando cursos y rendimiento académico…</Text>
        <Text className="text-xs text-gray-400 mt-1">Calculando notas y asistencia en tiempo real</Text>
      </View>
    );
  }

  if (cursos.length === 0) {
    return (
      <View className="py-16 items-center justify-center bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
        <View className="w-16 h-16 rounded-full bg-maroon/10 items-center justify-center mb-3">
          <Ionicons name="school-outline" size={32} color="#801529" />
        </View>
        <Text className="text-gray-800 text-base text-center font-bold">
          Esta gestión no tiene cursos habilitados
        </Text>
        <Text className="text-xs text-gray-500 mt-1 text-center max-w-sm">
          Asegúrate de generar la estructura de cursos en la Gestión Académica para visualizarlos aquí.
        </Text>
        {onRefresh && (
          <TouchableOpacity
            onPress={onRefresh}
            className="mt-4 flex-row items-center gap-2 bg-maroon px-4 py-2.5 rounded-xl"
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text className="text-white text-xs font-bold">Actualizar lista</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Filtrar cursos por el nivel activo
  const cursosDelNivelActivo = cursos.filter(
    (c) => nivelDe(c.nivel) === activeNivel,
  );

  // Agrupar por grados del nivel (1° al 6°)
  const gradosDelNivel = Array.from(
    new Set(cursosDelNivelActivo.map((c) => String(c.grado ?? '').trim())),
  ).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  return (
    <View className="gap-5">
      {/* ── Tabs de Selección de Nivel y Botón de Recarga ── */}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row gap-2 bg-gray-100 p-1 rounded-2xl flex-1 max-w-md border border-gray-200">
          <TouchableOpacity
            onPress={() => setActiveNivel('primaria')}
            className={`flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center gap-2 transition-all ${
              activeNivel === 'primaria' ? 'bg-maroon shadow-md' : 'hover:bg-gray-200'
            }`}
          >
            <Ionicons
              name="school-outline"
              size={18}
              color={activeNivel === 'primaria' ? '#FFFFFF' : '#4B5563'}
            />
            <Text
              className={`text-sm font-bold ${
                activeNivel === 'primaria' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Nivel Primaria
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveNivel('secundaria')}
            className={`flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center gap-2 transition-all ${
              activeNivel === 'secundaria' ? 'bg-maroon shadow-md' : 'hover:bg-gray-200'
            }`}
          >
            <Ionicons
              name="ribbon-outline"
              size={18}
              color={activeNivel === 'secundaria' ? '#FFFFFF' : '#4B5563'}
            />
            <Text
              className={`text-sm font-bold ${
                activeNivel === 'secundaria' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Nivel Secundaria
            </Text>
          </TouchableOpacity>
        </View>

        {onRefresh && (
          <TouchableOpacity
            onPress={onRefresh}
            className="flex-row items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 shadow-sm"
          >
            <Ionicons name="refresh" size={16} color="#801529" />
            <Text className="text-xs font-bold text-gray-800">Recargar</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Grid de Cursos (Filas y Columnas por Grado y Paralelos A / B) ── */}
      {gradosDelNivel.length === 0 ? (
        <View className="py-12 items-center justify-center bg-white rounded-2xl border border-gray-100 p-6">
          <Text className="text-sm text-gray-500">
            No hay cursos habilitados para el nivel {activeNivel === 'primaria' ? 'Primaria' : 'Secundaria'}.
          </Text>
        </View>
      ) : (
        <View className="gap-5">
          {gradosDelNivel.map((gradoStr) => {
            const cursosDelGrado = cursosDelNivelActivo
              .filter((c) => String(c.grado ?? '').trim() === gradoStr)
              .sort((a, b) => String(a.paralelo ?? '').localeCompare(String(b.paralelo ?? '')));

            return (
              <BentoCard key={gradoStr} className="p-5 bg-white border border-gray-100 shadow-sm">
                <View className="flex-row items-center justify-between mb-4 pb-2 border-b border-gray-100">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-8 h-8 rounded-lg bg-maroon/10 items-center justify-center">
                      <Ionicons name="layers" size={16} color="#801529" />
                    </View>
                    <Text className="text-base font-bold text-gray-900">
                      {gradoStr}° de {activeNivel === 'primaria' ? 'Primaria' : 'Secundaria'}
                    </Text>
                  </View>
                  <Text className="text-xs font-semibold text-gray-400">
                    {cursosDelGrado.length} {cursosDelGrado.length === 1 ? 'Paralelo' : 'Paralelos'}
                  </Text>
                </View>

                {/* Columnas de Paralelos */}
                <View className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                  {cursosDelGrado.map((curso) => {
                    const par = String(curso.paralelo ?? 'A').toUpperCase();

                    return (
                      <TouchableOpacity
                        key={String(curso.id)}
                        onPress={() => onSelect(String(curso.id))}
                        activeOpacity={0.7}
                        className="p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-maroon/40 hover:bg-white hover:shadow-md transition-all flex-col justify-between gap-3"
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="w-11 h-11 rounded-2xl bg-maroon items-center justify-center shadow-sm">
                            <Text className="text-white font-black text-lg">{par}</Text>
                          </View>
                          <View className="bg-maroon/10 px-2 py-0.5 rounded-md">
                            <Text className="text-[10px] font-bold text-maroon uppercase">
                              Paralelo {par}
                            </Text>
                          </View>
                        </View>

                        <View>
                          <Text className="text-base font-bold text-gray-900">
                            {gradoStr}° Paralelo "{par}"
                          </Text>
                          <Text className="text-xs text-gray-500 mt-0.5">
                            Nivel {activeNivel === 'primaria' ? 'Primaria' : 'Secundaria'}
                          </Text>
                        </View>

                        <View className="pt-2 border-t border-gray-200/60 flex-row items-center justify-between">
                          <Text className="text-[11px] text-gray-500 font-medium">
                            Cap: {curso.capacidadMaxima ?? 30} est.
                          </Text>
                          <View className="flex-row items-center gap-1">
                            <Text className="text-xs font-bold text-maroon">Ver seguimiento</Text>
                            <Ionicons name="arrow-forward" size={13} color="#801529" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </BentoCard>
            );
          })}
        </View>
      )}
    </View>
  );
}

