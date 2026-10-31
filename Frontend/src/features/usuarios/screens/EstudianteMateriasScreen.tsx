import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ContenidoEstudioSection } from '../components/ContenidoEstudioSection';
import { DeberesTareasSection } from '../components/DeberesTareasSection';
import { useResponsive } from '../../../utils/responsive';

interface MateriaInscrita {
  asignacionId: string;
  cursoPeriodoId: string;
  materiaId: string;
  materiaNombre: string;
  nivel?: 'primaria' | 'secundaria';
  grado?: string;
  docenteNombre?: string;
  cursoLabel?: string;
}

export function EstudianteMateriasScreen() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [materias, setMaterias] = useState<MateriaInscrita[]>([]);
  const [selectedMateria, setSelectedMateria] = useState<MateriaInscrita | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // Dos pestañas estrictamente separadas: 'contenido' vs 'tareas'
  const [activeTab, setActiveTab] = useState<'contenido' | 'tareas'>('contenido');
  const materiasFiltradas = materias.filter((materia) => `${materia.materiaNombre} ${materia.docenteNombre ?? ''}`.toLowerCase().includes(busqueda.toLowerCase()));

  useEffect(() => {
    async function loadMateriasEstudiante() {
      try {
        setLoading(true);

        // 1. Obtener inscripcion del estudiante si no viene en user.cursoPeriodoId
        let cpId = user?.cursoPeriodoId;
        if (!cpId) {
          const inscRes = await academicServicesApi.list('inscripciones', {
            estudianteId: user?.estudianteId,
            limit: 100,
          });
          const inscriptions = (inscRes.data as any[]).filter((i) => i.estado === 'activo');
          const activeInsc = inscriptions.find((i) => i.cursoPeriodo?.periodo?.activo)
            ?? inscriptions.sort((a, b) => Number(b.cursoPeriodo?.periodo?.anio ?? 0) - Number(a.cursoPeriodo?.periodo?.anio ?? 0))[0];
          if (activeInsc) {
            cpId = String(activeInsc.cursoPeriodoId || activeInsc.cursoPeriodo?.id);
          }
        }

        if (!cpId) {
          setMaterias([]);
          return;
        }

        // 2. Obtener materias asignadas a este curso
        const asigRes = await academicServicesApi.list('asignaciones', {
          cursoPeriodoId: cpId,
          estado: 'activo',
          limit: 100,
        });

        const latestActive = new Map<string, any>();
        for (const assignment of (asigRes.data as any[])
          .filter((a) => a.estado === 'activo')
          .sort((a, b) => Date.parse(b.fechaAsignacion ?? '') - Date.parse(a.fechaAsignacion ?? ''))) {
          const coursePeriodId = String(assignment.cursoPeriodoId || assignment.cursoPeriodo?.id || cpId);
          const subjectId = String(assignment.materiaId || assignment.materia?.id || '');
          if (subjectId && !latestActive.has(`${coursePeriodId}:${subjectId}`)) {
            latestActive.set(`${coursePeriodId}:${subjectId}`, assignment);
          }
        }

        const list: MateriaInscrita[] = [...latestActive.values()].map((a) => {
          const doc = a.maestro
            ? `${a.maestro.nombre ?? ''} ${a.maestro.apellidoPaterno ?? ''}`.trim()
            : 'Docente';
          const curso = a.cursoPeriodo?.curso
            ? `${a.cursoPeriodo.curso.grado}° "${a.cursoPeriodo.curso.paralelo}"`
            : undefined;
          const cursoNivel = String(a.cursoPeriodo?.curso?.nivel ?? '').toLowerCase();

          return {
            asignacionId: String(a.id),
            cursoPeriodoId: String(a.cursoPeriodoId || a.cursoPeriodo?.id || cpId),
            materiaId: String(a.materiaId || a.materia?.id || ''),
            materiaNombre: a.materia?.nombre || a.materiaNombre || 'Materia',
            nivel: cursoNivel.includes('primaria') ? 'primaria' : cursoNivel.includes('secundaria') ? 'secundaria' : undefined,
            grado: a.cursoPeriodo?.curso?.grado ? String(a.cursoPeriodo.curso.grado) : undefined,
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
  }, [user?.id, user?.estudianteId, user?.cursoPeriodoId]);

  return (
    <View className="flex-1 gap-4">
      {!selectedMateria ? (
        <>
          <View className="gap-3">
            <View className="flex-row items-center gap-2 bg-[#FBF5EC] rounded-2xl border border-[#EFE6DB] px-4 py-3">
              <Ionicons name="search-outline" size={19} color="#6B7280" />
              <TextInput value={busqueda} onChangeText={setBusqueda} placeholder="Buscar materia o profesor..." placeholderTextColor="#7B7B80" className="flex-1 text-sm text-gray-800" />
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 bg-[#801F3F] rounded-2xl p-3.5"><Text className="text-white/80 text-[9px] font-bold">MATERIAS ACTIVAS</Text><Text className="text-white text-xl font-black mt-1">{materias.length}</Text></View>
              <View className="flex-1 bg-[#F3D9B7] rounded-2xl p-3.5"><Text className="text-[#9C5367] text-[9px] font-bold">CICLO ACTUAL</Text><Text className="text-[#801F3F] text-base font-black mt-1">En curso</Text></View>
            </View>
            <View className="flex-row items-center justify-between px-1 mt-1"><Text className="text-[#801F3F] text-lg font-bold">Mis Materias</Text><Ionicons name="options-outline" size={18} color="#801F3F" /></View>
          </View>

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
            <View className={`gap-3 ${isMobile ? '' : 'flex-row flex-wrap'}`}>
              {materiasFiltradas.map((mat, index) => (
                <BentoCard
                  key={mat.asignacionId}
                  className={`p-4 ${isMobile ? 'w-full bg-[#FBF5EC] border border-[#EFE6DB] rounded-2xl' : 'w-[48%]'}`}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className={`w-12 h-12 rounded-2xl items-center justify-center ${index % 2 ? 'bg-[#A94E6D]' : 'bg-[#801F3F]'}`}>
                        <Ionicons name={index % 2 ? 'school-outline' : 'book-outline'} size={23} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text className="text-sm font-extrabold uppercase text-[#801F3F]">{mat.materiaNombre}</Text>
                        <Text className="text-xs text-gray-500 mt-1 font-medium">
                          Prof. {mat.docenteNombre}
                        </Text>
                      </View>
                    </View>
                    <View className="px-2 py-1 rounded-full bg-[#F3D9B7]"><Text className="text-[#801F3F] text-[9px] font-bold">EN CURSO</Text></View>
                  </View>

                  <Text className="text-xs text-gray-500 mt-3">
                    {mat.cursoLabel ? `Curso: ${mat.cursoLabel}` : 'Período Activo'}
                  </Text>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedMateria(mat);
                      setActiveTab('contenido');
                    }}
                    className="mt-4 bg-white rounded-xl py-2.5 px-3 flex-row items-center justify-between border border-gray-200"
                  >
                    <Text className="text-[#801F3F] text-xs font-bold">Ver materia</Text>
                    <Ionicons name="chevron-forward" size={17} color="#801F3F" />
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
                  Encargos y tareas
                </Text>
              </TouchableOpacity>
            </View>
          </BentoCard>

          {/* CARGA INDEPENDIENTE: Renderiza cada componente bajo demanda */}
          {activeTab === 'contenido' ? (
            <ContenidoEstudioSection
              asignacionId={selectedMateria.asignacionId}
              nivel={selectedMateria.nivel}
              grado={selectedMateria.grado}
              materiaId={selectedMateria.materiaId}
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
