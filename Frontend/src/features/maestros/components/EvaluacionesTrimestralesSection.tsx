import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Asset } from 'expo-asset';
import {
  evaluacionTrimestralApi,
  type ContextoTrimestral,
  type EvaluacionTrimestral,
  type ModuloAvanceOption,
  type NivelDificultad,
  type PreguntaTrimestral,
  type TemaRagOption,
} from '../../../api/evaluacionTrimestral.api';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard } from '../../../displays/components/BentoCard';
import { MarkdownContent } from '../../../shared/ui';
import { openExamPrintWindow, printExam } from '../utils/trimesterExamPrint';

const LOGO_SHALOM = require('../../../assets/shalom.png');

function getLogoShalomUrl(): string {
  if (typeof LOGO_SHALOM === 'string') return LOGO_SHALOM;
  try {
    return Asset.fromModule(LOGO_SHALOM).uri;
  } catch {
    return '';
  }
}

export interface AsignacionResumen {
  id: string;
  materiaNombre: string;
  grado: string;
  paralelo: string;
  nivel: string;
}

interface Props {
  asignaciones: AsignacionResumen[];
  selectedAsignacionId: string;
  onSelectAsignacion: (id: string) => void;
}

const DIFICULTADES: NivelDificultad[] = ['Moderado', 'Medio', 'Alto'];
const CANTIDADES: Array<10 | 15 | 20> = [10, 15, 20];
const TRIMESTRES_NUMEROS: Array<1 | 2 | 3> = [1, 2, 3];
const FORMATO_LABEL: Record<string, string> = {
  SELECCION_MULTIPLE: 'Selección múltiple',
  COMPLETAR: 'Completar',
  CONECTAR_FRASES: 'Conectar pares',
  DRAG_AND_DROP: 'Ordenar pasos',
  RESOLVER_EJERCICIO: 'Resolver ejercicio',
};

