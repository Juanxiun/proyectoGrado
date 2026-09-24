import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { academicManagementApi, academicServicesApi, type EstadoGestion } from '../../../api/academicServices.api';
import { BirthDatePicker } from '../../usuarios/components/BirthDatePicker';
import { getFallbackGradient } from './CoverImagePicker';

interface GestionWizardModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (gestion: EstadoGestion) => void;
}

const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°'];

const dateString = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

function matchesBoliviaCurriculum(materiaName: string, nivel: 'primaria' | 'secundaria', grado: string): boolean {
  const name = materiaName.toLowerCase();
  const gNum = parseInt(grado) || 1;

  if (nivel === 'primaria') {
    if (name.includes('química') || name.includes('quimica') || name.includes('física') || name.includes('fisica') || name.includes('filosofía') || name.includes('filosofia')) {
      return false;
    }
    return true;
  }

  if (nivel === 'secundaria') {
    if ((name.includes('química') || name.includes('quimica') || name.includes('física') || name.includes('fisica')) && gNum < 3) {
      return false;
    }
    return true;
  }

  return true;
}

export function GestionWizardModal({ visible, onClose, onSuccess }: GestionWizardModalProps) {
  const currentYear = new Date().getFullYear();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [loadingStepText, setLoadingStepText] = useState('');

  // ── Paso 1: Configuración Base ──────────────────────────────────────────
  const [anio, setAnio] = useState(String(currentYear));
  const [nombre, setNombre] = useState(`Gestión Escolar ${currentYear}`);
  const [inicioGestion, setInicioGestion] = useState(dateString(currentYear, 2, 2));
  const [finGestion, setFinGestion] = useState(dateString(currentYear, 12, 18));
  const [inicio1, setInicio1] = useState(dateString(currentYear, 2, 2));
  const [fin1, setFin1] = useState(dateString(currentYear, 5, 29));
  const [inicio2, setInicio2] = useState(dateString(currentYear, 5, 30));
  const [fin2, setFin2] = useState(dateString(currentYear, 9, 18));
  const [inicio3, setInicio3] = useState(dateString(currentYear, 9, 19));
  const [fin3, setFin3] = useState(dateString(currentYear, 12, 18));
  const [turnoGeneral, setTurnoGeneral] = useState<'manana' | 'tarde'>('manana');
  const [montoCuota, setMontoCuota] = useState('350');

  // ── Paso 2: Cursos y Paralelos ──────────────────────────────────────────
  const [primariaGrados, setPrimariaGrados] = useState<Record<string, boolean>>({
    '1°': true, '2°': true, '3°': true, '4°': true, '5°': true, '6°': true,
  });
  const [secundariaGrados, setSecundariaGrados] = useState<Record<string, boolean>>({
    '1°': true, '2°': true, '3°': true, '4°': true, '5°': true, '6°': true,
  });
  const [paralelosPorGrado, setParalelosPorGrado] = useState<Record<string, number>>({
    primaria: 2, // A, B
    secundaria: 2, // A, B
  });
  const [capacidadPorCurso, setCapacidadPorCurso] = useState('30');

  // ── Paso 3: Asignación de Materias por Curso / Malla Bolivia ────────────
  const [materiasList, setMateriasList] = useState<Array<Record<string, any>>>([]);
  const [selectedNivelTab, setSelectedNivelTab] = useState<'primaria' | 'secundaria'>('primaria');
  const [selectedGradoTab, setSelectedGradoTab] = useState<string>('1°');
  // mallasPorCurso: key = `${nivel}:${grado}`, value = { [materiaId]: boolean }
  const [mallasPorCurso, setMallasPorCurso] = useState<Record<string, Record<string, boolean>>>({});

  const initMallasBolivia = (list: Array<Record<string, any>>) => {
    const initialMap: Record<string, Record<string, boolean>> = {};
    ['primaria', 'secundaria'].forEach((nivel) => {
      GRADOS.forEach((grado) => {
        const key = `${nivel}:${grado}`;
        initialMap[key] = {};
        list.forEach((m) => {
          initialMap[key][String(m.id)] = matchesBoliviaCurriculum(m.nombre, nivel as any, grado);
        });
      });
    });
    setMallasPorCurso(initialMap);
  };

  useEffect(() => {
    if (visible) {
      setStep(1);
      academicServicesApi.list('materias', { activo: 'true', limit: 100 })
        .then((res) => {
          const list = (res.data ?? []) as Array<Record<string, any>>;
          setMateriasList(list);
          initMallasBolivia(list);
        })
        .catch(() => undefined);
    }
  }, [visible]);

  // Validaciones de paso 1
  const validateStep1 = () => {
    if (!anio || !nombre.trim()) {
      Alert.alert('Datos incompletos', 'Ingrese el año y nombre de la gestión.');
      return false;
    }
    if (!inicioGestion || !finGestion || finGestion <= inicioGestion) {
      Alert.alert('Fechas inválidas', 'La fecha final de gestión debe ser posterior a la de inicio.');
      return false;
    }
    if (!inicio1 || !fin1 || !inicio2 || !fin2 || !inicio3 || !fin3) {
      Alert.alert('Trimestres incompletos', 'Defina las fechas de inicio y fin para los 3 trimestres.');
      return false;
    }
    if (!montoCuota || Number(montoCuota) <= 0) {
      Alert.alert('Monto de cuota requerido', 'Defina el monto mensual de cuota para el plan de pagos.');
      return false;
    }
    return true;
  };

  // Validaciones de paso 2
  const validateStep2 = () => {
    const hasPrimaria = Object.values(primariaGrados).some(Boolean);
    const hasSecundaria = Object.values(secundariaGrados).some(Boolean);
    if (!hasPrimaria && !hasSecundaria) {
      Alert.alert('Cursos requeridos', 'Seleccione al menos un grado para Primaria o Secundaria.');
      return false;
    }
    const cap = Number(capacidadPorCurso);
    if (!cap || cap < 5 || cap > 60) {
      Alert.alert('Capacidad inválida', 'La capacidad por curso debe ser entre 5 y 60 alumnos.');
      return false;
    }

    // Asegurar que el grado seleccionado en el paso 3 pertenezca a los habilitados
    if (hasPrimaria) {
      setSelectedNivelTab('primaria');
      const firstPri = Object.keys(primariaGrados).find((g) => primariaGrados[g]) || '1°';
      setSelectedGradoTab(firstPri);
    } else {
      setSelectedNivelTab('secundaria');
      const firstSec = Object.keys(secundariaGrados).find((g) => secundariaGrados[g]) || '1°';
      setSelectedGradoTab(firstSec);
    }
    return true;
  };

  // Validaciones de paso 3 y Finalización
  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      // 1. Crear Gestión Base
      setLoadingStepText('1/4 Registrando gestión base y trimestres...');
      const periodoRes = await academicManagementApi.create({
        anio: Number(anio),
        nombre: nombre.trim(),
        inicioGestion,
        finGestion,
        trimestres: [
          { numero: 1, inicio: inicio1, fin: fin1 },
          { numero: 2, inicio: inicio2, fin: fin2 },
          { numero: 3, inicio: inicio3, fin: fin3 },
        ],
      });
      const periodoId = String((periodoRes as { id?: string }).id ?? '');

      // 2. Construir niveles, cursos y mallas curriculares diferenciadas por curso
      setLoadingStepText('2/4 Configurando cursos, paralelos y malla curricular Bolivia...');
      const mallasCurriculares: Array<Record<string, any>> = [];
      const nivelesInput: Array<{ nivel: string; grados: string[]; paralelos: Record<string, number> }> = [];

      const activePrimariaGrados = Object.keys(primariaGrados).filter((g) => primariaGrados[g]);
      if (activePrimariaGrados.length > 0) {
        const paralelosMap: Record<string, number> = {};
        activePrimariaGrados.forEach((g) => { paralelosMap[g] = paralelosPorGrado.primaria || 1; });
        nivelesInput.push({
          nivel: 'primaria',
          grados: activePrimariaGrados,
          paralelos: paralelosMap,
        });

        // Asignar materias marcadas para cada grado de primaria
        activePrimariaGrados.forEach((grado) => {
          const key = `primaria:${grado}`;
          const gradeMateriaMap = mallasPorCurso[key] || {};
          materiasList
            .filter((m) => gradeMateriaMap[String(m.id)])
            .forEach((mat) => {
              mallasCurriculares.push({
                nivel: 'primaria',
                grado,
                materiaId: String(mat.id),
                tipoMateria: mat.tipoMateria ?? 'principal',
                cargaHorariaSemanal: mat.cargaHorariaSemanal ?? 5,
                pesoSintactico: mat.pesoSintactico ?? (mat.tipoMateria === 'extracurricular' ? 1 : 3),
              });
            });
        });
      }

      const activeSecundariaGrados = Object.keys(secundariaGrados).filter((g) => secundariaGrados[g]);
      if (activeSecundariaGrados.length > 0) {
        const paralelosMap: Record<string, number> = {};
        activeSecundariaGrados.forEach((g) => { paralelosMap[g] = paralelosPorGrado.secundaria || 1; });
        nivelesInput.push({
          nivel: 'secundaria',
          grados: activeSecundariaGrados,
          paralelos: paralelosMap,
        });

        // Asignar materias marcadas para cada grado de secundaria
        activeSecundariaGrados.forEach((grado) => {
          const key = `secundaria:${grado}`;
          const gradeMateriaMap = mallasPorCurso[key] || {};
          materiasList
            .filter((m) => gradeMateriaMap[String(m.id)])
            .forEach((mat) => {
              mallasCurriculares.push({
                nivel: 'secundaria',
                grado,
                materiaId: String(mat.id),
                tipoMateria: mat.tipoMateria ?? 'principal',
                cargaHorariaSemanal: mat.cargaHorariaSemanal ?? 5,
                pesoSintactico: mat.pesoSintactico ?? (mat.tipoMateria === 'extracurricular' ? 1 : 3),
              });
            });
        });
      }

      const structureState = await academicManagementApi.generateStructure(periodoId, {
        niveles: nivelesInput,
        capacidadMaxima: Number(capacidadPorCurso),
        turnoPorNivel: { primaria: turnoGeneral, secundaria: turnoGeneral },
        mallasCurriculares,
      });

      // 3. Generar Plan de Pagos Mensual
      setLoadingStepText('3/4 Creando plan de pagos institucionales...');
      await academicManagementApi.generatePaymentPlan(periodoId, {
        montosPorNivel: {
          primaria: Number(montoCuota),
          secundaria: Number(montoCuota),
        },
        diaVencimiento: 10,
      });

      // 4. Entregar la gestión al constructor de horarios.
      setLoadingStepText('4/4 Redirigiendo a construcción de horarios...');
      Alert.alert(
        '¡Gestión Configurada con Éxito!',
        `La gestión "${nombre}" y sus mallas curriculares quedaron creadas. A continuación acomodará las materias y docentes en los horarios.`,
      );
      onSuccess(structureState);
      onClose();
    } catch (error) {
      Alert.alert(
        'Error en el registro de la gestión',
        error instanceof Error ? error.message : 'Revise la información ingresada.',
      );
    } finally {
      setLoading(false);
      setLoadingStepText('');
    }
  };

  const currentMallaKey = `${selectedNivelTab}:${selectedGradoTab}`;
  const currentMalla = mallasPorCurso[currentMallaKey] ?? {};
  const toggleMateria = (materiaId: string) => {
    setMallasPorCurso((prev) => ({
      ...prev,
      [currentMallaKey]: {
        ...(prev[currentMallaKey] ?? {}),
        [materiaId]: !prev[currentMallaKey]?.[materiaId],
      },
    }));
  };
  const resetMalla = () => {
    setMallasPorCurso((prev) => ({
      ...prev,
      [currentMallaKey]: Object.fromEntries(
        materiasList.map((materia) => [String(materia.id), matchesBoliviaCurriculum(materia.nombre, selectedNivelTab, selectedGradoTab)]),
      ),
    }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
        <View className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex-col">
          {/* Header */}
          <View className="p-5 bg-maroon flex-row items-center justify-between">
            <View className="flex-1 mr-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="sparkles" size={20} color="#FFFFFF" />
                <Text className="text-lg font-bold text-white">
                  Asistente de Configuración de Gestión Escolar
                </Text>
              </View>
              <Text className="text-xs text-white/80 mt-0.5">
                Paso {step} de 3 · Siga los pasos para inicializar la nueva gestión.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={loading}
              className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Stepper Indicator */}
          <View className="flex-row border-b border-gray-200 bg-gray-50 px-5 py-3">
            {[
              { num: 1, label: '1. Configuración Base' },
              { num: 2, label: '2. Cursos y Paralelos' },
              { num: 3, label: '3. Asignación de Materias' },
            ].map((s) => (
              <View key={s.num} className="flex-1 items-center flex-row justify-center gap-1.5">
                <View
                  className={`w-6 h-6 rounded-full items-center justify-center ${
                    step === s.num ? 'bg-maroon' : step > s.num ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  {step > s.num ? (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  ) : (
                    <Text className="text-white text-xs font-bold">{s.num}</Text>
                  )}
                </View>
                <Text
                  className={`text-xs ${
                    step === s.num ? 'font-bold text-maroon' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Body */}
          <ScrollView className="p-5 max-h-[65vh]" contentContainerStyle={{ gap: 16 }}>
            {loading ? (
              <View className="py-16 items-center justify-center">
                <ActivityIndicator color="#801529" size="large" />
                <Text className="text-sm font-bold text-gray-800 mt-4">{loadingStepText}</Text>
                <Text className="text-xs text-gray-500 mt-1">Procesando estructura institucional...</Text>
              </View>
            ) : (
              <>
                {/* ── PASO 1: CONFIGURACIÓN BASE ── */}
                {step === 1 && (
                  <View className="gap-4">
                    <View className="bg-maroon/5 border border-maroon/20 p-3.5 rounded-2xl">
                      <Text className="text-xs font-bold text-maroon uppercase mb-1">
                        Fechas de la Gestión Escolar
                      </Text>
                      <Text className="text-xs text-gray-600">
                        Defina el año lectivo, el nombre identificativo y el período general de clases.
                      </Text>
                    </View>

                    <View className="flex-row flex-wrap gap-3">
                      <View className="flex-1 min-w-[140px]">
                        <Text className="text-xs font-semibold text-gray-700 mb-1">Año Lectivo *</Text>
                        <TextInput
                          value={anio}
                          onChangeText={(v) => setAnio(v.replace(/[^0-9]/g, ''))}
                          keyboardType="numeric"
                          placeholder="2026"
                          className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 font-bold"
                        />
                      </View>
                      <View className="flex-[2] min-w-[200px]">
                        <Text className="text-xs font-semibold text-gray-700 mb-1">Nombre de la Gestión *</Text>
                        <TextInput
                          value={nombre}
                          onChangeText={setNombre}
                          placeholder="Gestión Escolar 2026"
                          className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800"
                        />
                      </View>
                    </View>

                    <View className="flex-row flex-wrap gap-3">
                      <View className="flex-1 min-w-[160px]">
                        <Text className="text-xs font-semibold text-gray-700 mb-1">Inicio de Gestión *</Text>
                        <BirthDatePicker
                          value={inicioGestion}
                          onChange={setInicioGestion}
                          placeholder="Inicio de gestión"
                          minYear={2020}
                          maxYear={2040}
                        />
                      </View>
                      <View className="flex-1 min-w-[160px]">
                        <Text className="text-xs font-semibold text-gray-700 mb-1">Fin de Gestión *</Text>
                        <BirthDatePicker
                          value={finGestion}
                          onChange={setFinGestion}
                          placeholder="Fin de gestión"
                          minYear={2020}
                          maxYear={2040}
                        />
                      </View>
                    </View>

                    {/* 3 Trimestres */}
                    <Text className="text-xs font-bold text-gray-800 uppercase mt-2">
                      Límites de los Tres Trimestres
                    </Text>
                    <View className="gap-2.5">
                      {[
                        { num: 1, label: '1er Trimestre', start: inicio1, end: fin1, setStart: setInicio1, setEnd: setFin1 },
                        { num: 2, label: '2do Trimestre', start: inicio2, end: fin2, setStart: setInicio2, setEnd: setFin2 },
                        { num: 3, label: '3er Trimestre', start: inicio3, end: fin3, setStart: setInicio3, setEnd: setFin3 },
                      ].map((t) => (
                        <View key={t.num} className="bg-gray-50 border border-gray-200 p-3 rounded-2xl flex-row items-center gap-3 flex-wrap">
                          <View className="w-28 flex-row items-center gap-1.5">
                            <View className="w-5 h-5 rounded-full bg-maroon/10 items-center justify-center">
                              <Text className="text-[11px] font-bold text-maroon">{t.num}</Text>
                            </View>
                            <Text className="text-xs font-bold text-gray-800">{t.label}</Text>
                          </View>
                          <View className="flex-1 min-w-[130px]">
                            <BirthDatePicker
                              value={t.start}
                              onChange={t.setStart}
                              placeholder={`Inicio ${t.label}`}
                              minYear={2020}
                              maxYear={2040}
                            />
                          </View>
                          <Text className="text-gray-400 text-xs">→</Text>
                          <View className="flex-1 min-w-[130px]">
                            <BirthDatePicker
                              value={t.end}
                              onChange={t.setEnd}
                              placeholder={`Fin ${t.label}`}
                              minYear={2020}
                              maxYear={2040}
                            />
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* Turno y Plan de Pagos */}
                    <View className="flex-row flex-wrap gap-3 mt-2">
                      <View className="flex-1 min-w-[160px]">
                        <Text className="text-xs font-semibold text-gray-700 mb-1">Turno General *</Text>
                        <View className="flex-row gap-2">
                          {(['manana', 'tarde'] as const).map((tur) => (
                            <TouchableOpacity
                              key={tur}
                              onPress={() => setTurnoGeneral(tur)}
                              className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${
                                turnoGeneral === tur ? 'bg-maroon border-maroon' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <Text className={`text-xs font-bold ${turnoGeneral === tur ? 'text-white' : 'text-gray-700'}`}>
                                {tur === 'manana' ? 'Mañana' : 'Tarde'}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View className="flex-1 min-w-[160px]">
                        <Text className="text-xs font-semibold text-gray-700 mb-1">Monto de Cuota Mensual (Bs) *</Text>
                        <TextInput
                          value={montoCuota}
                          onChangeText={(v) => setMontoCuota(v.replace(/[^0-9.]/g, ''))}
                          keyboardType="numeric"
                          placeholder="350"
                          className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 font-bold"
                        />
                      </View>
                    </View>
                  </View>
                )}

                {/* ── PASO 2: CURSOS Y PARALELOS ── */}
                {step === 2 && (
                  <View className="gap-4">
                    <View className="bg-maroon/5 border border-maroon/20 p-3.5 rounded-2xl">
                      <Text className="text-xs font-bold text-maroon uppercase mb-1">Configuración de Grados y Paralelos</Text>
                      <Text className="text-xs text-gray-600">Seleccione los grados de Primaria y Secundaria y la cantidad de paralelos de cada grado.</Text>
                    </View>

                    {(['primaria', 'secundaria'] as const).map((nivel) => {
                      const grades = nivel === 'primaria' ? primariaGrados : secundariaGrados;
                      const label = nivel === 'primaria' ? 'Primaria' : 'Secundaria';
                      const color = nivel === 'primaria' ? 'emerald' : 'indigo';
                      return (
                        <View key={nivel} className="bg-gray-50 border border-gray-200 p-4 rounded-2xl gap-3">
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                              <Ionicons name={nivel === 'primaria' ? 'school' : 'library'} size={18} color={nivel === 'primaria' ? '#047857' : '#4338CA'} />
                              <Text className="text-sm font-bold text-gray-800">Nivel {label}</Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                              <Text className="text-xs text-gray-600">Paralelos:</Text>
                              {[1, 2, 3].map((count) => (
                                <TouchableOpacity
                                  key={count}
                                  onPress={() => setParalelosPorGrado((prev) => ({ ...prev, [nivel]: count }))}
                                  className={`px-2.5 py-1.5 rounded-lg border ${paralelosPorGrado[nivel] === count ? `bg-${color}-700 border-${color}-700` : 'bg-white border-gray-300'}`}
                                >
                                  <Text className={`text-xs font-bold ${paralelosPorGrado[nivel] === count ? 'text-white' : 'text-gray-700'}`}>
                                    {count === 1 ? 'A' : count === 2 ? 'A, B' : 'A, B, C'}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                          <View className="flex-row flex-wrap gap-2">
                            {GRADOS.map((grado) => {
                              const active = grades[grado];
                              return (
                                <TouchableOpacity
                                  key={grado}
                                  onPress={() => {
                                    if (nivel === 'primaria') setPrimariaGrados((prev) => ({ ...prev, [grado]: !prev[grado] }));
                                    else setSecundariaGrados((prev) => ({ ...prev, [grado]: !prev[grado] }));
                                  }}
                                  className={`flex-1 min-w-[75px] py-2 px-3 rounded-xl border items-center ${active ? `bg-${color}-50 border-${color}-600` : 'bg-white border-gray-200 opacity-60'}`}
                                >
                                  <Text className={`text-xs font-bold ${active ? `text-${color}-900` : 'text-gray-400'}`}>{grado} {label === 'Primaria' ? 'Prim.' : 'Sec.'}</Text>
                                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={active ? (nivel === 'primaria' ? '#047857' : '#4338CA') : '#9CA3AF'} className="mt-1" />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}

                    <View className="bg-gray-50 border border-gray-200 p-3.5 rounded-2xl">
                      <Text className="text-xs font-bold text-gray-800">Capacidad máxima por curso</Text>
                      <Text className="text-[11px] text-gray-500 mb-2">Se aplicará a cada paralelo generado.</Text>
                      <TextInput
                        value={capacidadPorCurso}
                        onChangeText={(value) => setCapacidadPorCurso(value.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="30"
                        className="bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-800 font-bold w-28"
                      />
                    </View>
                  </View>
                )}

                {/* ── PASO 3: ASIGNACIÓN DE MATERIAS POR CURSO ── */}
                {step === 3 && (
                  <View className="gap-4">
                    <View className="bg-maroon/5 border border-maroon/20 p-3.5 rounded-2xl">
                      <View className="flex-row items-center gap-2 mb-1">
                        <Ionicons name="school-outline" size={18} color="#801529" />
                        <Text className="text-xs font-bold text-maroon uppercase">Malla curricular del curso</Text>
                      </View>
                      <Text className="text-xs text-gray-600">Seleccione las materias que se impartirán en el grado elegido. La asignación docente se realizará en Construcción de horarios.</Text>
                    </View>

                    <View className="flex-row rounded-2xl bg-gray-100 p-1.5 gap-2">
                      {(['primaria', 'secundaria'] as const).map((nivel) => {
                        const label = nivel === 'primaria' ? 'Primaria (1° a 6°)' : 'Secundaria (1° a 6°)';
                        const active = selectedNivelTab === nivel;
                        return (
                          <TouchableOpacity
                            key={nivel}
                            onPress={() => {
                              setSelectedNivelTab(nivel);
                              const first = nivel === 'primaria' ? Object.keys(primariaGrados).find((grado) => primariaGrados[grado]) : Object.keys(secundariaGrados).find((grado) => secundariaGrados[grado]);
                              if (first) setSelectedGradoTab(first);
                            }}
                            className={`flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-2 ${active ? (nivel === 'primaria' ? 'bg-emerald-700 shadow-sm' : 'bg-indigo-700 shadow-sm') : 'bg-transparent'}`}
                          >
                            <Ionicons name={nivel === 'primaria' ? 'school' : 'library'} size={16} color={active ? '#FFFFFF' : '#374151'} />
                            <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-700'}`}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-2 py-1">
                        {GRADOS.filter((grado) => selectedNivelTab === 'primaria' ? primariaGrados[grado] : secundariaGrados[grado]).map((grado) => {
                          const active = selectedGradoTab === grado;
                          return (
                            <TouchableOpacity
                              key={grado}
                              onPress={() => setSelectedGradoTab(grado)}
                              className={`px-4 py-2 rounded-xl border ${active ? (selectedNivelTab === 'primaria' ? 'bg-emerald-700 border-emerald-700' : 'bg-indigo-700 border-indigo-700') : 'bg-white border-gray-200'}`}
                            >
                              <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-800'}`}>{grado} {selectedNivelTab === 'primaria' ? 'Primaria' : 'Secundaria'}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>

                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-xs font-bold text-gray-800">Materias de {selectedGradoTab} · {selectedNivelTab === 'primaria' ? 'Primaria' : 'Secundaria'}</Text>
                        <Text className="text-[11px] text-gray-500">Las materias se guardarán en la malla del curso.</Text>
                      </View>
                      <TouchableOpacity onPress={resetMalla} className="px-2.5 py-1.5 bg-gray-100 rounded-lg flex-row items-center gap-1">
                        <Ionicons name="refresh-outline" size={14} color="#374151" />
                        <Text className="text-[11px] font-bold text-gray-700">Sugerencia Bolivia</Text>
                      </TouchableOpacity>
                    </View>

                    <View className="gap-2">
                      {materiasList.length === 0 ? (
                        <Text className="text-xs text-gray-400 italic py-4 text-center">No hay materias activas registradas.</Text>
                      ) : materiasList.map((materia) => {
                        const id = String(materia.id);
                        const active = Boolean(currentMalla[id]);
                        const fallback = getFallbackGradient(materia.nombre);
                        return (
                          <TouchableOpacity
                            key={id}
                            onPress={() => toggleMateria(id)}
                            className={`p-3 rounded-2xl border flex-row items-center justify-between ${active ? 'bg-maroon/5 border-maroon/300' : 'bg-gray-50 border-gray-200 opacity-60'}`}
                          >
                            <View className="flex-row items-center gap-3 flex-1 mr-2">
                              <View className={`w-8 h-8 rounded-xl ${fallback.bg} items-center justify-center`}>
                                <Ionicons name={fallback.icon} size={16} color="#FFFFFF" />
                              </View>
                              <View className="flex-1">
                                <Text className="text-xs font-bold text-gray-900" numberOfLines={1}>{materia.nombre}</Text>
                                <Text className="text-[11px] text-gray-500 mt-0.5">{materia.codigo} · {materia.cargaHorariaSemanal ?? 5} hrs/sem</Text>
                              </View>
                            </View>
                            <Ionicons name={active ? 'checkbox' : 'square-outline'} size={20} color={active ? '#801529' : '#9CA3AF'} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
          {/* Footer Buttons */}
          {!loading && (
            <View className="p-4 border-t border-gray-200 bg-gray-50 flex-row items-center justify-between gap-3">
              {step > 1 ? (
                <TouchableOpacity
                  onPress={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                  className="px-4 py-2.5 bg-gray-200 rounded-xl flex-row items-center gap-1.5"
                >
                  <Ionicons name="arrow-back" size={16} color="#374151" />
                  <Text className="text-xs font-bold text-gray-700">Anterior</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}

              {step < 3 ? (
                <TouchableOpacity
                  onPress={() => {
                    if (step === 1 && validateStep1()) setStep(2);
                    else if (step === 2 && validateStep2()) setStep(3);
                  }}
                  className="px-5 py-2.5 bg-maroon rounded-xl flex-row items-center gap-1.5"
                >
                  <Text className="text-xs font-bold text-white">Siguiente</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleFinalSubmit}
                  className="px-6 py-2.5 bg-emerald-700 rounded-xl flex-row items-center gap-2 shadow"
                >
                  <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white uppercase tracking-wide">
                    Guardar configuración
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
