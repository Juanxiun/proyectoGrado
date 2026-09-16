import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { ContenidoEstudioSection } from '../components/ContenidoEstudioSection';
import { DeberesTareasSection } from '../components/DeberesTareasSection';
import { useResponsive } from '../../../utils/responsive';

interface MateriaInscrita {
  asignacionId: string;
  materiaId: string;
  materiaNombre: string;
  docenteNombre?: string;
  cursoLabel?: string;
}

export function EstudianteMateriasScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [materias, setMaterias] = useState<MateriaInscrita[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<MateriaInscrita | null>(null);

  // Dos pestañas estrictamente separadas: 'contenido' vs 'tareas'
  const [activeTab, setActiveTab] = useState<'contenido' | 'tareas'>('contenido');

  useEffect(() => {
    async function loadMateriasEstudiante() {
      try {
        setLoading(true);

        // 1. Obtener inscripcion del estudiante si no viene en user.cursoPeriodoId
        let cpId = user?.cursoPeriodoId;
        if (!cpId) {
          const inscRes = await academicServicesApi.list('inscripciones', {
            estudianteId: user?.estudianteId,
            limit: 5,
          });
          const activeInsc = (inscRes.data as any[]).find((i) => i.estado === 'activo') || inscRes.data[0];
          if (activeInsc) {
            cpId = String(activeInsc.cursoPeriodoId || activeInsc.cursoPeriodo?.id);
          }
        }

        // 2. Obtener materias asignadas a este curso
        const asigRes = await academicServicesApi.list('asignaciones', {
          cursoPeriodoId: cpId || undefined,
          limit: 100,
        });

        const list: MateriaInscrita[] = (asigRes.data as any[]).map((a) => {
          const doc = a.maestro
            ? `${a.maestro.nombre ?? ''} ${a.maestro.apellidoPaterno ?? ''}`.trim()
            : 'Docente';
          const curso = a.cursoPeriodo?.curso
            ? `${a.cursoPeriodo.curso.grado}° "${a.cursoPeriodo.curso.paralelo}"`
            : undefined;

          return {
            asignacionId: String(a.id),
            materiaId: String(a.materiaId || a.materia?.id || ''),
            materiaNombre: a.materia?.nombre || a.materiaNombre || 'Materia',
            docenteNombre: doc,
            cursoLabel: curso,
          };
        });

        setMaterias(list);
      } catch (err) {
        console.error('Error cargando materias del estudiante:', err);
      } finally {
        setLoading(false);
      }
    }

    loadMateriasEstudiante();
  }, [user?.id, user?.cursoPeriodoId]);

  return (
    <View className="flex-1 gap-4">
      {!selectedMateria ? (
        <>
          {/* Cabecera del Listado de Materias */}
          <BentoCard className="p-5">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-2xl font-bold text-gray-900">Mis Materias Inscritas</Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Accede a los recursos pedagógicos de estudio y a la entrega de tus deberes por asignatura.
                </Text>
              </View>
              <StatusBadge label={`${materias.length} Asignaturas`} variant="info" />
            </View>
          </BentoCard>

          {loading ? (
            <View className="py-12 items-center justify-center">
              <ActivityIndicator size="large" color="#801529" />
              <Text className="text-gray-500 text-sm mt-3 font-medium">
                Cargando tu plan de estudios actual...
              </Text>
            </View>
          ) : materias.length === 0 ? (
            <BentoCard className="p-8 items-center text-center">
              <Ionicons name="book-outline" size={48} color="#D1D5DB" />
              <Text className="text-lg font-bold text-gray-700 mt-3">
                No se encontraron materias registradas
              </Text>
              <Text className="text-xs text-gray-400 mt-1">
                Comunícate con la dirección académica si aún no tienes asignaturas matriculadas.
              </Text>
            </BentoCard>
          ) : (
            <View className={`gap-4 ${isMobile ? '' : 'flex-row flex-wrap'}`}>
              {materias.map((mat) => (
                <BentoCard
                  key={mat.asignacionId}
                  className={`p-5 ${isMobile ? 'w-full' : 'w-[48%]'}`}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="w-12 h-12 rounded-xl bg-maroon/10 items-center justify-center">
                        <Ionicons name="school" size={24} color="#801529" />
                      </View>
                      <View>
                        <Text className="text-lg font-bold text-gray-900">{mat.materiaNombre}</Text>
                        <Text className="text-xs text-gray-500 font-medium">
                          Prof. {mat.docenteNombre}
                        </Text>
                      </View>
                    </View>
                    <StatusBadge label="En curso" variant="success" />
                  </View>

                  <Text className="text-xs text-gray-400 mt-3">
                    {mat.cursoLabel ? `Curso: ${mat.cursoLabel}` : 'Período Activo'}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedMateria(mat);
                      setActiveTab('contenido');
                    }}
                    className="mt-5 bg-maroon rounded-xl py-2.5 px-4 flex-row items-center justify-center gap-2 shadow-sm"
                  >
                    <Ionicons name="enter-outline" size={18} color="#FFFFFF" />
                    <Text className="text-white text-xs font-bold">Ingresar a la Materia</Text>
                  </TouchableOpacity>
                </BentoCard>
              ))}
            </View>
          )}
        </>
      ) : (
        /* Vista de la Materia Seleccionada */
        <View className="flex-1 gap-4">
          {/* Barra Superior con Botón Volver y Pestañas */}
          <BentoCard className="p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => setSelectedMateria(null)}
                  className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center hover:bg-gray-200"
                >
                  <Ionicons name="arrow-back" size={20} color="#374151" />
                </TouchableOpacity>
                <View>
                  <Text className="text-2xl font-bold text-gray-900">
                    {selectedMateria.materiaNombre}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Docente: Prof. {selectedMateria.docenteNombre}
                  </Text>
                </View>
              </View>
              <StatusBadge label="Estudiante" variant="neutral" />
            </View>

            {/* SEPARACIÓN ESTRICTA DE SECCIONES (TABS) */}
            <View className="flex-row gap-3 mt-4 pt-4 border-t border-gray-100">
              <TouchableOpacity
                onPress={() => setActiveTab('contenido')}
                className={`flex-1 py-2.5 px-4 rounded-xl flex-row items-center justify-center gap-2 border ${
                  activeTab === 'contenido'
                    ? 'bg-maroon border-maroon'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Ionicons
                  name="library-outline"
                  size={18}
                  color={activeTab === 'contenido' ? '#FFFFFF' : '#4B5563'}
                />
                <Text
                  className={`text-sm font-bold ${
                    activeTab === 'contenido' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Contenido de Estudio
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('tareas')}
                className={`flex-1 py-2.5 px-4 rounded-xl flex-row items-center justify-center gap-2 border ${
                  activeTab === 'tareas'
                    ? 'bg-maroon border-maroon'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Ionicons
                  name="clipboard-outline"
                  size={18}
                  color={activeTab === 'tareas' ? '#FFFFFF' : '#4B5563'}
                />
                <Text
                  className={`text-sm font-bold ${
                    activeTab === 'tareas' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Deberes / Tareas
                </Text>
              </TouchableOpacity>
            </View>
          </BentoCard>

          {/* CARGA INDEPENDIENTE: Renderiza cada componente bajo demanda */}
          {activeTab === 'contenido' ? (
            <ContenidoEstudioSection
              asignacionId={selectedMateria.asignacionId}
              materiaNombre={selectedMateria.materiaNombre}
            />
          ) : (
            <DeberesTareasSection
              asignacionId={selectedMateria.asignacionId}
              materiaNombre={selectedMateria.materiaNombre}
            />
          )}
        </View>
      )}
    </View>
  );
}
