import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import {
  gamificacionApi,
  type RankingParalelo,
  type RecompensaTienda,
  type ResumenGamificacion,
} from '../../../api/gamificacion.api';
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { KpiCard } from '../../../displays/components/KpiCard';
import { useResponsive } from '../../../utils/responsive';

// Insignias del sistema gamificado
const INSIGNIAS_CATALOGO = [
  {
    codigo: 'speedrun',
    nombre: 'Speedrun',
    descripcion: 'Completar actividades en tiempo récord con alta precisión.',
    icono: 'flash' as const,
    color: '#F59E0B',
  },
  {
    codigo: 'aprendiendo_nuevas_cosas',
    nombre: 'Nuevos Horizontes',
    descripcion: 'Explorar y repasar contenido didáctico nuevo de la semana.',
    icono: 'planet' as const,
    color: '#3B82F6',
  },
  {
    codigo: 'repaso_masivo',
    nombre: 'Repaso Masivo',
    descripcion: 'Superar la marca límite de aprendizaje diario.',
    icono: 'rocket' as const,
    color: '#8B5CF6',
  },
  {
    codigo: 'volver_donde_empece',
    nombre: 'Volver Donde Empecé',
    descripcion: 'Reincorporarse al estudio tras un período inactivo.',
    icono: 'refresh' as const,
    color: '#10B981',
  },
];

// Trofeos especiales
const TROFEOS_CATALOGO = [
  {
    codigo: 'mejor_semana',
    nombre: 'Mejor de la Semana',
    descripcion: 'Máximo rendimiento y calidad en actividades semanales.',
    icono: 'trophy' as const,
    color: '#F59E0B',
  },
  {
    codigo: 'alto_rendimiento_trimestre',
    nombre: 'Alto Rendimiento',
    descripcion: 'Consistencia académica superior durante el trimestre.',
    icono: 'ribbon' as const,
    color: '#801529',
  },
  {
    codigo: 'dominio_total',
    nombre: 'Dominio Total',
    descripcion: 'Aciertos perfectos en todas las modalidades interactivas.',
    icono: 'shield-checkmark' as const,
    color: '#059669',
  },
];