function notifyUser(title: string, msg: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

export function EvaluacionesTrimestralesSection({
  asignaciones,
  selectedAsignacionId,
  onSelectAsignacion,
}: Props) {
  const { user } = useAuth();
  const rol = String(user?.rol ?? '').toLowerCase();
  const permitido = !['estudiante', 'alumno', 'padre', 'padres', 'apoderado', 'tutor'].includes(rol);

  const [loadingCtx, setLoadingCtx] = useState(false);
  const [contexto, setContexto] = useState<ContextoTrimestral | null>(null);
  const [allExamenes, setAllExamenes] = useState<EvaluacionTrimestral[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listScope, setListScope] = useState<'materia' | 'todas'>('materia');
  const [refreshingList, setRefreshingList] = useState(false);

  // Modal de configuración paso a paso
  const [configOpen, setConfigOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTrimestreNumero, setSelectedTrimestreNumero] = useState<1 | 2 | 3>(1);
  const [tituloExamen, setTituloExamen] = useState('');
  const [selectedTemaIds, setSelectedTemaIds] = useState<string[]>([]);
  const [selectedModuloIds, setSelectedModuloIds] = useState<string[]>([]);
  const [aceptaDificultad, setAceptaDificultad] = useState<boolean | null>(null);
  const [dificultadManual, setDificultadManual] = useState<NivelDificultad>('Medio');
  const [cantidadTotal, setCantidadTotal] = useState<10 | 15 | 20>(10);
  const [cantidadTeoricas, setCantidadTeoricas] = useState(5);

  // Estado de generación asíncrona
  const [generatingExam, setGeneratingExam] = useState<EvaluacionTrimestral | null>(null);
  const [startingGen, setStartingGen] = useState(false);

  // Modal de revisión granular
  const [reviewExam, setReviewExam] = useState<EvaluacionTrimestral | null>(null);
  const [rejectDrafts, setRejectDrafts] = useState<Record<string, string>>({});
  const [openRejectId, setOpenRejectId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [finalizingPdf, setFinalizingPdf] = useState(false);

  // Visor PDF integrado
  const [pdfModal, setPdfModal] = useState<{ url: string; title: string; examId: string } | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollInFlightRef = useRef(false);
  const generatingExamIdRef = useRef<string | null>(null);

  useEffect(() => {
    generatingExamIdRef.current = generatingExam ? String(generatingExam.id) : null;
  }, [generatingExam]);

  const cantidadPracticas = cantidadTotal - cantidadTeoricas;
  const dificultadSugerida: NivelDificultad = contexto?.sugerenciaDificultad?.nivel ?? 'Medio';
  const dificultadFinal: NivelDificultad =
    aceptaDificultad === false ? dificultadManual : dificultadSugerida;

  const loadExamenes = useCallback(async (showSpinner = false) => {
    if (!permitido) return;
    if (showSpinner) setRefreshingList(true);
    try {
      const res = await evaluacionTrimestralApi.list();
      setAllExamenes(res.data ?? []);
      setListError(null);
    } catch (err: any) {
      setListError(err?.message || 'No se pudieron cargar las evaluaciones trimestrales.');
    } finally {
      setLoadingList(false);
      if (showSpinner) setRefreshingList(false);
    }
  }, [permitido]);

  const generandoActivos = useMemo(
    () => allExamenes.filter((e) => e.estado === 'generando'),
    [allExamenes],
  );

  const examenesDeMateria = useMemo(
    () =>
      selectedAsignacionId
        ? allExamenes.filter((e) => String(e.asignacionId) === String(selectedAsignacionId))
        : allExamenes,
    [allExamenes, selectedAsignacionId],
  );

  const examenes = listScope === 'todas' ? allExamenes : examenesDeMateria;

  const loadContexto = useCallback(async () => {
    if (!permitido || !selectedAsignacionId) {
      setContexto(null);
      return;
    }
    try {
      setLoadingCtx(true);
      const ctx = await evaluacionTrimestralApi.getContexto(selectedAsignacionId);
      setContexto(ctx);
      setDificultadManual(ctx.sugerenciaDificultad.nivel);
      if (ctx.trimestreVigente && [1, 2, 3].includes(ctx.trimestreVigente.numero)) {
        setSelectedTrimestreNumero(ctx.trimestreVigente.numero as 1 | 2 | 3);
      }
    } catch {
      setContexto(null);
    } finally {
      setLoadingCtx(false);
    }
  }, [permitido, selectedAsignacionId]);

  useEffect(() => {
    void loadContexto();
    void loadExamenes();
  }, [loadContexto, loadExamenes]);

  // Polling ligero mientras exista algún examen en estado 'generando' (estable, sin reiniciar el intervalo)
  const hasGenerating = Boolean(generatingExam) || generandoActivos.length > 0;

  useEffect(() => {
    if (!hasGenerating) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const pollOnce = async () => {
      if (pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      try {
        const res = await evaluacionTrimestralApi.list();
        const list = res.data ?? [];
        setAllExamenes(list);

        const activeGenId = generatingExamIdRef.current;
        if (activeGenId) {
          const updated = list.find((item) => String(item.id) === activeGenId);
          if (updated && updated.estado === 'generando') {
            setGeneratingExam(updated);
          } else if (updated && (updated.estado === 'en_revision' || updated.estado === 'aprobada')) {
            setGeneratingExam(null);
            setConfigOpen(false);
            setReviewExam(updated);
          } else if (updated && updated.estado === 'error') {
            setGeneratingExam(null);
            notifyUser(
              'Error en la generación',
              updated.errorMensaje || 'No se pudo generar la evaluación trimestral.',
            );
          }
        }
      } catch {
        /* reintentar en el siguiente ciclo */
      } finally {
        pollInFlightRef.current = false;
      }
    };

    void pollOnce();
    pollTimerRef.current = setInterval(() => {
      void pollOnce();
    }, 3000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [hasGenerating]);

  const materialesSinModulo: TemaRagOption[] = useMemo(() => {
    if (contexto?.materialesSinModulo) return contexto.materialesSinModulo;
    if (!contexto) return [];
    const moduloIds = new Set((contexto.modulos ?? []).map((m) => m.id));
    return contexto.temas.filter((t) => !t.temaId || !moduloIds.has(t.temaId));
  }, [contexto]);

  if (!permitido) return null;

  const trimestreEfectivo: 1 | 2 | 3 =
    contexto?.trimestreVigente && [1, 2, 3].includes(contexto.trimestreVigente.numero)
      ? (contexto.trimestreVigente.numero as 1 | 2 | 3)
      : selectedTrimestreNumero;

  const modulosDisponibles: ModuloAvanceOption[] = contexto?.modulos ?? [];
  const totalTemasSeleccionados = selectedTemaIds.length + selectedModuloIds.length;

  const openConfigModal = () => {
    if (!selectedAsignacionId) {
      notifyUser('Materia requerida', 'Selecciona primero una materia para generar la evaluación.');
      return;
    }
    const asigFallback = asignaciones.find((a) => a.id === selectedAsignacionId);
    const materiaNombre = contexto?.asignacion.materiaNombre ?? asigFallback?.materiaNombre ?? 'Materia';
    const trimNum = trimestreEfectivo;

    setStep(1);
    setTituloExamen(`Evaluación Trimestral T${trimNum} - ${materiaNombre}`);

    const temas = contexto?.temas ?? [];
    const ragIds = temas.filter((t) => t.ragDisponible).map((t) => t.materialId);
    if (ragIds.length > 0) {
      setSelectedTemaIds(ragIds);
      setSelectedModuloIds([]);
    } else if (temas.length > 0) {
      setSelectedTemaIds(temas.map((t) => t.materialId));
      setSelectedModuloIds([]);
    } else {
      setSelectedTemaIds([]);
      setSelectedModuloIds((contexto?.modulos ?? []).map((m) => m.id));
    }

    setAceptaDificultad(null);
    setDificultadManual(contexto?.sugerenciaDificultad?.nivel ?? 'Medio');
    setCantidadTotal(10);
    setCantidadTeoricas(5);
    setGeneratingExam(null);
    setConfigOpen(true);
  };

  const handleSelectManualTrimestre = (num: 1 | 2 | 3) => {
    setSelectedTrimestreNumero(num);
    if (configOpen) {
      setTituloExamen((prev) =>
        /^Evaluación Trimestral T[123]\s*-/.test(prev)
          ? prev.replace(/^Evaluación Trimestral T[123]/, `Evaluación Trimestral T${num}`)
          : prev,
      );
    }
  };

  const toggleTema = (materialId: string) => {
    setSelectedTemaIds((prev) =>
      prev.includes(materialId) ? prev.filter((id) => id !== materialId) : [...prev, materialId],
    );
  };

  const toggleModulo = (modulo: ModuloAvanceOption) => {
    if (modulo.materiales.length > 0) {
      const matIds = modulo.materiales.map((m) => m.materialId);
      const allSelected = matIds.every((id) => selectedTemaIds.includes(id));
      if (allSelected) {
        setSelectedTemaIds((prev) => prev.filter((id) => !matIds.includes(id)));
      } else {
        setSelectedTemaIds((prev) => Array.from(new Set([...prev, ...matIds])));
      }
      setSelectedModuloIds((prev) => prev.filter((id) => id !== modulo.id));
      return;
    }

    setSelectedModuloIds((prev) =>
      prev.includes(modulo.id) ? prev.filter((id) => id !== modulo.id) : [...prev, modulo.id],
    );
  };

  const selectAllTemasYModulos = () => {
    setSelectedTemaIds((contexto?.temas ?? []).map((t) => t.materialId));
    setSelectedModuloIds(
      modulosDisponibles.filter((m) => m.materiales.length === 0).map((m) => m.id),
    );
  };

  const clearAllTemasYModulos = () => {
    setSelectedTemaIds([]);
    setSelectedModuloIds([]);
  };

  const handleChangeTotal = (nuevoTotal: 10 | 15 | 20) => {
    const ratio = cantidadTeoricas / cantidadTotal;
    const nuevasTeoricas = Math.max(0, Math.min(nuevoTotal, Math.round(nuevoTotal * ratio)));
    setCantidadTotal(nuevoTotal);
    setCantidadTeoricas(nuevasTeoricas);
  };

  const handleStartGeneration = async () => {
    if (!selectedAsignacionId) return;
    if (totalTemasSeleccionados === 0) {
      notifyUser('Temas requeridos', 'Seleccione al menos un módulo o material para generar la evaluación.');
      return;
    }

    const materialesSeleccionados = (contexto?.temas ?? [])
      .filter((t) => selectedTemaIds.includes(t.materialId))
      .map((t) => ({
        materialId: t.materialId,
        titulo: t.titulo,
        temaNombre: t.temaNombre,
      }));

    const modulosSeleccionados = modulosDisponibles
      .filter((m) => selectedModuloIds.includes(m.id))
      .map((m) => ({
        materialId: `modulo-${m.id}`,
        titulo: `Unidad ${m.unidad}: ${m.titulo}`,
        temaNombre: m.contenidos ? `${m.titulo} - ${m.contenidos}` : m.titulo,
      }));

    const temasSeleccionados = [...materialesSeleccionados, ...modulosSeleccionados];
    const trimestreMatch = (contexto?.trimestresDisponibles ?? []).find(
      (t) => Number(t.numero) === trimestreEfectivo,
    );

    try {
      setStartingGen(true);
      const created = await evaluacionTrimestralApi.generar({
        asignacionId: selectedAsignacionId,
        trimestreId: contexto?.trimestreVigente?.id ?? trimestreMatch?.id,
        trimestreNumero: trimestreEfectivo,
        titulo: tituloExamen.trim() || undefined,
        dificultadSugerida,
        dificultadFinal,
        cantidadPreguntas: cantidadTotal,
        cantidadTeoricas,
        cantidadPracticas,
        temas: temasSeleccionados,
      });
      setGeneratingExam(created);
      setAllExamenes((prev) => [created, ...prev.filter((e) => e.id !== created.id)]);
    } catch (err: any) {
      notifyUser('No se pudo iniciar', err?.message || 'Error iniciando la generación.');
    } finally {
      setStartingGen(false);
    }
  };

  const handleProcessInBackground = () => {
    setGeneratingExam(null);
    setConfigOpen(false);
    notifyUser(
      'Procesando en segundo plano',
      'Puedes seguir navegando con normalidad. Recibirás una notificación cuando tu evaluación trimestral esté lista para revisión.',
    );
  };

  const handleOpenReview = async (exam: EvaluacionTrimestral) => {
    try {
      const fresh = await evaluacionTrimestralApi.getById(exam.id);
      setOpenRejectId(null);
      setRejectDrafts({});
      setReviewExam(fresh);
    } catch (err: any) {
      notifyUser('Error', err?.message || 'No se pudo cargar la evaluación.');
    }
  };

  const handleApproveQuestion = async (pregunta: PreguntaTrimestral) => {
    if (!reviewExam) return;
    try {
      setUpdatingId(pregunta.id);
      const updated = await evaluacionTrimestralApi.actualizarEstadoPregunta(
        reviewExam.id,
        pregunta.id,
        'aprobada',
        '',
      );
      setReviewExam(updated);
      if (openRejectId === pregunta.id) setOpenRejectId(null);
      setAllExamenes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    } catch (err: any) {
      notifyUser('Error', err?.message || 'No se pudo aprobar la pregunta.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRejectClick = async (pregunta: PreguntaTrimestral) => {
    if (!reviewExam) return;
    setOpenRejectId(pregunta.id);
    if (pregunta.estado !== 'rechazada') {
      try {
        setUpdatingId(pregunta.id);
        const updated = await evaluacionTrimestralApi.actualizarEstadoPregunta(
          reviewExam.id,
          pregunta.id,
          'rechazada',
          rejectDrafts[pregunta.id] ?? pregunta.comentario ?? '',
        );
        setReviewExam(updated);
        setAllExamenes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      } catch {
        /* mantener abierto el cuadro de indicaciones */
      } finally {
        setUpdatingId(null);
      }
    }
  };

  const handleRegenerateQuestion = async (pregunta: PreguntaTrimestral) => {
    if (!reviewExam) return;
    const indicaciones = (rejectDrafts[pregunta.id] ?? '').trim();
    if (indicaciones.length < 3) {
      notifyUser('Indicaciones requeridas', 'Escribe qué deseas corregir o cambiar en esta pregunta.');
      return;
    }
    try {
      setRegeneratingId(pregunta.id);
      const res = await evaluacionTrimestralApi.regenerarPregunta(
        reviewExam.id,
        pregunta.id,
        indicaciones,
      );
      setReviewExam(res.evaluacion);
      setAllExamenes((prev) => prev.map((e) => (e.id === res.evaluacion.id ? res.evaluacion : e)));
      setOpenRejectId(null);
      setRejectDrafts((prev) => ({ ...prev, [pregunta.id]: '' }));
    } catch (err: any) {
      notifyUser('Error al regenerar', err?.message || 'No se pudo regenerar la pregunta.');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleFinalizePdf = async () => {
    if (!reviewExam) return;
    if (Platform.OS !== 'web') {
      notifyUser('Exportación disponible en web', 'Abre esta evaluación en la versión web para imprimirla o guardarla como PDF.');
      return;
    }
    const printTarget = openExamPrintWindow();
    if (!printTarget) {
      notifyUser('No se pudo abrir la impresión', 'Permite las ventanas emergentes para generar el PDF de la evaluación.');
      return;
    }
    try {
      setFinalizingPdf(true);
      const docenteNombre = [user?.nombre, user?.apellidoPaterno, user?.apellidoMaterno]
        .filter(Boolean)
        .join(' ');
      const updated = await evaluacionTrimestralApi.aprobar(reviewExam.id);
      setAllExamenes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setReviewExam(null);
      await printExam(printTarget, updated, docenteNombre || 'Docente', getLogoShalomUrl());
      notifyUser(
        'Evaluación lista para exportar',
        'En la ventana de impresión elige “Guardar como PDF” para descargar el examen.',
      );
    } catch (err: any) {
      printTarget.window.close();
      notifyUser('Error al preparar la evaluación', err?.message || 'No se pudo preparar la impresión.');
    } finally {
      setFinalizingPdf(false);
    }
  };

  const handleExportExamPdf = async (exam: EvaluacionTrimestral) => {
    if (Platform.OS !== 'web') {
      notifyUser('Exportación disponible en web', 'Abre esta evaluación en la versión web para imprimirla o guardarla como PDF.');
      return;
    }
    const printTarget = openExamPrintWindow();
    if (!printTarget) {
      notifyUser('No se pudo abrir la impresión', 'Permite las ventanas emergentes para generar el PDF de la evaluación.');
      return;
    }
    const docenteNombre = [user?.nombre, user?.apellidoPaterno, user?.apellidoMaterno]
      .filter(Boolean)
      .join(' ') || 'Docente';
    try {
      await printExam(printTarget, exam, docenteNombre, getLogoShalomUrl());
    } catch (err: any) {
      printTarget.window.close();
      notifyUser('Error al preparar la evaluación', err?.message || 'No se pudo preparar la impresión.');
    }
  };

  const handleViewPdf = async (exam: EvaluacionTrimestral) => {
    try {
      setLoadingPdfId(exam.id);
      const { blobUrl } = await evaluacionTrimestralApi.fetchPdfBlob(exam.id, false);
      if (Platform.OS === 'web') {
        setPdfModal({ url: blobUrl, title: exam.titulo, examId: exam.id });
      } else {
        notifyUser('Documento listo', 'Descarga el archivo desde la versión web para visualizarlo embebido.');
      }
    } catch (err: any) {
      notifyUser('Error', err?.message || 'No se pudo abrir el PDF.');
    } finally {
      setLoadingPdfId(null);
    }
  };

  const handleDownloadPdf = async (exam: EvaluacionTrimestral) => {
    try {
      setLoadingPdfId(exam.id);
      const { blobUrl, fileName } = await evaluacionTrimestralApi.fetchPdfBlob(exam.id, true);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
    } catch (err: any) {
      notifyUser('Error', err?.message || 'No se pudo descargar el PDF.');
    } finally {
      setLoadingPdfId(null);
    }
  };

  const handlePrintPdf = async (exam: EvaluacionTrimestral) => {
    try {
      setLoadingPdfId(exam.id);
      const { blobUrl } = await evaluacionTrimestralApi.fetchPdfBlob(exam.id, false);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const win = window.open(blobUrl, '_blank');
        if (win) {
          win.addEventListener('load', () => {
            win.focus();
            win.print();
          });
        }
      }
    } catch (err: any) {
      notifyUser('Error', err?.message || 'No se pudo abrir la impresión.');
    } finally {
      setLoadingPdfId(null);
    }
  };

  const closePdfModal = () => {
    if (pdfModal?.url) {
      URL.revokeObjectURL(pdfModal.url);
    }
    setPdfModal(null);
  };

  const totalPreguntasReview = reviewExam?.preguntas.length ?? 0;
  const aprobadasReview =
    reviewExam?.preguntas.filter((q) => q.estado === 'aprobada').length ?? 0;
  const todasAprobadas = totalPreguntasReview > 0 && aprobadasReview === totalPreguntasReview;

  return (
    <View className="gap-4">
      {/* Procesos en segundo plano activos (persisten al recargar la página) */}
      {generandoActivos.length > 0 && (
        <View className="bg-maroon/5 border border-maroon/25 rounded-2xl p-3.5 gap-2.5">
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color="#801529" />
            <Text className="text-xs font-extrabold text-maroon">
              Generación en segundo plano activa ({generandoActivos.length})
            </Text>
          </View>
          {generandoActivos.map((jobExam) => {
            const pct = Math.max(5, Math.min(100, Number(jobExam.progreso ?? 5)));
            const isOtherAsig =
              selectedAsignacionId && String(jobExam.asignacionId) !== String(selectedAsignacionId);
            return (
              <View
                key={jobExam.id}
                className="bg-white border border-maroon/15 rounded-xl p-3 gap-1.5"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1">
                    <Text className="text-xs font-extrabold text-gray-900">
                      {jobExam.titulo}
                    </Text>
                    <Text className="text-[11px] text-gray-500">
                      {jobExam.materiaNombre} · {jobExam.cursoNombre} · Trimestre{' '}
                      {jobExam.trimestreNumero ?? 1} · {jobExam.dificultadFinal}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs font-black text-maroon">{pct}%</Text>
                    {isOtherAsig && (
                      <TouchableOpacity
                        onPress={() => onSelectAsignacion(String(jobExam.asignacionId))}
                        className="bg-maroon/10 px-2.5 py-1 rounded-lg"
                      >
                        <Text className="text-[10px] font-bold text-maroon">Ver materia</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <View className="h-full bg-maroon rounded-full" style={{ width: `${pct}%` }} />
                </View>

                <Text className="text-[11px] text-gray-600">
                  {jobExam.estadoDetalle || 'Generando preguntas en segundo plano…'}
                  {jobExam.totalLotes
                    ? ` · Lote ${jobExam.loteActual ?? 0}/${jobExam.totalLotes}`
                    : ''}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Advertencia / estado de trimestre vigente en la parte superior */}
      {!loadingCtx && !contexto?.trimestreVigente && (
        <View className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 gap-3">
          <View className="flex-row items-start gap-2.5">
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <View className="flex-1">
              <Text className="text-xs font-extrabold text-amber-900">
                Advertencia: No hay un trimestre vigente activo en la fecha actual
              </Text>
              <Text className="text-xs text-amber-800 mt-0.5">
                Puedes continuar y generar la evaluación seleccionando manualmente uno de los 3 trimestres:
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2">
            {TRIMESTRES_NUMEROS.map((num) => {
              const active = selectedTrimestreNumero === num;
              const info = (contexto?.trimestresDisponibles ?? []).find(
                (t) => Number(t.numero) === num,
              );
              return (
                <TouchableOpacity
                  key={num}
                  onPress={() => handleSelectManualTrimestre(num)}
                  className={`px-3.5 py-2 rounded-xl border flex-row items-center gap-1.5 ${
                    active
                      ? 'bg-maroon border-maroon'
                      : 'bg-white border-amber-300'
                  }`}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={14}
                    color={active ? '#FFFFFF' : '#B45309'}
                  />
                  <Text
                    className={`text-xs font-bold ${active ? 'text-white' : 'text-amber-900'}`}
                  >
                    Trimestre {num}
                  </Text>
                  {info?.inicio && info?.fin ? (
                    <Text
                      className={`text-[10px] ${active ? 'text-white/80' : 'text-amber-700'}`}
                    >
                      ({String(info.inicio).slice(0, 10)} - {String(info.fin).slice(0, 10)})
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Selector de materia/curso y estado de trimestre vigente */}
      <BentoCard className="p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="flex-1 min-w-[220px]">
            <Text className="text-base font-extrabold text-gray-900">
              Evaluaciones Trimestrales
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              Visibles únicamente para Docentes y Dirección. Ocultas para estudiantes.
            </Text>
          </View>

          <TouchableOpacity
            onPress={openConfigModal}
            disabled={loadingCtx || !selectedAsignacionId}
            className={`px-4 py-2.5 rounded-xl flex-row items-center gap-2 ${
              !loadingCtx && selectedAsignacionId
                ? 'bg-maroon shadow-sm'
                : 'bg-gray-200'
            }`}
          >
            <Ionicons
              name="sparkles"
              size={16}
              color={!loadingCtx && selectedAsignacionId ? '#FFFFFF' : '#9CA3AF'}
            />
            <Text
              className={`text-xs font-bold ${
                !loadingCtx && selectedAsignacionId ? 'text-white' : 'text-gray-500'
              }`}
            >
              Generar Examen Trimestral
            </Text>
          </TouchableOpacity>
        </View>

        {/* Selector de asignación */}
        {asignaciones.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            {asignaciones.map((a) => {
              const active = selectedAsignacionId === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  onPress={() => onSelectAsignacion(a.id)}
                  className={`px-3 py-1.5 rounded-xl border ${
                    active ? 'bg-maroon border-maroon' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text
                    className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-700'}`}
                  >
                    {a.materiaNombre} · {a.grado}° {a.paralelo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Indicador de trimestre vigente o carga */}
        {(loadingCtx || contexto?.trimestreVigente) && (
          <View className="mt-3">
            {loadingCtx ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#801529" />
                <Text className="text-xs text-gray-500">Cargando contexto trimestral y temas…</Text>
              </View>
            ) : contexto?.trimestreVigente ? (
              <View className="flex-row items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text className="text-xs font-semibold text-emerald-800 flex-1">
                  Trimestre {contexto.trimestreVigente.numero} vigente (
                  {String(contexto.trimestreVigente.inicio).slice(0, 10)} al{' '}
                  {String(contexto.trimestreVigente.fin).slice(0, 10)}) · Generación habilitada
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </BentoCard>

      {/* Barra de filtro de listado y botón de actualización */}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setListScope('materia')}
            className={`px-3 py-1.5 rounded-xl border ${
              listScope === 'materia'
                ? 'bg-maroon border-maroon'
                : 'bg-white border-gray-200'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                listScope === 'materia' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Esta materia ({examenesDeMateria.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setListScope('todas')}
            className={`px-3 py-1.5 rounded-xl border ${
              listScope === 'todas'
                ? 'bg-maroon border-maroon'
                : 'bg-white border-gray-200'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                listScope === 'todas' ? 'text-white' : 'text-gray-700'
              }`}
            >
              Todas las materias ({allExamenes.length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => void loadExamenes(true)}
          disabled={refreshingList}
          className="px-3 py-1.5 rounded-xl bg-white border border-gray-200 flex-row items-center gap-1.5"
        >
          {refreshingList ? (
            <ActivityIndicator size={12} color="#801529" />
          ) : (
            <Ionicons name="refresh-outline" size={14} color="#374151" />
          )}
          <Text className="text-xs font-bold text-gray-700">Actualizar</Text>
        </TouchableOpacity>
      </View>

      {/* Error al cargar listado si existiera */}
      {listError && (
        <View className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 flex-row items-center justify-between gap-2">
          <Text className="text-xs font-semibold text-red-700 flex-1">{listError}</Text>
          <TouchableOpacity onPress={() => void loadExamenes(true)}>
            <Text className="text-xs font-bold text-red-800 underline">Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Listado de pruebas trimestrales */}
      {loadingList ? (
        <View className="py-10 items-center">
          <ActivityIndicator size="large" color="#801529" />
        </View>
      ) : examenes.length === 0 ? (
        <BentoCard className="p-8 items-center">
          <Ionicons name="document-text-outline" size={44} color="#D1D5DB" />
          <Text className="text-sm font-bold text-gray-600 mt-3">
            {listScope === 'materia' && allExamenes.length > 0
              ? 'No hay evaluaciones trimestrales en esta materia'
              : 'Aún no hay evaluaciones trimestrales generadas'}
          </Text>
          <Text className="text-xs text-gray-400 text-center mt-1 max-w-sm">
            Selecciona una materia y pulsa "Generar Examen Trimestral" para crear una prueba asistida.
          </Text>
          {listScope === 'materia' && allExamenes.length > 0 && (
            <TouchableOpacity
              onPress={() => setListScope('todas')}
              className="mt-3 px-4 py-2 rounded-xl bg-maroon/10"
            >
              <Text className="text-xs font-bold text-maroon">
                Ver las {allExamenes.length} evaluaciones de todas las materias
              </Text>
            </TouchableOpacity>
          )}
        </BentoCard>
      ) : (
        <View className="gap-3">
          {examenes.map((exam) => {
            const isPdfLoading = loadingPdfId === exam.id;
            const approvedCount = exam.preguntas.filter((q) => q.estado === 'aprobada').length;
            return (
              <BentoCard key={exam.id} className="p-4">
                <View className="flex-row flex-wrap items-start justify-between gap-2">
                  <View className="flex-1 min-w-[200px]">
                    <View className="flex-row flex-wrap items-center gap-2 mb-1">
                      <View className="bg-maroon/10 px-2 py-0.5 rounded-full">
                        <Text className="text-[10px] font-bold text-maroon uppercase">
                          Trimestre {exam.trimestreNumero ?? 1}
                        </Text>
                      </View>
                      <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                        <Text className="text-[10px] font-bold text-gray-700">
                          Dificultad {exam.dificultadFinal}
                        </Text>
                      </View>
                      {exam.estado === 'generando' && (
                        <View className="bg-amber-100 px-2 py-0.5 rounded-full flex-row items-center gap-1">
                          <ActivityIndicator size={10} color="#B45309" />
                          <Text className="text-[10px] font-bold text-amber-800">
                            Generando en segundo plano…
                          </Text>
                        </View>
                      )}
                      {exam.estado === 'en_revision' && (
                        <View className="bg-blue-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-blue-800">
                            En revisión ({approvedCount}/{exam.preguntas.length} aprobadas)
                          </Text>
                        </View>
                      )}
                      {exam.estado === 'aprobada' && (
                        <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-emerald-800">
                            {exam.tienePdf ? `PDF archivado · v${exam.versionPdf}` : 'Aprobada'}
                          </Text>
                        </View>
                      )}
                      {exam.estado === 'error' && (
                        <View className="bg-red-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-red-700">Error</Text>
                        </View>
                      )}
                    </View>

                    <Text className="text-base font-extrabold text-gray-900">{exam.titulo}</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {exam.materiaNombre} · {exam.cursoNombre} · {exam.cantidadPreguntas} preguntas ({exam.cantidadTeoricas} teóricas / {exam.cantidadPracticas} prácticas)
                    </Text>
                    {exam.estado === 'generando' && (
                      <View className="mt-2 gap-1">
                        <View className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                          <View
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.max(5, Math.min(100, Number(exam.progreso ?? 5)))}%` }}
                          />
                        </View>
                        <Text className="text-[11px] font-semibold text-amber-800">
                          {Math.max(5, Math.min(100, Number(exam.progreso ?? 5)))}% ·{' '}
                          {exam.estadoDetalle || 'Generando preguntas en segundo plano…'}
                        </Text>
                      </View>
                    )}
                    {exam.estado === 'error' && exam.errorMensaje ? (
                      <Text className="text-xs text-red-600 mt-1">{exam.errorMensaje}</Text>
                    ) : null}
                  </View>

                  {/* Acciones */}
                  <View className="flex-row flex-wrap items-center gap-2">
                    {exam.estado === 'en_revision' && (
                      <TouchableOpacity
                        onPress={() => void handleOpenReview(exam)}
                        className="bg-maroon px-3.5 py-2 rounded-xl flex-row items-center gap-1.5"
                      >
                        <Ionicons name="checkmark-done-outline" size={15} color="#FFFFFF" />
                        <Text className="text-xs font-bold text-white">Revisar y aprobar</Text>
                      </TouchableOpacity>
                    )}

                    {exam.estado === 'aprobada' && (
                      <TouchableOpacity
                        onPress={() => void handleExportExamPdf(exam)}
                        className="bg-maroon px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                      >
                        <Ionicons name="print-outline" size={15} color="#FFFFFF" />
                        <Text className="text-xs font-bold text-white">Exportar PDF</Text>
                      </TouchableOpacity>
                    )}

                    {exam.tienePdf && (
                      <>
                        <TouchableOpacity
                          onPress={() => void handleViewPdf(exam)}
                          disabled={isPdfLoading}
                          className="bg-gray-100 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                        >
                          <Ionicons name="eye-outline" size={15} color="#374151" />
                          <Text className="text-xs font-bold text-gray-700">Visualizar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => void handleDownloadPdf(exam)}
                          disabled={isPdfLoading}
                          className="bg-gray-100 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                        >
                          <Ionicons name="download-outline" size={15} color="#374151" />
                          <Text className="text-xs font-bold text-gray-700">Descargar</Text>
                        </TouchableOpacity>

                        {Platform.OS === 'web' && (
                          <TouchableOpacity
                            onPress={() => void handlePrintPdf(exam)}
                            disabled={isPdfLoading}
                            className="bg-gray-100 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                          >
                            <Ionicons name="print-outline" size={15} color="#374151" />
                            <Text className="text-xs font-bold text-gray-700">Imprimir</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          onPress={() => void handleOpenReview(exam)}
                          className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl flex-row items-center gap-1.5"
                        >
                          <Ionicons name="create-outline" size={15} color="#B45309" />
                          <Text className="text-xs font-bold text-amber-800">Editar</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </BentoCard>
            );
          })}
        </View>
      )}

      {/* MODAL 1: CONFIGURACIÓN PASO A PASO Y PANTALLA DE CARGA */}
      <Modal visible={configOpen} transparent animationType="fade" onRequestClose={() => setConfigOpen(false)}>
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-3xl w-full max-w-2xl max-h-[90%] overflow-hidden shadow-2xl">
            <View className="bg-maroon px-5 py-4 flex-row items-center justify-between">
              <View>
                <Text className="text-white/75 text-[10px] font-bold uppercase tracking-wider">
                  {generatingExam ? 'Generando Evaluación' : `Paso ${step} de 3 · Configuración`}
                </Text>
                <Text className="text-white text-base font-extrabold mt-0.5">
                  Generar Examen Trimestral
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setConfigOpen(false)}
                className="w-8 h-8 rounded-full bg-white/15 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {generatingExam ? (
              <View className="p-8 items-center justify-center gap-4">
                <View className="w-20 h-20 rounded-full bg-maroon/10 items-center justify-center">
                  <ActivityIndicator size="large" color="#801529" />
                </View>
                <Text className="text-lg font-extrabold text-gray-900 text-center">
                  Preparando tu Evaluación Trimestral…
                </Text>
                <Text className="text-xs text-gray-500 text-center max-w-md leading-relaxed">
                  Estamos redactando las {generatingExam.cantidadPreguntas} preguntas ({generatingExam.cantidadTeoricas} teóricas y {generatingExam.cantidadPracticas} prácticas) con nivel {generatingExam.dificultadFinal} a partir de los temas seleccionados.
                </Text>

                <View className="w-full max-w-sm gap-1.5 mt-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[11px] font-semibold text-gray-600">
                      {generatingExam.estadoDetalle || 'Iniciando proceso en RAG…'}
                    </Text>
                    <Text className="text-xs font-black text-maroon">
                      {Math.max(5, Math.min(100, Number(generatingExam.progreso ?? 5)))}%
                    </Text>
                  </View>
                  <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-maroon rounded-full"
                      style={{
                        width: `${Math.max(5, Math.min(100, Number(generatingExam.progreso ?? 5)))}%`,
                      }}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleProcessInBackground}
                  className="mt-3 bg-gray-900 px-5 py-3 rounded-2xl flex-row items-center gap-2"
                >
                  <Ionicons name="notifications-outline" size={16} color="#FFFFFF" />
                  <Text className="text-xs font-bold text-white">Procesar en segundo plano</Text>
                </TouchableOpacity>
                <Text className="text-[11px] text-gray-400 text-center">
                  Te enviaremos una notificación cuando la prueba esté lista para revisión.
                </Text>
              </View>
            ) : (
              <ScrollView className="p-5" contentContainerClassName="gap-4">
                {step === 1 && (
                  <View className="gap-3">
                    {!contexto?.trimestreVigente && (
                      <View className="p-3 rounded-2xl bg-amber-50 border border-amber-200 gap-2">
                        <View className="flex-row items-center gap-1.5">
                          <Ionicons name="warning-outline" size={15} color="#B45309" />
                          <Text className="text-xs font-extrabold text-amber-900">
                            Sin trimestre vigente · Elige el trimestre de la evaluación
                          </Text>
                        </View>
                        <View className="flex-row gap-2">
                          {TRIMESTRES_NUMEROS.map((num) => {
                            const active = selectedTrimestreNumero === num;
                            return (
                              <TouchableOpacity
                                key={num}
                                onPress={() => handleSelectManualTrimestre(num)}
                                className={`flex-1 py-2 rounded-xl border items-center ${
                                  active
                                    ? 'bg-maroon border-maroon'
                                    : 'bg-white border-amber-300'
                                }`}
                              >
                                <Text
                                  className={`text-xs font-bold ${
                                    active ? 'text-white' : 'text-amber-900'
                                  }`}
                                >
                                  Trimestre {num}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    <View>
                      <Text className="text-xs font-bold text-gray-700 mb-1">
                        Título de la Evaluación
                      </Text>
                      <TextInput
                        value={tituloExamen}
                        onChangeText={setTituloExamen}
                        placeholder="Ej. Evaluación Trimestral 1 - Matemáticas"
                        className="bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900"
                      />
                    </View>

                    <View className="flex-row items-center justify-between mt-1">
                      <Text className="text-sm font-extrabold text-gray-900">
                        1. Temas de avance por módulo y material ({totalTemasSeleccionados})
                      </Text>
                      <View className="flex-row gap-2">
                        <TouchableOpacity onPress={selectAllTemasYModulos}>
                          <Text className="text-xs font-bold text-maroon">Marcar todos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={clearAllTemasYModulos}>
                          <Text className="text-xs font-semibold text-gray-500">Limpiar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {modulosDisponibles.length === 0 && materialesSinModulo.length === 0 ? (
                      <View className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                        <Text className="text-xs text-amber-800">
                          No se encontraron módulos ni materiales cargados para esta materia. Configura los temas en la malla o sube material de clase primero.
                        </Text>
                      </View>
                    ) : (
                      <View className="gap-3">
                        {modulosDisponibles.map((modulo) => {
                          const hasMats = modulo.materiales.length > 0;
                          const selectedCountInMod = hasMats
                            ? modulo.materiales.filter((m) =>
                                selectedTemaIds.includes(m.materialId),
                              ).length
                            : selectedModuloIds.includes(modulo.id)
                            ? 1
                            : 0;
                          const allSelected = hasMats
                            ? selectedCountInMod === modulo.materiales.length
                            : selectedModuloIds.includes(modulo.id);
                          const someSelected = hasMats && selectedCountInMod > 0 && !allSelected;

                          return (
                            <View
                              key={modulo.id}
                              className={`rounded-2xl border overflow-hidden ${
                                allSelected || someSelected
                                  ? 'border-maroon/40 bg-maroon/[0.02]'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              {/* Cabecera del módulo / unidad */}
                              <TouchableOpacity
                                onPress={() => toggleModulo(modulo)}
                                className="p-3 flex-row items-start gap-3"
                              >
                                <Ionicons
                                  name={
                                    allSelected
                                      ? 'checkbox'
                                      : someSelected
                                      ? 'remove-circle'
                                      : 'square-outline'
                                  }
                                  size={20}
                                  color={allSelected || someSelected ? '#801529' : '#9CA3AF'}
                                />
                                <View className="flex-1">
                                  <View className="flex-row items-center gap-1.5 flex-wrap">
                                    <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                                      <Text className="text-[10px] font-black text-gray-700">
                                        Módulo / Unidad {modulo.unidad}
                                      </Text>
                                    </View>
                                    {hasMats ? (
                                      <View className="bg-blue-50 px-2 py-0.5 rounded-md">
                                        <Text className="text-[10px] font-bold text-blue-700">
                                          {selectedCountInMod}/{modulo.materiales.length} material(es)
                                        </Text>
                                      </View>
                                    ) : (
                                      <View className="bg-amber-50 px-2 py-0.5 rounded-md">
                                        <Text className="text-[10px] font-bold text-amber-700">
                                          Tema de malla (sin material adjunto)
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text className="text-sm font-extrabold text-gray-900 mt-1">
                                    {modulo.titulo}
                                  </Text>
                                  {modulo.contenidos ? (
                                    <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>
                                      {modulo.contenidos}
                                    </Text>
                                  ) : null}
                                </View>
                              </TouchableOpacity>

                              {/* Materiales del módulo */}
                              {hasMats && (
                                <View className="px-3 pb-3 pt-1 gap-2 border-t border-gray-100 bg-gray-50/50">
                                  {modulo.materiales.map((tema) => {
                                    const checked = selectedTemaIds.includes(tema.materialId);
                                    return (
                                      <TouchableOpacity
                                        key={tema.materialId}
                                        onPress={() => toggleTema(tema.materialId)}
                                        className={`p-2.5 rounded-xl border flex-row items-start gap-2.5 ${
                                          checked
                                            ? 'bg-maroon/5 border-maroon'
                                            : 'bg-white border-gray-200'
                                        }`}
                                      >
                                        <Ionicons
                                          name={checked ? 'checkbox' : 'square-outline'}
                                          size={18}
                                          color={checked ? '#801529' : '#9CA3AF'}
                                        />
                                        <View className="flex-1">
                                          <View className="flex-row items-center gap-1.5 flex-wrap">
                                            <Text className="text-xs font-bold text-gray-900">
                                              {tema.titulo}
                                            </Text>
                                            {tema.tipoMaterial && (
                                              <View
                                                className={`px-1.5 py-0.5 rounded-full ${
                                                  tema.tipoMaterial === 'actividad'
                                                    ? 'bg-amber-100'
                                                    : 'bg-blue-100'
                                                }`}
                                              >
                                                <Text
                                                  className={`text-[9px] font-bold uppercase ${
                                                    tema.tipoMaterial === 'actividad'
                                                      ? 'text-amber-800'
                                                      : 'text-blue-800'
                                                  }`}
                                                >
                                                  {tema.tipoMaterial}
                                                </Text>
                                              </View>
                                            )}
                                            {tema.ragDisponible && (
                                              <View className="bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                                <Text className="text-[9px] font-bold text-emerald-800">
                                                  Contenido validado
                                                </Text>
                                              </View>
                                            )}
                                          </View>
                                          {tema.resumen ? (
                                            <Text
                                              className="text-[11px] text-gray-500 mt-0.5"
                                              numberOfLines={2}
                                            >
                                              {tema.resumen}
                                            </Text>
                                          ) : null}
                                        </View>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {/* Materiales que no están asociados a ningún módulo */}
                        {materialesSinModulo.length > 0 && (
                          <View className="rounded-2xl border border-gray-200 bg-white p-3 gap-2">
                            <Text className="text-xs font-extrabold text-gray-700 uppercase">
                              Otros materiales sin módulo asignado ({materialesSinModulo.length})
                            </Text>
                            {materialesSinModulo.map((tema) => {
                              const checked = selectedTemaIds.includes(tema.materialId);
                              return (
                                <TouchableOpacity
                                  key={tema.materialId}
                                  onPress={() => toggleTema(tema.materialId)}
                                  className={`p-2.5 rounded-xl border flex-row items-start gap-2.5 ${
                                    checked
                                      ? 'bg-maroon/5 border-maroon'
                                      : 'bg-gray-50 border-gray-200'
                                  }`}
                                >
                                  <Ionicons
                                    name={checked ? 'checkbox' : 'square-outline'}
                                    size={18}
                                    color={checked ? '#801529' : '#9CA3AF'}
                                  />
                                  <View className="flex-1">
                                    <View className="flex-row items-center gap-1.5 flex-wrap">
                                      <Text className="text-xs font-bold text-gray-900">
                                        {tema.titulo}
                                      </Text>
                                      {tema.ragDisponible && (
                                        <View className="bg-emerald-100 px-1.5 py-0.5 rounded-full">
                                          <Text className="text-[9px] font-bold text-emerald-800">
                                            Contenido validado
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                    {tema.resumen ? (
                                      <Text
                                        className="text-[11px] text-gray-500 mt-0.5"
                                        numberOfLines={2}
                                      >
                                        {tema.resumen}
                                      </Text>
                                    ) : null}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {step === 2 && (
                  <View className="gap-4">
                    <Text className="text-sm font-extrabold text-gray-900">
                      2. Nivel de Dificultad Inteligente
                    </Text>

                    <View className="p-4 rounded-2xl bg-maroon/5 border border-maroon/20 gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-bold text-maroon uppercase">
                          Nivel sugerido para este curso
                        </Text>
                        <View className="bg-maroon px-3 py-1 rounded-full">
                          <Text className="text-xs font-extrabold text-white">
                            {dificultadSugerida}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-xs text-gray-700 leading-relaxed">
                        {contexto?.sugerenciaDificultad?.justificacion}
                      </Text>
                      {contexto?.sugerenciaDificultad?.promedioCurso !== null && (
                        <Text className="text-[11px] font-semibold text-gray-500">
                          Promedio actual del curso: {contexto?.sugerenciaDificultad?.promedioCurso}/100
                          {contexto?.sugerenciaDificultad?.asistenciaPromedio !== null
                            ? ` · Asistencia: ${contexto?.sugerenciaDificultad?.asistenciaPromedio}%`
                            : ''}
                        </Text>
                      )}
                    </View>

                    <View className="gap-2">
                      <Text className="text-sm font-bold text-gray-800">
                        ¿Estás de acuerdo con esta dificultad?
                      </Text>
                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          onPress={() => setAceptaDificultad(true)}
                          className={`flex-1 py-3 rounded-xl border items-center flex-row justify-center gap-2 ${
                            aceptaDificultad === true
                              ? 'bg-emerald-600 border-emerald-600'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={18}
                            color={aceptaDificultad === true ? '#FFFFFF' : '#374151'}
                          />
                          <Text
                            className={`text-sm font-bold ${
                              aceptaDificultad === true ? 'text-white' : 'text-gray-700'
                            }`}
                          >
                            Sí, usar {dificultadSugerida}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setAceptaDificultad(false)}
                          className={`flex-1 py-3 rounded-xl border items-center flex-row justify-center gap-2 ${
                            aceptaDificultad === false
                              ? 'bg-gray-900 border-gray-900'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <Ionicons
                            name="options-outline"
                            size={18}
                            color={aceptaDificultad === false ? '#FFFFFF' : '#374151'}
                          />
                          <Text
                            className={`text-sm font-bold ${
                              aceptaDificultad === false ? 'text-white' : 'text-gray-700'
                            }`}
                          >
                            No, elegir manual
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {aceptaDificultad === false && (
                      <View className="gap-2 pt-2 border-t border-gray-100">
                        <Text className="text-xs font-bold text-gray-600 uppercase">
                          Selecciona el nivel manualmente
                        </Text>
                        <View className="flex-row gap-2">
                          {DIFICULTADES.map((nivel) => {
                            const active = dificultadManual === nivel;
                            return (
                              <TouchableOpacity
                                key={nivel}
                                onPress={() => setDificultadManual(nivel)}
                                className={`flex-1 py-3 rounded-xl border items-center ${
                                  active
                                    ? 'bg-maroon border-maroon'
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <Text
                                  className={`text-sm font-bold ${
                                    active ? 'text-white' : 'text-gray-700'
                                  }`}
                                >
                                  {nivel}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {step === 3 && (
                  <View className="gap-5">
                    <View className="gap-2">
                      <Text className="text-sm font-extrabold text-gray-900">
                        3. Cantidad Total de Preguntas
                      </Text>
                      <View className="flex-row gap-3">
                        {CANTIDADES.map((qty) => {
                          const active = cantidadTotal === qty;
                          return (
                            <TouchableOpacity
                              key={qty}
                              onPress={() => handleChangeTotal(qty)}
                              className={`flex-1 py-3 rounded-2xl border items-center ${
                                active ? 'bg-maroon border-maroon' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <Text
                                className={`text-lg font-black ${
                                  active ? 'text-white' : 'text-gray-800'
                                }`}
                              >
                                {qty}
                              </Text>
                              <Text
                                className={`text-[11px] font-semibold ${
                                  active ? 'text-white/80' : 'text-gray-500'
                                }`}
                              >
                                preguntas
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Slider Dual/Vinculado Teórica vs. Práctica */}
                    <View className="p-4 rounded-2xl bg-gray-50 border border-gray-200 gap-3">
                      <Text className="text-sm font-extrabold text-gray-900">
                        4. Distribución Teórica vs. Práctica
                      </Text>

                      <View className="flex-row items-center justify-between">
                        <View className="bg-blue-100 px-3 py-1.5 rounded-xl">
                          <Text className="text-xs font-extrabold text-blue-900">
                            Teóricas: {cantidadTeoricas}
                          </Text>
                        </View>
                        <Text className="text-xs font-bold text-gray-400">
                          Total: {cantidadTotal}
                        </Text>
                        <View className="bg-emerald-100 px-3 py-1.5 rounded-xl">
                          <Text className="text-xs font-extrabold text-emerald-900">
                            Prácticas: {cantidadPracticas}
                          </Text>
                        </View>
                      </View>

                      {/* Barra visual proporcional */}
                      <View className="h-3 rounded-full overflow-hidden flex-row bg-gray-200">
                        <View
                          style={{ width: `${(cantidadTeoricas / cantidadTotal) * 100}%` }}
                          className="bg-blue-600 h-full"
                        />
                        <View
                          style={{ width: `${(cantidadPracticas / cantidadTotal) * 100}%` }}
                          className="bg-emerald-600 h-full"
                        />
                      </View>

                      {Platform.OS === 'web' ? (
                        <input
                          type="range"
                          min={0}
                          max={cantidadTotal}
                          step={1}
                          value={cantidadTeoricas}
                          onChange={(e) => setCantidadTeoricas(Number(e.target.value))}
                          style={{ width: '100%', accentColor: '#801529', cursor: 'pointer' }}
                        />
                      ) : (
                        <View className="flex-row items-center justify-between gap-3">
                          <TouchableOpacity
                            onPress={() => setCantidadTeoricas((v) => Math.max(0, v - 1))}
                            className="px-4 py-2 rounded-xl bg-white border border-gray-300"
                          >
                            <Text className="text-sm font-black text-gray-700">- Teórica</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              setCantidadTeoricas((v) => Math.min(cantidadTotal, v + 1))
                            }
                            className="px-4 py-2 rounded-xl bg-white border border-gray-300"
                          >
                            <Text className="text-sm font-black text-gray-700">+ Teórica</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      <Text className="text-[11px] text-gray-500 text-center">
                        Al ajustar las preguntas teóricas, las prácticas se sincronizan automáticamente.
                      </Text>
                    </View>

                    {/* Resumen antes de generar */}
                    <View className="p-3.5 rounded-2xl bg-maroon/5 border border-maroon/15 gap-1">
                      <Text className="text-xs font-extrabold text-maroon">Resumen de la prueba</Text>
                      <Text className="text-xs text-gray-700">
                        • Trimestre {trimestreEfectivo} · {totalTemasSeleccionados} tema(s)/material(es) seleccionado(s) · Dificultad: {dificultadFinal}
                      </Text>
                      <Text className="text-xs text-gray-700">
                        • {cantidadTotal} preguntas ({cantidadTeoricas} teóricas y {cantidadPracticas} prácticas)
                      </Text>
                    </View>
                  </View>
                )}

                {/* Controles de navegación del wizard */}
                <View className="flex-row items-center justify-between pt-3 border-t border-gray-100">
                  {step > 1 ? (
                    <TouchableOpacity
                      onPress={() => setStep((s) => (s === 3 ? 2 : 1))}
                      className="px-4 py-2.5 rounded-xl bg-gray-100"
                    >
                      <Text className="text-xs font-bold text-gray-700">Anterior</Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}

                  {step < 3 ? (
                    <TouchableOpacity
                      onPress={() => {
                        if (step === 1 && totalTemasSeleccionados === 0) {
                          notifyUser('Selección requerida', 'Marca al menos un módulo o material para continuar.');
                          return;
                        }
                        if (step === 2 && aceptaDificultad === null) {
                          notifyUser('Confirmación requerida', 'Indica si estás de acuerdo con la dificultad sugerida.');
                          return;
                        }
                        setStep((s) => (s === 1 ? 2 : 3));
                      }}
                      className="px-5 py-2.5 rounded-xl bg-maroon flex-row items-center gap-1.5"
                    >
                      <Text className="text-xs font-bold text-white">Siguiente</Text>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => void handleStartGeneration()}
                      disabled={startingGen}
                      className="px-5 py-2.5 rounded-xl bg-maroon flex-row items-center gap-2"
                    >
                      {startingGen ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons name="sparkles" size={15} color="#FFFFFF" />
                      )}
                      <Text className="text-xs font-bold text-white">
                        {startingGen ? 'Iniciando…' : 'Generar Prueba'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 2: REVISIÓN GRANULAR POR PREGUNTA Y REGENERACIÓN PUNTUAL */}
      <Modal
        visible={Boolean(reviewExam)}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewExam(null)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-3">
          <View className="bg-white rounded-3xl w-full max-w-4xl h-[90%] overflow-hidden shadow-2xl">
            <View className="bg-maroon px-5 py-4 flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-white/75 text-[10px] font-bold uppercase tracking-wider">
                  Revisión Granular · {aprobadasReview} de {totalPreguntasReview} aprobadas
                </Text>
                <Text className="text-white text-base font-extrabold mt-0.5" numberOfLines={1}>
                  {reviewExam?.titulo}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReviewExam(null)}
                className="w-8 h-8 rounded-full bg-white/15 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Barra de progreso de aprobación */}
            <View className="h-1.5 bg-gray-100">
              <View
                style={{
                  width: `${totalPreguntasReview ? (aprobadasReview / totalPreguntasReview) * 100 : 0}%`,
                }}
                className="h-full bg-emerald-500"
              />
            </View>

            <ScrollView className="flex-1 p-5" contentContainerClassName="gap-4 pb-6">
              {(reviewExam?.preguntas ?? []).length === 0 ? (
                <View className="py-12 items-center gap-2">
                  <Ionicons name="help-circle-outline" size={40} color="#D1D5DB" />
                  <Text className="text-sm font-bold text-gray-600">
                    No se encontraron preguntas cargadas en esta evaluación.
                  </Text>
                </View>
              ) : null}
              {(reviewExam?.preguntas ?? []).map((pregunta) => {
                const isApproved = pregunta.estado === 'aprobada';
                const isRejected = pregunta.estado === 'rechazada';
                const isRegen = regeneratingId === pregunta.id;
                const isUpd = updatingId === pregunta.id;
                const showRejectBox = openRejectId === pregunta.id || isRejected;
                const formatoBadgeColor =
                  pregunta.formato === 'SELECCION_MULTIPLE'
                    ? 'bg-blue-100 text-blue-800'
                    : pregunta.formato === 'COMPLETAR'
                    ? 'bg-purple-100 text-purple-800'
                    : pregunta.formato === 'CONECTAR_FRASES'
                    ? 'bg-amber-100 text-amber-800'
                    : pregunta.formato === 'DRAG_AND_DROP'
                    ? 'bg-cyan-100 text-cyan-800'
                    : 'bg-rose-100 text-rose-800';
                const respuestaFallback =
                  pregunta.respuesta_correcta_md?.trim() ||
                  (pregunta.pares && pregunta.pares.length > 0
                    ? pregunta.pares.map((p, i) => `${i + 1}. ${p.izquierda} → ${p.derecha}`).join('\n')
                    : pregunta.items && pregunta.items.length > 0
                    ? pregunta.items.map((it, i) => `${i + 1}. ${it}`).join('\n')
                    : '');

                return (
                  <View
                    key={pregunta.id}
                    className={`rounded-2xl border p-4 gap-3 ${
                      isApproved
                        ? 'bg-emerald-50/40 border-emerald-300'
                        : isRejected
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <View className="flex-row flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-sm font-black text-maroon">
                          Pregunta {pregunta.numero}
                        </Text>
                        <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                          <Text className="text-[10px] font-bold text-gray-700">
                            {pregunta.categoria === 'TEORICA' ? 'Teórica' : 'Práctica'} · {pregunta.puntaje} pts
                          </Text>
                        </View>
                        <View className={`px-2 py-0.5 rounded-full ${formatoBadgeColor.split(' ')[0]}`}>
                          <Text className={`text-[10px] font-bold ${formatoBadgeColor.split(' ')[1]}`}>
                            {FORMATO_LABEL[pregunta.formato] ?? pregunta.formato}
                          </Text>
                        </View>
                        {pregunta.tema ? (
                          <Text className="text-[11px] text-gray-500" numberOfLines={1}>
                            {pregunta.tema}
                          </Text>
                        ) : null}
                      </View>

                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity
                          onPress={() => void handleApproveQuestion(pregunta)}
                          disabled={isUpd || isRegen}
                          className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1 ${
                            isApproved
                              ? 'bg-emerald-600'
                              : 'bg-emerald-50 border border-emerald-300'
                          }`}
                        >
                          <Ionicons
                            name="checkmark"
                            size={15}
                            color={isApproved ? '#FFFFFF' : '#059669'}
                          />
                          <Text
                            className={`text-xs font-bold ${
                              isApproved ? 'text-white' : 'text-emerald-700'
                            }`}
                          >
                            {isApproved ? 'Aprobada' : 'Aprobar'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => void handleRejectClick(pregunta)}
                          disabled={isUpd || isRegen}
                          className={`px-3 py-1.5 rounded-xl flex-row items-center gap-1 ${
                            showRejectBox
                              ? 'bg-red-600'
                              : 'bg-red-50 border border-red-200'
                          }`}
                        >
                          <Ionicons
                            name="close"
                            size={15}
                            color={showRejectBox ? '#FFFFFF' : '#DC2626'}
                          />
                          <Text
                            className={`text-xs font-bold ${
                              showRejectBox ? 'text-white' : 'text-red-700'
                            }`}
                          >
                            Corregir
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {isRegen ? (
                      <View className="py-6 items-center gap-2">
                        <ActivityIndicator size="small" color="#801529" />
                        <Text className="text-xs font-semibold text-gray-500">
                          Regenerando únicamente la pregunta {pregunta.numero}…
                        </Text>
                      </View>
                    ) : (
                      <View className="gap-2.5">
                        <MarkdownContent texto={pregunta.enunciado_md} />

                        {pregunta.opciones && pregunta.opciones.length > 0 && (
                          <View className="gap-1.5 pl-1 mt-1">
                            <Text className="text-[10px] font-bold text-gray-500 uppercase">
                              {pregunta.formato === 'COMPLETAR'
                                ? 'Banco de opciones para completar'
                                : 'Opciones de respuesta'}
                            </Text>
                            {pregunta.opciones.map((opt, idx) => (
                              <View
                                key={idx}
                                className="flex-row items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
                              >
                                <Text className="text-xs font-black text-maroon mt-0.5">
                                  {String.fromCharCode(65 + idx)})
                                </Text>
                                <View className="flex-1">
                                  <MarkdownContent texto={opt} />
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {pregunta.pares && pregunta.pares.length > 0 && (
                          <View className="gap-1.5 mt-1">
                            <Text className="text-[10px] font-bold text-gray-500 uppercase">
                              Pares a conectar
                            </Text>
                            {pregunta.pares.map((par, idx) => (
                              <View
                                key={idx}
                                className="flex-row items-center gap-2 bg-amber-50/50 border border-amber-200/70 rounded-xl px-3 py-2"
                              >
                                <Text className="text-xs font-bold text-gray-800 flex-1">
                                  {idx + 1}. {par.izquierda}
                                </Text>
                                <Ionicons name="arrow-forward" size={14} color="#B45309" />
                                <Text className="text-xs text-gray-700 flex-1">{par.derecha}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {pregunta.items && pregunta.items.length > 0 && (
                          <View className="gap-1.5 mt-1">
                            <Text className="text-[10px] font-bold text-gray-500 uppercase">
                              Elementos / pasos a ordenar
                            </Text>
                            {pregunta.items.map((it, idx) => (
                              <View
                                key={idx}
                                className="flex-row items-center gap-2 bg-cyan-50/50 border border-cyan-200/70 rounded-xl px-3 py-2"
                              >
                                <View className="w-5 h-5 rounded-full bg-cyan-600 items-center justify-center">
                                  <Text className="text-[10px] font-black text-white">{idx + 1}</Text>
                                </View>
                                <View className="flex-1">
                                  <MarkdownContent texto={it} />
                                </View>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Respuesta correcta siempre visible para el docente */}
                        <View className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mt-1 gap-1">
                          <View className="flex-row items-center gap-1.5">
                            <Ionicons name="checkmark-circle" size={14} color="#059669" />
                            <Text className="text-[10px] font-extrabold text-emerald-800 uppercase">
                              Respuesta correcta
                            </Text>
                          </View>
                          {respuestaFallback ? (
                            <MarkdownContent texto={respuestaFallback} />
                          ) : (
                            <Text className="text-xs text-emerald-700 italic">
                              Sin clave registrada en esta pregunta. Puedes usar "Corregir" para regenerarla con su respuesta.
                            </Text>
                          )}
                          {pregunta.criterio_evaluacion_md ? (
                            <View className="mt-1.5 pt-1.5 border-t border-emerald-200/70">
                              <Text className="text-[10px] font-bold text-emerald-700 uppercase mb-0.5">
                                Criterio de evaluación
                              </Text>
                              <MarkdownContent texto={pregunta.criterio_evaluacion_md} />
                            </View>
                          ) : null}
                        </View>
                      </View>
                    )}

                    {/* Campo de corrección y regeneración puntual */}
                    {showRejectBox && !isRegen && (
                      <View className="mt-2 pt-3 border-t border-amber-200 gap-2">
                        <Text className="text-xs font-bold text-amber-900">
                          Indicaciones para regenerar esta pregunta:
                        </Text>
                        <TextInput
                          value={rejectDrafts[pregunta.id] ?? pregunta.comentario ?? ''}
                          onChangeText={(txt) =>
                            setRejectDrafts((prev) => ({ ...prev, [pregunta.id]: txt }))
                          }
                          placeholder="Ej. Hazla más práctica con números enteros pequeños o cambia el enfoque al teorema principal..."
                          multiline
                          numberOfLines={2}
                          className="bg-white border border-amber-300 rounded-xl p-2.5 text-xs text-gray-800 min-h-[64px]"
                        />
                        <View className="flex-row justify-end gap-2">
                          <TouchableOpacity
                            onPress={() => setOpenRejectId(null)}
                            className="px-3 py-2 rounded-xl bg-gray-100"
                          >
                            <Text className="text-xs font-semibold text-gray-600">Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => void handleRegenerateQuestion(pregunta)}
                            className="px-4 py-2 rounded-xl bg-maroon flex-row items-center gap-1.5"
                          >
                            <Ionicons name="refresh" size={14} color="#FFFFFF" />
                            <Text className="text-xs font-bold text-white">
                              Regenerar pregunta
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Footer de aprobación final */}
            <View className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex-row flex-wrap items-center justify-between gap-3">
              <Text className="text-xs text-gray-600 font-medium">
                {todasAprobadas
                  ? 'Todas las preguntas están aprobadas. Ya puedes generar el PDF institucional.'
                  : `Aprueba todas las preguntas para habilitar la generación del PDF (${aprobadasReview}/${totalPreguntasReview}).`}
              </Text>
              <TouchableOpacity
                onPress={() => void handleFinalizePdf()}
                disabled={!todasAprobadas || finalizingPdf}
                className={`px-5 py-2.5 rounded-xl flex-row items-center gap-2 ${
                  todasAprobadas && !finalizingPdf ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
              >
                {finalizingPdf ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="document-text" size={16} color="#FFFFFF" />
                )}
                <Text className="text-xs font-extrabold text-white">
                  {finalizingPdf ? 'Generando PDF…' : 'Finalizar y Generar PDF'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: VISOR PDF EMBEBIDO */}
      <Modal visible={Boolean(pdfModal)} transparent animationType="fade" onRequestClose={closePdfModal}>
        <View className="flex-1 bg-black/60 justify-center items-center p-4">
          <View className="bg-white rounded-3xl w-full max-w-5xl h-[90%] overflow-hidden shadow-2xl">
            <View className="bg-maroon px-5 py-3.5 flex-row items-center justify-between">
              <Text className="text-white font-bold text-sm flex-1 mr-3" numberOfLines={1}>
                {pdfModal?.title}
              </Text>
              <TouchableOpacity
                onPress={closePdfModal}
                className="w-8 h-8 rounded-full bg-white/15 items-center justify-center"
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View className="flex-1 bg-gray-100">
              {Platform.OS === 'web' && pdfModal?.url ? (
                <iframe
                  src={pdfModal.url}
                  title={pdfModal.title}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