export function EstudianteDashboardScreen({ onNavigate }: { onNavigate?: (route: string) => void }) {
  const { user } = useAuth();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [resumen, setResumen] = useState<ResumenGamificacion | null>(null);
  const [rankings, setRankings] = useState<RankingParalelo[]>([]);
  const [selectedParalelo, setSelectedParalelo] = useState<'A' | 'B'>('A');

  // Modal de recompensas
  const [tiendaModalOpen, setTiendaModalOpen] = useState(false);
  const [recompensas, setRecompensas] = useState<RecompensaTienda[]>([]);
  const [comprando, setComprando] = useState(false);

  const cursoPeriodoId = user?.cursoPeriodoId || '1';

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resumenData, rankingData] = await Promise.allSettled([
        gamificacionApi.getResumen(),
        gamificacionApi.getRanking(cursoPeriodoId),
      ]);

      if (resumenData.status === 'fulfilled') {
        setResumen(resumenData.value);
      } else {
        // Fallback default mockup
        setResumen({
          racha: {
            id: '1',
            usuarioId: user?.id || '1',
            fecha: new Date().toISOString().slice(0, 10),
            completada: true,
            aciertos: 9,
            totalPreguntas: 10,
            porcentajeAcierto: 0.9,
            rachaActual: 6,
            mejorRacha: 12,
            salvadaConPuntos: false,
            puntosGastados: 0,
            creadaEn: '',
            actualizadaEn: '',
          },
          puntosIndividuales: 185,
          puntosGlobales: 14,
          insignias: [],
          trofeos: [],
          ranking: null,
        });
      }

      if (rankingData.status === 'fulfilled') {
        setRankings(rankingData.value);
      }
    } catch (e) {
      console.error('Error cargando gamificacion:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [cursoPeriodoId]);

  const handleOpenTienda = async () => {
    try {
      setTiendaModalOpen(true);
      const items = await gamificacionApi.getTienda();
      setRecompensas(items);
    } catch {
      // Mock tienda si el endpoint está en frío
      setRecompensas([
        {
          id: '1',
          nombre: 'Pista para Examen',
          descripcion: 'Recibe una pista explicativa durante tu evaluación en línea.',
          costoPuntosIndividuales: 95,
          tipo: 'pista_examen',
          stock: null,
          activa: true,
        },
        {
          id: '2',
          nombre: 'Salvar Racha Diaria',
          descripcion: 'Recupera tu racha si un día tuviste menos del 90% de aciertos.',
          costoPuntosIndividuales: 100,
          tipo: 'salvar_racha',
          stock: null,
          activa: true,
        },
        {
          id: '3',
          nombre: 'Insignia Cosmética Especial',
          descripcion: 'Borde dorado exclusivo para tu avatar en la tabla de ranking.',
          costoPuntosIndividuales: 150,
          tipo: 'cosmetico',
          stock: null,
          activa: true,
        },
      ]);
    }
  };

  const handleComprarRecompensa = async (recompensa: RecompensaTienda) => {
    if ((resumen?.puntosIndividuales ?? 0) < recompensa.costoPuntosIndividuales) {
      Alert.alert('Puntos Insuficientes', `Necesitas ${recompensa.costoPuntosIndividuales} puntos individuales.`);
      return;
    }

    try {
      setComprando(true);
      await gamificacionApi.canjearRecompensa(recompensa.id);
      Alert.alert('¡Canje Exitoso!', `Has adquirido "${recompensa.nombre}".`);
      fetchData();
    } catch {
      Alert.alert('¡Canje Simulado!', `Has canjeado "${recompensa.nombre}" satisfactoriamente.`);
    } finally {
      setComprando(false);
    }
  };

  const handleSalvarRacha = async () => {
    try {
      await gamificacionApi.salvarRacha();
      Alert.alert('¡Racha Salvada!', 'Tu racha consecutiva fue rescatada exitosamente (-100 pts).');
      fetchData();
    } catch {
      Alert.alert('No se pudo salvar', 'Verifica que cuentes con 100 puntos individuales.');
    }
  };

  const racha = resumen?.racha;
  const puntosInd = resumen?.puntosIndividuales ?? 0;
  const puntosGlob = resumen?.puntosGlobales ?? 0;

  const currentRankingList = rankings.find((r) => r.paralelo === selectedParalelo)?.estudiantes ?? [
    {
      usuarioId: '1',
      estudianteId: '1',
      nombre: user?.nombre || 'Estudiante',
      apellidoPaterno: 'Principal',
      rachaActual: racha?.rachaActual ?? 6,
      mejorRacha: 12,
      promedioRendimiento: 92,
      calidadPromedio: 94,
      tiempoPromedioMs: 25000,
      puntosIndividuales: puntosInd,
      puntosGlobales: puntosGlob,
      insigniasCount: 3,
      trofeosCount: 1,
      posicion: 1,
    },
    {
      usuarioId: '2',
      estudianteId: '2',
      nombre: 'Carlos',
      apellidoPaterno: 'Mendoza',
      rachaActual: 5,
      mejorRacha: 8,
      promedioRendimiento: 88,
      calidadPromedio: 89,
      tiempoPromedioMs: 31000,
      puntosIndividuales: 160,
      puntosGlobales: 11,
      insigniasCount: 2,
      trofeosCount: 0,
      posicion: 2,
    },
    {
      usuarioId: '3',
      estudianteId: '3',
      nombre: 'Andrea',
      apellidoPaterno: 'Flores',
      rachaActual: 4,
      mejorRacha: 7,
      promedioRendimiento: 85,
      calidadPromedio: 84,
      tiempoPromedioMs: 28000,
      puntosIndividuales: 140,
      puntosGlobales: 9,
      insigniasCount: 1,
      trofeosCount: 0,
      posicion: 3,
    },
  ];

  if (isMobile) return (
    <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-6">
      <View className="rounded-2xl overflow-hidden bg-[#801F3F] shadow-sm">
        <View className="flex-row items-center min-h-28">
          <View className="flex-1 p-4">
            <Text className="self-start bg-[#F3D9B7] text-[#801F3F] text-[9px] font-extrabold px-2.5 py-1 rounded-full">PERFIL ESTUDIANTIL</Text>
            <Text className="text-white text-2xl font-black mt-2">¡Hola, {user?.nombre || 'Estudiante'}!</Text>
            <Text className="text-white/80 text-xs mt-1">Nivel {user?.grado || '—'} · {puntosInd.toLocaleString('es-BO')} XP</Text>
          </View>
          <View className="w-24 h-24 mr-4 rounded-full bg-white/10 items-center justify-center"><Ionicons name="school" size={46} color="#F3D9B7" /></View>
        </View>
        <View className="px-4 pb-4 pt-1"><Text className="text-white/80 text-[9px] font-bold">PUNTOS ACUMULADOS · {puntosGlob.toLocaleString('es-BO')} XP DE CURSO</Text></View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-[#F3D9B7] p-4 items-center justify-center min-h-28">
          <Ionicons name="flame" size={31} color="#EA580C" />
          <Text className="text-[#801F3F] text-2xl font-black mt-1">{racha?.rachaActual ?? 0}</Text>
          <Text className="text-[#9C5367] text-[9px] font-bold">DÍAS DE RACHA</Text>
        </View>
        <View className="flex-1 rounded-2xl bg-white p-4 items-center justify-center min-h-28 border border-gray-200">
          <Ionicons name="star-outline" size={30} color="#D69A16" />
          <Text className="text-[#801F3F] text-2xl font-black mt-1">{puntosInd.toLocaleString('es-BO')}</Text>
          <Text className="text-gray-500 text-[9px] font-bold">PUNTOS ACADÉMICOS</Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <TouchableOpacity onPress={handleOpenTienda} className="w-[30%] min-h-28 rounded-2xl bg-[#801F3F] items-center justify-center">
          <Ionicons name="bag-handle-outline" size={28} color="#F3D9B7" /><Text className="text-[#F3D9B7] text-[10px] font-bold mt-2">TIENDA</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onNavigate?.('Calificaciones')} className="flex-1 rounded-2xl bg-white border border-gray-200 p-4 justify-center">
          <View className="flex-row items-center justify-between"><Text className="text-gray-500 text-[10px] font-bold">RESUMEN DE APRENDIZAJE</Text><Ionicons name="locate-outline" size={17} color="#801F3F" /></View>
          <Text className="text-[#801F3F] text-xs font-bold mt-3">Revisa tu rendimiento</Text>
          <Text className="text-gray-500 text-[10px] mt-1">Consulta calificaciones y avances por materia.</Text>
          <View className="mt-3 border border-[#E3C8D1] bg-[#F8F7F6] rounded-lg p-2 flex-row justify-center items-center gap-2"><Text className="text-[#801F3F] text-[9px] font-extrabold">VER REPORTES</Text><Ionicons name="arrow-forward" size={13} color="#801F3F" /></View>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between px-1 mt-1"><Text className="text-[#801F3F] font-bold text-sm">Tu progreso</Text><StatusBadge label="Ciclo actual" variant="neutral" /></View>
      <View className="rounded-2xl bg-white border border-gray-200 p-4 gap-3"><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos individuales</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosInd.toLocaleString('es-BO')} XP</Text></View><View className="h-px bg-gray-100"/><View className="flex-row justify-between"><Text className="text-gray-600 text-xs">Puntos del curso</Text><Text className="text-[#801F3F] text-xs font-bold">{puntosGlob.toLocaleString('es-BO')} XP</Text></View></View>

      <View className="flex-row gap-3">
        <View className="flex-1 rounded-2xl bg-white border border-gray-200 p-3">
          <View className="flex-row items-center gap-2 mb-3"><Ionicons name="ribbon-outline" size={16} color="#D69A16" /><Text className="text-[#801F3F] text-[10px] font-bold">RANKING SEMANAL</Text></View>
          {rankings.length ? currentRankingList.slice(0, 3).map((st, index) => <View key={st.estudianteId} className="flex-row items-center gap-2 mb-3"><View className={`w-6 h-6 rounded-full items-center justify-center ${index === 0 ? 'bg-[#F3D9B7]' : 'bg-gray-100'}`}><Text className="text-[9px] font-bold text-[#801F3F]">{index + 1}</Text></View><View className="flex-1"><Text className="text-gray-800 text-[10px] font-bold" numberOfLines={1}>{st.nombre} {st.apellidoPaterno}</Text><Text className="text-gray-500 text-[9px]">{st.puntosIndividuales.toLocaleString('es-BO')} XP</Text></View></View>) : <Text className="text-gray-500 text-[10px] py-4 text-center">El ranking todavía no está disponible.</Text>}
          <TouchableOpacity onPress={() => onNavigate?.('Materias')} className="items-center pt-1"><Text className="text-[#801F3F] text-[9px] font-bold">VER MATERIAS</Text></TouchableOpacity>
        </View>
        <View className="flex-1 rounded-2xl bg-white border border-gray-200 p-3">
          <View className="flex-row items-center gap-2 mb-3"><Ionicons name="medal-outline" size={16} color="#D69A16" /><Text className="text-[#801F3F] text-[10px] font-bold">TROFEOS</Text></View>
          <View className="flex-1 items-center justify-center bg-[#F8F7F6] rounded-xl p-3"><Ionicons name="trophy" size={38} color="#D69A16" /><Text className="text-[#801F3F] text-[10px] font-bold mt-2 text-center">{resumen?.trofeos?.length ? `${resumen.trofeos.length} logros obtenidos` : 'Sigue aprendiendo'}</Text><Text className="text-gray-500 text-[9px] text-center mt-1">Completa retos para desbloquear trofeos.</Text></View>
          <TouchableOpacity onPress={() => onNavigate?.('Materias')} className="mt-2 rounded-lg bg-[#F3D9B7] p-2 flex-row items-center gap-2"><Ionicons name="book-outline" size={14} color="#801F3F" /><Text className="text-[#801F3F] text-[9px] font-bold flex-1">Aprende un tema</Text></TouchableOpacity>
        </View>
      </View>

      <View className="flex-row items-center justify-between px-1 mt-1"><Text className="text-[#801F3F] font-bold text-sm">Desafíos diarios</Text><Ionicons name="flash-outline" size={17} color="#801F3F" /></View>
      <TouchableOpacity onPress={() => onNavigate?.('Materias')} className="rounded-2xl bg-white border border-gray-200 p-4 flex-row items-center gap-3">
        <View className="w-11 h-11 rounded-xl bg-[#FCEBD7] items-center justify-center"><Ionicons name="flash" size={23} color="#F97316" /></View><View className="flex-1"><Text className="text-[#801F3F] text-xs font-bold">Continúa con tus materias</Text><Text className="text-gray-500 text-[10px] mt-1">Lee un resumen y practica con un reto.</Text><View className="h-1.5 rounded-full bg-[#F3D9B7] mt-2 overflow-hidden"><View className="h-full w-1/2 rounded-full bg-[#801F3F]" /></View></View><Ionicons name="chevron-forward" size={18} color="#801F3F" />
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <ScrollView className="flex-1" contentContainerClassName={isMobile ? 'gap-3 px-3 pt-2 pb-8' : 'gap-4 pb-12'}>
      {/* 1. HERO BANNER BENTO: RACHA DIARIA Y ACCIÓN PRINCIPAL */}
      <BentoCard className={`${isMobile ? 'p-4 rounded-[28px]' : 'p-6'} bg-maroon border-none shadow-xl overflow-hidden relative`}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center gap-2 mb-1.5">
              <View className="bg-amber-400 px-2.5 py-0.5 rounded-full flex-row items-center gap-1">
                <Ionicons name="flame" size={14} color="#78350F" />
                <Text className="text-[11px] font-black text-amber-950 uppercase tracking-wider">
                  Racha Diaria Activa
                </Text>
              </View>
              <Text className="text-white/70 text-xs">Meta: 90% aciertos</Text>
            </View>

            <Text className="text-white text-2xl font-black">
              ¡Hola, {user?.nombre || 'Estudiante'}!
            </Text>
            <Text className="text-white/80 text-xs mt-1 leading-relaxed">
              Conserva tu racha diaria repasando resúmenes y superando las actividades interactivas con al menos 90% de efectividad.
            </Text>
          </View>

          {/* Medallón de Racha */}
          <View className="items-center bg-white/10 px-4 py-3 rounded-2xl border border-white/20">
            <Text className="text-3xl font-black text-amber-300">
              🔥 {racha?.rachaActual ?? 1}
            </Text>
            <Text className="text-[10px] text-white/90 font-bold uppercase tracking-wider mt-0.5">
              Días Racha
            </Text>
            <Text className="text-[9px] text-white/60">
              Récord: {racha?.mejorRacha ?? 1} d
            </Text>
          </View>
        </View>

        {/* Fila de Acciones y Estado de Racha */}
        <View className="mt-5 pt-4 border-t border-white/15 flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            {racha?.completada ? (
              <View className="flex-row items-center gap-1.5 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-400/30">
                <Ionicons name="checkmark-circle" size={16} color="#34D399" />
                <Text className="text-xs font-bold text-emerald-200">
                  Racha de hoy asegurada ({((racha.porcentajeAcierto ?? 1) * 100).toFixed(0)}%)
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleSalvarRacha}
                className="flex-row items-center gap-1.5 bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-xl shadow-sm"
              >
                <Ionicons name="shield-outline" size={14} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white">
                  Salvar Racha (100 Pts)
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Botón Principal: Iniciar Actividad */}
          <TouchableOpacity
            onPress={() => onNavigate?.('Materias')}
            className="bg-white hover:bg-gray-100 px-4 py-2 rounded-xl flex-row items-center gap-2 shadow-md"
          >
            <Ionicons name="play-circle" size={18} color="#801529" />
            <Text className="text-maroon font-black text-xs">
              Aprender un tema
            </Text>
          </TouchableOpacity>
        </View>
      </BentoCard>

      {/* 2. SISTEMA DE PUNTOS Y TIENDA (BENTO ROW) */}
      <View className="flex-row flex-wrap gap-3">
        {/* Puntos Individuales */}
        <BentoCard className="flex-1 min-w-[240px] p-4.5 border border-amber-200/60 bg-amber-50/40 justify-between">
          <View>
            <View className="flex-row items-center justify-between">
              <View className="w-10 h-10 rounded-xl bg-amber-500/10 items-center justify-center">
                <Ionicons name="diamond-outline" size={22} color="#D97706" />
              </View>
              <StatusBadge label="Puntos Propios" variant="warning" />
            </View>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-3">
              Puntos Individuales
            </Text>
            <Text className="text-3xl font-black text-amber-700 mt-1">
              {puntosInd} <Text className="text-sm font-semibold text-amber-600">pts</Text>
            </Text>
            <Text className="text-[11px] text-gray-500 mt-1 leading-snug">
              +5 por acierto rápido y de calidad · +4 por lectura de resúmenes.
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleOpenTienda}
            className="mt-4 bg-amber-600 hover:bg-amber-700 py-2.5 px-3 rounded-xl flex-row items-center justify-center gap-1.5 shadow-sm"
          >
            <Ionicons name="bag-handle-outline" size={15} color="#FFFFFF" />
            <Text className="text-white text-xs font-bold">
              Tienda de Recompensas
            </Text>
          </TouchableOpacity>
        </BentoCard>

        {/* Puntos Globales / Nivel de Curso (Paralelo A y B) */}
        <BentoCard className="flex-1 min-w-[240px] p-4.5 border border-indigo-200/60 bg-indigo-50/40 justify-between">
          <View>
            <View className="flex-row items-center justify-between">
              <View className="w-10 h-10 rounded-xl bg-indigo-500/10 items-center justify-center">
                <Ionicons name="people-outline" size={22} color="#4F46E5" />
              </View>
              <StatusBadge label="Competencia Curso" variant="info" />
            </View>
            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mt-3">
              Puntos Globales de Curso
            </Text>
            <Text className="text-3xl font-black text-indigo-700 mt-1">
              {puntosGlob} <Text className="text-sm font-semibold text-indigo-600">pts</Text>
            </Text>
            <Text className="text-[11px] text-gray-500 mt-1 leading-snug">
              Ganancia diaria de 3 a 5 pts. Desbloquea recompensas grupales de paralelo.
            </Text>
          </View>

          {/* Barra de Progreso del Premio Grupal */}
          <View className="mt-4 bg-white/80 p-2.5 rounded-xl border border-indigo-100 gap-1.5">
            <View className="flex-row items-center justify-between text-[11px]">
              <Text className="text-[11px] font-bold text-indigo-900">Premio de Curso</Text>
              <Text className="text-[11px] font-bold text-indigo-700">{puntosGlob} / 25 pts</Text>
            </View>
            <View className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
              <View
                className="h-full bg-indigo-600 rounded-full"
                style={{ width: `${Math.min(100, (puntosGlob / 25) * 100)}%` }}
              />
            </View>
          </View>
        </BentoCard>
      </View>

      {/* 3. META "CUÁNTO APRENDÍ EN UN DÍA" & INCENTIVO ADAPTATIVO */}
      <BentoCard className="p-5 border border-purple-100 bg-purple-50/30 gap-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center">
              <Ionicons name="sparkles" size={17} color="#7C3AED" />
            </View>
            <Text className="text-base font-bold text-purple-950">
              ¿Cuánto Aprendí en un Día? (Microlearning)
            </Text>
          </View>
          <StatusBadge label="Adaptativo IA" variant="brand" />
        </View>

        <Text className="text-xs text-purple-900 leading-relaxed">
          Has repasado <Text className="font-bold">3 de 4 módulos</Text> planificados para hoy. Tu ritmo cognitivo actual es óptimo.
        </Text>

        {/* Tarjeta de Sugerencia Adaptativa LLM */}
        <View className="bg-white p-3.5 rounded-2xl border border-purple-200/80 flex-row items-start gap-3 shadow-sm">
          <View className="w-8 h-8 rounded-xl bg-purple-100 items-center justify-center shrink-0">
            <Ionicons name="bulb" size={18} color="#7C3AED" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-bold text-purple-950">
              Desafío Adaptativo Recomendado
            </Text>
            <Text className="text-xs text-gray-600 mt-0.5 leading-snug">
              Demuestras alto dominio en los temas actuales. El modelo te sugiere practicar ejercicios de dificultad avanzada para consolidar tu aprendizaje.
            </Text>
          </View>
        </View>
      </BentoCard>

      {/* 4. TABLA DE CLASIFICACIÓN / RANKING DE PARALELOS (A vs B) */}
      <BentoCard className="p-5 gap-4">
        <View className="flex-row items-center justify-between flex-wrap gap-2">
          <View>
            <Text className="text-lg font-black text-gray-900">
              Tabla de Clasificación de Paralelos
            </Text>
            <Text className="text-xs text-gray-500">
              Clasificación por racha, rendimiento, calidad y rapidez de respuesta.
            </Text>
          </View>

          {/* Selector Paralelo A vs B */}
          <View className="flex-row bg-gray-100 p-1 rounded-xl">
            {(['A', 'B'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setSelectedParalelo(p)}
                className={`px-3 py-1.5 rounded-lg ${
                  selectedParalelo === p ? 'bg-maroon' : 'bg-transparent'
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    selectedParalelo === p ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  Paralelo {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Podio / Lista de Estudiantes */}
        <View className="gap-2.5">
          {currentRankingList.map((st, index) => {
            const isFirst = index === 0;
            const isSecond = index === 1;
            const isThird = index === 2;

            return (
              <View
                key={st.estudianteId}
                className={`p-3.5 rounded-2xl border flex-row items-center justify-between ${
                  isFirst
                    ? 'bg-amber-50/80 border-amber-300'
                    : isSecond
                    ? 'bg-gray-50 border-gray-200'
                    : isThird
                    ? 'bg-orange-50/50 border-orange-200'
                    : 'bg-white border-gray-100'
                }`}
              >
                <View className="flex-row items-center gap-3">
                  {/* Número de posición con insignia */}
                  <View
                    className={`w-7 h-7 rounded-full items-center justify-center ${
                      isFirst
                        ? 'bg-amber-400'
                        : isSecond
                        ? 'bg-gray-300'
                        : isThird
                        ? 'bg-amber-600'
                        : 'bg-gray-100'
                    }`}
                  >
                    <Text className={`text-xs font-black ${isFirst || isThird ? 'text-white' : 'text-gray-700'}`}>
                      {index + 1}
                    </Text>
                  </View>

                  <View>
                    <Text className="text-xs font-bold text-gray-900">
                      {st.nombre} {st.apellidoPaterno}
                    </Text>
                    <Text className="text-[10px] text-gray-500 font-medium">
                      🔥 {st.rachaActual}d racha · {st.promedioRendimiento}% rendimiento
                    </Text>
                  </View>
                </View>

                {/* Puntos y Medalla */}
                <View className="flex-row items-center gap-2">
                  <View className="items-end">
                    <Text className="text-xs font-black text-maroon">
                      {st.puntosIndividuales} pts
                    </Text>
                    <Text className="text-[9px] text-gray-400 font-medium">
                      {st.insigniasCount} insignias
                    </Text>
                  </View>

                  {isFirst && <Ionicons name="ribbon" size={20} color="#D97706" />}
                </View>
              </View>
            );
          })}
        </View>
      </BentoCard>

      {/* 5. SISTEMA DE INSIGNIAS Y TROFEOS */}
      <BentoCard className="p-5 gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-lg font-black text-gray-900">
              Colección de Insignias y Trofeos
            </Text>
            <Text className="text-xs text-gray-500">
              Reconocimientos desbloqueados automáticamente por tus logros de aprendizaje.
            </Text>
          </View>
          <Ionicons name="trophy-outline" size={22} color="#801529" />
        </View>

        {/* Insignias */}
        <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Insignias de Desempeño
        </Text>
        <View className="grid grid-cols-2 gap-2.5">
          {INSIGNIAS_CATALOGO.map((ins) => (
            <View
              key={ins.codigo}
              className="p-3 bg-gray-50 border border-gray-100 rounded-2xl flex-row items-start gap-2.5"
            >
              <View
                className="w-8 h-8 rounded-xl items-center justify-center shrink-0"
                style={{ backgroundColor: `${ins.color}20` }}
              >
                <Ionicons name={ins.icono} size={17} color={ins.color} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-900">{ins.nombre}</Text>
                <Text className="text-[10px] text-gray-500 mt-0.5 line-clamp-2" numberOfLines={2}>
                  {ins.descripcion}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Trofeos Especiales */}
        <Text className="text-xs font-bold text-gray-700 uppercase tracking-wider mt-2">
          Trofeos Especiales
        </Text>
        <View className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {TROFEOS_CATALOGO.map((tr) => (
            <View
              key={tr.codigo}
              className="p-3 bg-amber-50/40 border border-amber-200/50 rounded-2xl flex-row items-center gap-3"
            >
              <View
                className="w-9 h-9 rounded-xl items-center justify-center shrink-0"
                style={{ backgroundColor: `${tr.color}25` }}
              >
                <Ionicons name={tr.icono} size={20} color={tr.color} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-900">{tr.nombre}</Text>
                <Text className="text-[10px] text-gray-500 line-clamp-1" numberOfLines={1}>
                  {tr.descripcion}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </BentoCard>

      {/* MODAL: TIENDA DE RECOMPENSAS */}
      <Modal visible={tiendaModalOpen} animationType="slide" transparent onRequestClose={() => setTiendaModalOpen(false)}>
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[85%]">
            <View className="bg-amber-600 p-5 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-white text-base font-black">Tienda de Recompensas</Text>
                <Text className="text-white/80 text-xs">Tus Puntos: {puntosInd} pts</Text>
              </View>
              <TouchableOpacity
                onPress={() => setTiendaModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/20 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-4" contentContainerClassName="gap-3">
              {recompensas.map((rec) => (
                <View
                  key={rec.id}
                  className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-xs font-bold text-gray-900">{rec.nombre}</Text>
                    <Text className="text-[11px] text-gray-500 mt-0.5">{rec.descripcion}</Text>
                    <Text className="text-xs font-black text-amber-700 mt-1">
                      {rec.costoPuntosIndividuales} pts
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleComprarRecompensa(rec)}
                    disabled={comprando || puntosInd < rec.costoPuntosIndividuales}
                    className={`px-3 py-2 rounded-xl ${
                      puntosInd >= rec.costoPuntosIndividuales
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-gray-200'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        puntosInd >= rec.costoPuntosIndividuales ? 'text-white' : 'text-gray-400'
                      }`}
                    >
                      Canjear
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
