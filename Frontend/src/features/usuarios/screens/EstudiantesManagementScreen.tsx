import React, { useEffect, useMemo, useState, type ComponentProps } from 'react';
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
import { BentoCard } from '../../../displays/components/BentoCard';
import { StatusBadge } from '../../../displays/components/StatusBadge';
import { Pagination } from '../../../displays/components/Pagination';
import { useUsuariosList } from '../../../hooks/useUsuarios';
import { usuariosApi } from '../../../api/usuarios.api';
import { connectUsersWebSocket } from '../../../api/users.websocket';
import { useAuth } from '../../../context/AuthContext';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { DocumentInput } from '../components/DocumentInput';
import { BajaConfirmModal } from '../components/BajaConfirmModal';
import { ConfirmDeleteModal } from '../../../displays/components/ConfirmDeleteModal';
import { ProfilePhotoPicker } from '../components/ProfilePhotoPicker';
import { UserAvatar } from '../../../shared/ui';
import { numeroGrado } from '../../academico/utils/niveles';
import { generateStudentEmail, generateUsername } from '../../../utils/usernameGenerator';
import { getFullName, isUsuarioActivo } from '../../../utils/validation';
import { academicServicesApi } from '../../../api/academicServices.api';
import type {
  CreateUsuarioPayload,
  EstadoUsuario,
  UpdateUsuarioPayload,
  Usuario,
  UsuarioDoc,
} from '../../../types';

const TUTOR_REQUIRED_DOCS = ['CI'];
const STUDENT_REQUIRED_DOCS = ['CI', 'RUDE'];

const emptyTutorForm = {
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  nacimiento: '',
  genero: 'masculino' as const,
  ci: '',
  celular: '',
  email: '',
  zona: '',
  distrito: '',
  calle: '',
  numero: '',
  referencia: '',
  parentesco: 'Padre',
};

const emptyStudentForm: {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nacimiento: string;
  genero: 'masculino' | 'femenino';
  username: string;
  email: string;
  zona: string;
  distrito: string;
  calle: string;
  numero: string;
  referencia: string;
} = {
  nombre: '',
  apellidoPaterno: '',
  apellidoMaterno: '',
  nacimiento: '',
  genero: 'masculino',
  username: '',
  email: '',
  zona: '',
  distrito: '',
  calle: '',
  numero: '',
  referencia: '',
};

function InlineInput({
  error,
  className = '',
  numericOnly = false,
  maxLength,
  onChangeText,
  ...props
}: ComponentProps<typeof TextInput> & {
  error?: string;
  numericOnly?: boolean;
}) {
  const handleChangeText = (v: string) => {
    if (numericOnly) {
      const filtered = v.replace(/\D/g, '');
      if (onChangeText) onChangeText(filtered);
    } else {
      if (onChangeText) onChangeText(v);
    }
  };

  return (
    <View className="flex-1 min-w-[150px]">
      <TextInput
        {...props}
        maxLength={maxLength}
        keyboardType={numericOnly ? 'numeric' : props.keyboardType}
        onChangeText={handleChangeText}
        className={`bg-white rounded-xl px-3 py-2.5 border text-sm ${
          error ? 'border-red-500 bg-red-50/20' : 'border-gray-200'
        } ${className}`}
      />
      {error ? <Text className="text-xs text-red-600 mt-1 font-medium">{error}</Text> : null}
    </View>
  );
}

export function EstudiantesManagementScreen() {
  const { user } = useAuth();
  const userRol = user?.rol?.toLowerCase() ?? '';
  const canEdit = ['director', 'control', 'gerencia', 'admin', 'administrador', 'administrativo', 'editor', 'secretaria', 'secretario'].includes(userRol);

  const { data, loading, error, fetchAll } = useUsuariosList();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EstadoUsuario | undefined>(undefined);

  // ── Filtros de Estudiantes ──
  const [selectedLevel, setSelectedLevel] = useState<'primaria' | 'secundaria'>('primaria');
  const [selectedGrado, setSelectedGrado] = useState<string>('all');
  const [selectedParalelo, setSelectedParalelo] = useState<string>('all');

  const [cursosPeriodo, setCursosPeriodo] = useState<Array<any>>([]);
  const [inscripciones, setInscripciones] = useState<Array<any>>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal de Creación / Edición
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingStudent, setEditingStudent] = useState<Usuario | null>(null);
  const [editingTutorId, setEditingTutorId] = useState<string | null>(null);
  const [editTab, setEditTab] = useState<'student' | 'tutor'>('student');

  // Estado para el Paso 3: Inscripción de estudiante
  const [modalNivelInscripcion, setModalNivelInscripcion] = useState<'primaria' | 'secundaria'>('primaria');
  const [modalSelectedCursoId, setModalSelectedCursoId] = useState<string>('');
  const [fechaInscripcion, setFechaInscripcion] = useState<string>(new Date().toISOString().slice(0, 10));
  const [tipoObservacion, setTipoObservacion] = useState<'Sin observación' | 'Debe entregar documentos' | 'Otros'>('Sin observación');
  const [observacionManual, setObservacionManual] = useState<string>('');

  const [tutorForm, setTutorForm] = useState(emptyTutorForm);
  const [tutorDocs, setTutorDocs] = useState<UsuarioDoc[]>([{ tipoDoc: 'CI', numeroDoc: '' }]);
  const [tutorPhoto, setTutorPhoto] = useState<string | undefined>(undefined);
  const [createdTutorId, setCreatedTutorId] = useState<string | null>(null);
  const [tutorSummary, setTutorSummary] = useState<string | null>(null);

  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [studentDocs, setStudentDocs] = useState<UsuarioDoc[]>([
    { tipoDoc: 'CI', numeroDoc: '' },
    { tipoDoc: 'RUDE', numeroDoc: '' },
  ]);
  const [studentPhoto, setStudentPhoto] = useState<string | undefined>(undefined);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<Usuario | null>(null);
  const [selectedTutorDetail, setSelectedTutorDetail] = useState<Usuario | null>(null);
  const [loadingStudentDetail, setLoadingStudentDetail] = useState(false);
  const [bajaTarget, setBajaTarget] = useState<Usuario | null>(null);
  const [bajaLoading, setBajaLoading] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<Usuario | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleConfirmDeleteStudent = async () => {
    if (!deletingStudent) return;
    setDeleteLoading(true);
    try {
      await usuariosApi.delete(deletingStudent.id);
      Alert.alert('Éxito', 'Estudiante eliminado permanentemente.');
      setDeletingStudent(null);
      if (selectedStudentDetail?.id === deletingStudent.id) {
        setSelectedStudentDetail(null);
      }
      refresh();
    } catch (err: any) {
      Alert.alert('Error al eliminar', err?.message || 'No se pudo eliminar el estudiante.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Cargar cursos e inscripciones
  const loadCursosAndInscripciones = async () => {
    try {
      setLoadingCursos(true);
      const [cpRes, insRes] = await Promise.all([
        academicServicesApi.listAll('cursos-periodo', { estado: 'activo' }),
        academicServicesApi.listAll('inscripciones'),
      ]);
      setCursosPeriodo(cpRes || []);
      setInscripciones(insRes || []);
    } catch (e) {
      console.warn('Error cargando estructura académica:', e);
    } finally {
      setLoadingCursos(false);
    }
  };

  useEffect(() => {
    loadCursosAndInscripciones();
  }, []);

  const refresh = () => {
    fetchAll({ buscar: search, estado: statusFilter }).catch(() => undefined);
    loadCursosAndInscripciones();
  };

  useEffect(() => {
    refresh();
    return connectUsersWebSocket(refresh);
  }, [search, statusFilter]);

  // Mapeo de inscripciones y cursos por estudiante
  const { inscripcionesMap, studentCourseMap } = useMemo(() => {
    const map: Record<string, number> = {};
    const studentIdsByCurso: Record<string, Set<string>> = {};
    const stCourseMap: Record<string, { cpId: string; cursoLabel: string; nivel: string; grado: string; paralelo: string }> = {};

    for (const ins of inscripciones) {
      if (ins.estado !== 'retirado') {
        const cpId = String(ins.cursoPeriodoId || ins.curso_periodo_id || '');
        const stId = String(ins.estudiante?.usuarioId || ins.estudianteId || ins.usuarioId || '');
        const cp = cursosPeriodo.find((c) => String(c.id) === cpId);

        if (cpId) {
          map[cpId] = (map[cpId] || 0) + 1;
          if (!studentIdsByCurso[cpId]) studentIdsByCurso[cpId] = new Set();
          if (stId) studentIdsByCurso[cpId].add(stId);
        }

        if (stId && cp) {
          const nivel = String(cp.curso?.nivel || cp.nivel || '').toLowerCase();
          const grado = String(cp.curso?.grado || cp.grado || '');
          const paralelo = String(cp.curso?.paralelo || cp.paralelo || '');
          stCourseMap[stId] = {
            cpId,
            cursoLabel: `${grado} "${paralelo}"`,
            nivel,
            grado,
            paralelo,
          };
        }
      }
    }
    return { inscripcionesMap: { countMap: map, studentIdsByCurso }, studentCourseMap: stCourseMap };
  }, [inscripciones, cursosPeriodo]);

  // Grados disponibles según nivel seleccionado
  const availableGrados = useMemo(() => {
    const set = new Set<string>();
    cursosPeriodo.forEach((cp) => {
      const c = cp.curso ?? {};
      const nivel = String(c.nivel ?? cp.nivel ?? '').toLowerCase();
      const grado = String(c.grado ?? cp.grado ?? '').trim();
      if (!grado) return;
      if (selectedLevel === 'primaria' && !(nivel.includes('primaria') || nivel.includes('inicial'))) return;
      if (selectedLevel === 'secundaria' && !(nivel.includes('secundaria') || nivel.includes('bachill'))) return;
      set.add(grado);
    });
    return Array.from(set).sort((a, b) => {
      const na = numeroGrado(a) ?? 99;
      const nb = numeroGrado(b) ?? 99;
      if (na !== nb) return na - nb;
      return a.localeCompare(b);
    });
  }, [cursosPeriodo, selectedLevel]);

  // Paralelos disponibles según nivel y grado seleccionado
  const availableParalelos = useMemo(() => {
    const set = new Set<string>();
    cursosPeriodo.forEach((cp) => {
      const c = cp.curso ?? {};
      const nivel = String(c.nivel ?? cp.nivel ?? '').toLowerCase();
      const grado = String(c.grado ?? cp.grado ?? '').trim();
      const paralelo = String(c.paralelo ?? cp.paralelo ?? '').trim().toUpperCase();
      if (!paralelo) return;
      if (selectedLevel === 'primaria' && !(nivel.includes('primaria') || nivel.includes('inicial'))) return;
      if (selectedLevel === 'secundaria' && !(nivel.includes('secundaria') || nivel.includes('bachill'))) return;
      if (selectedGrado !== 'all' && grado !== selectedGrado) return;
      set.add(paralelo);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cursosPeriodo, selectedLevel, selectedGrado]);

  // Estudiantes filtrados por nivel, grado, paralelo, estado y búsqueda
  const filteredStudents = useMemo(() => {
    const students = (data?.data ?? []).filter((u: Usuario) => {
      const rol = (u.rol || (u as any).rol_nombre || '').toLowerCase();
      return rol.includes('estudiante') || rol.includes('alumno');
    });

    return students.filter((st) => {
      if (statusFilter !== undefined && st.estado !== statusFilter) return false;

      const courseInfo = studentCourseMap[String(st.id)];
      const studentNivel = (courseInfo?.nivel || (st as any).nivel || '').toLowerCase();

      const isPrimaria = studentNivel.includes('primaria') || studentNivel.includes('inicial');
      const isSecundaria = studentNivel.includes('secundaria') || studentNivel.includes('bachill');

      if (selectedLevel === 'primaria') {
        if (courseInfo && !isPrimaria) return false;
        if (!courseInfo && (st as any).nivel && isSecundaria) return false;
      } else {
        if (courseInfo && !isSecundaria) return false;
        if (!courseInfo && (st as any).nivel && isPrimaria) return false;
      }

      if (selectedGrado !== 'all') {
        if (!courseInfo || courseInfo.grado !== selectedGrado) return false;
      }

      if (selectedParalelo !== 'all') {
        if (!courseInfo || courseInfo.paralelo.toUpperCase() !== selectedParalelo.toUpperCase()) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const fullName = `${st.nombre} ${st.apellidoPaterno || ''} ${st.apellidoMaterno || ''}`.toLowerCase();
        const docs = (st.documentos ?? []).map((d) => (d.numeroDoc || (d as any).numero_doc || '').toLowerCase());
        const userCode = (st.username || '').toLowerCase();
        const matches = fullName.includes(q) || userCode.includes(q) || docs.some((doc) => doc.includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [data, statusFilter, selectedLevel, selectedGrado, selectedParalelo, studentCourseMap, search]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const resetForms = () => {
    setFieldErrors({});
    setStep(1);
    setEditingStudent(null);
    setEditingTutorId(null);
    setEditTab('student');
    setCreatedTutorId(null);
    setTutorSummary(null);
    setTutorForm(emptyTutorForm);
    setTutorDocs([{ tipoDoc: 'CI', numeroDoc: '' }]);
    setTutorPhoto(undefined);
    setStudentForm(emptyStudentForm);
    setStudentDocs([
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'RUDE', numeroDoc: '' },
    ]);
    setStudentPhoto(undefined);
    setModalSelectedCursoId('');
  };

  const clearFieldError = (key: string) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validateTutor = () => {
    const errors: Record<string, string> = {};
    if (!tutorForm.nombre.trim()) errors.tutorNombre = 'El nombre es obligatorio.';
    if (!tutorForm.apellidoPaterno.trim()) errors.tutorApellidoPaterno = 'El apellido paterno es obligatorio.';
    if (!tutorForm.nacimiento) errors.tutorNacimiento = 'La fecha de nacimiento es obligatoria.';
    const ciDoc = tutorDocs.find((d) => d.tipoDoc === 'CI');
    if (!ciDoc?.numeroDoc?.trim()) errors['documento:CI'] = 'El CI del tutor es obligatorio.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStudent = () => {
    const errors: Record<string, string> = {};
    if (!studentForm.nombre.trim()) errors.studentNombre = 'El nombre es obligatorio.';
    if (!studentForm.apellidoPaterno.trim()) errors.studentApellidoPaterno = 'El apellido paterno es obligatorio.';
    if (!studentForm.nacimiento) errors.studentNacimiento = 'La fecha de nacimiento es obligatoria.';
    const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI');
    const rudeDoc = studentDocs.find((d) => d.tipoDoc === 'RUDE');
    if (!ciDoc?.numeroDoc?.trim()) errors['documento:CI'] = 'El CI es obligatorio.';
    if (!rudeDoc?.numeroDoc?.trim()) errors['documento:RUDE'] = 'El RUDE es obligatorio.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const applyServerFieldErrors = (err: any, prefix: 'student' | 'tutor') => {
    const field = err?.field || '';
    const message = err instanceof Error ? err.message : err?.error || err?.message || 'No se pudo guardar la información.';
    const errors: Record<string, string> = {};

    if (field === 'username' || /username|usuario/.test(message.toLowerCase())) {
      if (prefix === 'student') errors.studentUsername = 'Este nombre de usuario ya está registrado.';
      else errors['documento:CI'] = 'Ya existe un usuario con este documento.';
    }
    if (field === 'email' || /email|correo/.test(message.toLowerCase())) {
      errors[`${prefix}Email`] = 'Este correo institucional ya está registrado.';
    }
    if (field === 'numeroDoc' || /numero_doc|documento/.test(message.toLowerCase())) {
      errors['documento:CI'] = 'Este número de documento ya se encuentra registrado.';
    }

    if (Object.keys(errors).length) setFieldErrors(errors);
    return { message, handled: Object.keys(errors).length > 0 };
  };

  // Autogenerar username limpio
  const handleAutoFillStudentUsername = (
    nombre: string,
    paterno: string,
    materno: string,
    ci: string,
  ) => {
    if (!editingStudent) {
      const generated = generateUsername(nombre, paterno, materno, ci);
      if (generated) {
        setStudentForm((f) => ({
          ...f,
          username: generated,
          email: generateStudentEmail(generated),
        }));
      }
    }
  };

  const handleSaveTutor = async () => {
    if (!validateTutor()) return;
    const ciDoc = tutorDocs.find((d) => d.tipoDoc === 'CI');

    setSaving(true);
    try {
      const payload: CreateUsuarioPayload = {
        rolId: '5',
        rol: 'apoderado',
        nombre: tutorForm.nombre.trim(),
        apellidoPaterno: tutorForm.apellidoPaterno.trim(),
        apellidoMaterno: tutorForm.apellidoMaterno.trim() || undefined,
        nacimiento: tutorForm.nacimiento,
        genero: tutorForm.genero,
        documentos: tutorDocs,
        contactos: tutorForm.celular ? [{ tipo: 'Celular', contenido: tutorForm.celular }] : [],
        direccion: tutorForm.zona
          ? {
              zona: tutorForm.zona,
              distrito: tutorForm.distrito || undefined,
              calle: tutorForm.calle || undefined,
              numero: tutorForm.numero || undefined,
              referencia: tutorForm.referencia || undefined,
            }
          : undefined,
      };

      const res = await usuariosApi.createWithFiles(payload, tutorPhoto);
      setCreatedTutorId(res.id);
      setTutorSummary(`${tutorForm.nombre} ${tutorForm.apellidoPaterno} (CI: ${ciDoc?.numeroDoc ?? ''})`);

      setStudentForm((prev) => ({
        ...prev,
        apellidoPaterno: prev.apellidoPaterno || tutorForm.apellidoPaterno,
        zona: tutorForm.zona,
        distrito: tutorForm.distrito,
        calle: tutorForm.calle,
        numero: tutorForm.numero,
        referencia: tutorForm.referencia,
      }));

      setStep(2);
    } catch (err) {
      const result = applyServerFieldErrors(err, 'tutor');
      if (!result.handled) Alert.alert('Error al registrar tutor', result.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStudent = async () => {
    if (!validateStudent()) return;
    const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI');


    if (editingStudent) {
      await executeSaveStudent();
    } else {
      setStep(3);
    }
  };

  const executeSaveStudent = async () => {
    setSaving(true);
    try {
      if (editingStudent) {
        const tutorCi = tutorDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc || tutorForm.ci || '';
        const updatePayload: UpdateUsuarioPayload & { apoderado?: any; parentesco?: string } = {
          nombre: studentForm.nombre.trim(),
          apellidoPaterno: studentForm.apellidoPaterno.trim(),
          apellidoMaterno: studentForm.apellidoMaterno.trim() || undefined,
          nacimiento: studentForm.nacimiento,
          genero: studentForm.genero,
          documentos: studentDocs,
          direccion: studentForm.zona
            ? {
                zona: studentForm.zona,
                distrito: studentForm.distrito || undefined,
                calle: studentForm.calle || undefined,
                numero: studentForm.numero || undefined,
                referencia: studentForm.referencia || undefined,
              }
            : undefined,
          parentesco: tutorForm.parentesco || 'Padre',
          apoderado: {
            nombre: tutorForm.nombre.trim(),
            apellidoPaterno: tutorForm.apellidoPaterno.trim(),
            apellidoMaterno: tutorForm.apellidoMaterno.trim() || undefined,
            ci: tutorCi.trim(),
            celular: tutorForm.celular.trim(),
            parentesco: tutorForm.parentesco || 'Padre',
          },
        };
        await usuariosApi.updateWithFiles(editingStudent.id, updatePayload as any, studentPhoto);
        Alert.alert('¡Actualizado!', 'Datos del estudiante y su tutor actualizados correctamente.');
        setShowModal(false);
        resetForms();
        refresh();
      }
    } catch (err) {
      const result = applyServerFieldErrors(err, 'student');
      if (!result.handled) Alert.alert('Error', result.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalizeRegistration = async () => {
    if (!modalSelectedCursoId) {
      Alert.alert('Curso requerido', 'Por favor seleccione el curso para la inscripción del estudiante.');
      return;
    }

    setSaving(true);
    try {
      const createPayload: CreateUsuarioPayload = {
        rolId: '3',
        rol: 'estudiante',
        nombre: studentForm.nombre.trim(),
        apellidoPaterno: studentForm.apellidoPaterno.trim(),
        apellidoMaterno: studentForm.apellidoMaterno.trim() || undefined,
        nacimiento: studentForm.nacimiento,
        genero: studentForm.genero,
        documentos: studentDocs,
        direccion: studentForm.zona
          ? {
              zona: studentForm.zona,
              distrito: studentForm.distrito || undefined,
              calle: studentForm.calle || undefined,
              numero: studentForm.numero || undefined,
              referencia: studentForm.referencia || undefined,
            }
          : undefined,
        apoderadoId: createdTutorId || undefined,
        parentesco: tutorForm.parentesco || 'Padre',
      };

      const res = await usuariosApi.createWithFiles(createPayload, studentPhoto);

      // Inscribir automáticamente al estudiante en el curso
      const obsFinal = tipoObservacion === 'Otros' ? observacionManual : tipoObservacion;
      await academicServicesApi.create('inscripciones', {
        estudianteId: res.id,
        cursoPeriodoId: modalSelectedCursoId,
        fechaInscripcion,
        observacion: obsFinal,
        estado: 'activo',
      });

      Alert.alert('¡Registro Exitoso!', 'El estudiante y su tutor han sido registrados e inscritos en el curso.');
      setShowModal(false);
      resetForms();
      refresh();
    } catch (err) {
      const result = applyServerFieldErrors(err, 'student');
      if (!result.handled) Alert.alert('Error en inscripción', result.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (st: Usuario) => {
    setEditingStudent(st);
    setEditTab('student');
    setStudentForm({
      nombre: st.nombre ?? '',
      apellidoPaterno: st.apellidoPaterno || (st as any).apellido_paterno || '',
      apellidoMaterno: st.apellidoMaterno || (st as any).apellido_materno || '',
      nacimiento: (st.nacimiento ? String(st.nacimiento).slice(0, 10) : ''),
      genero: (st.genero as 'masculino' | 'femenino') === 'femenino' ? 'femenino' : 'masculino',
      username: st.username ?? '',
      email: st.email ?? '',
      zona: st.direccion?.zona ?? '',
      distrito: st.direccion?.distrito ?? '',
      calle: st.direccion?.calle ?? '',
      numero: st.direccion?.numero ?? '',
      referencia: st.direccion?.referencia ?? '',
    });
    setStudentDocs(st.documentos && st.documentos.length > 0 ? st.documentos : [
      { tipoDoc: 'CI', numeroDoc: '' },
      { tipoDoc: 'RUDE', numeroDoc: '' },
    ]);
    setStudentPhoto(st.fotoUrl || undefined);

    // Cargar datos de tutor vinculado para permitir edición completa
    try {
      const full = await usuariosApi.getById(st.id);
      const apod = full.apoderados?.[0];
      if (apod) {
        setTutorForm({
          nombre: apod.nombre ?? '',
          apellidoPaterno: apod.apellidoPaterno ?? '',
          apellidoMaterno: apod.apellidoMaterno ?? '',
          nacimiento: '',
          genero: 'masculino',
          ci: (apod as any).ci ?? '',
          celular: (apod as any).celular ?? (apod as any).telefono ?? '',
          email: '',
          zona: '',
          distrito: '',
          calle: '',
          numero: '',
          referencia: '',
          parentesco: apod.parentesco ?? 'Padre',
        });
        setTutorDocs([{ tipoDoc: 'CI', numeroDoc: (apod as any).ci ?? '' }]);
        setTutorSummary(`${apod.nombre ?? ''} ${apod.apellidoPaterno ?? ''} (${apod.parentesco ?? 'Tutor'})`.trim());
      } else {
        setTutorForm(emptyTutorForm);
        setTutorDocs([{ tipoDoc: 'CI', numeroDoc: '' }]);
        setTutorSummary(null);
      }
    } catch {
      setTutorForm(emptyTutorForm);
    }

    setStep(2);
    setShowModal(true);
  };

  const handleToggleState = async (st: Usuario) => {
    if (isUsuarioActivo(st.estado)) {
      setBajaTarget(st);
    } else {
      try {
        await usuariosApi.update(st.id, { estado: 'activo' });
        refresh();
      } catch {
        Alert.alert('Error', 'No se pudo activar al estudiante');
      }
    }
  };

  const confirmBaja = async () => {
    if (!bajaTarget) return;
    setBajaLoading(true);
    try {
      await usuariosApi.baja(bajaTarget.id);
      setBajaTarget(null);
      refresh();
    } catch {
      Alert.alert('Error', 'No se pudo procesar la baja');
    } finally {
      setBajaLoading(false);
    }
  };

  const handleViewStudent = async (st: Usuario) => {
    setSelectedStudentDetail(st);
    setSelectedTutorDetail(null);
    setLoadingStudentDetail(true);
    try {
      const fullStudent = await usuariosApi.getById(st.id);
      setSelectedStudentDetail(fullStudent);
      const apoderados = fullStudent.apoderados ?? [];
      const tutorRel = apoderados[0];
      const tutorUserId = (tutorRel as any)?.usuarioId || (tutorRel as any)?.apoderadoId;
      if (tutorUserId) {
        const tutorUser = await usuariosApi.getById(tutorUserId);
        setSelectedTutorDetail(tutorUser);
      }
    } catch {
      // Ignorar fallback
    } finally {
      setLoadingStudentDetail(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-cream/30 p-4 md:p-6" contentContainerStyle={{ gap: 20, minWidth: 0 }}>
      {/* Cabecera Principal */}
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-1 min-w-0">
          <Text className="text-2xl font-black text-gray-900">Control Estudiantil</Text>
          <Text className="text-sm text-gray-500 mt-0.5">
            Navegación en cascada por Niveles, Cursos y Paralelos
          </Text>
        </View>

        {canEdit && (
          <TouchableOpacity
            onPress={() => {
              resetForms();
              setShowModal(true);
            }}
            className="bg-maroon hover:bg-maroon/90 px-4 py-3 rounded-2xl flex-row items-center gap-2 shadow-md"
          >
            <Ionicons name="person-add" size={18} color="#FFFFFF" />
            <Text className="text-white font-bold text-sm">Nuevo Estudiante</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── BARRA DE FILTROS Y SELECTS ESTRUCTURADOS ── */}
      <BentoCard className="p-4 bg-white border border-gray-100 shadow-sm gap-4">
        {/* Fila 1: Búsqueda y Selector de Nivel */}
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          {/* Buscador */}
          <View className="flex-1 min-w-[240px] max-w-lg flex-row items-center bg-gray-100 rounded-xl px-3.5 py-2.5 border border-gray-200">
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                setCurrentPage(1);
              }}
              placeholder="Buscar por nombre, CI, RUDE o username..."
              className="flex-1 ml-2 text-xs text-gray-800"
              placeholderTextColor="#9CA3AF"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Selector de Nivel (Primaria / Secundaria) */}
          <View className="flex-row items-center bg-gray-100 p-1 rounded-xl gap-1">
            <TouchableOpacity
              onPress={() => {
                setSelectedLevel('primaria');
                setSelectedGrado('all');
                setSelectedParalelo('all');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg flex-row items-center gap-1.5 transition-all ${
                selectedLevel === 'primaria' ? 'bg-maroon shadow-sm' : ''
              }`}
            >
              <Ionicons
                name="school-outline"
                size={14}
                color={selectedLevel === 'primaria' ? '#FFFFFF' : '#4B5563'}
              />
              <Text className={`text-xs font-bold ${selectedLevel === 'primaria' ? 'text-white' : 'text-gray-600'}`}>
                Primaria
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setSelectedLevel('secundaria');
                setSelectedGrado('all');
                setSelectedParalelo('all');
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg flex-row items-center gap-1.5 transition-all ${
                selectedLevel === 'secundaria' ? 'bg-maroon shadow-sm' : ''
              }`}
            >
              <Ionicons
                name="ribbon-outline"
                size={14}
                color={selectedLevel === 'secundaria' ? '#FFFFFF' : '#4B5563'}
              />
              <Text className={`text-xs font-bold ${selectedLevel === 'secundaria' ? 'text-white' : 'text-gray-600'}`}>
                Secundaria
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Fila 2: Selects estructurados de Grados y Paralelos */}
        <View className="pt-3 border-t border-gray-100 flex-row flex-wrap items-center justify-between gap-3">
          {/* Select de Grados */}
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-1">Grado:</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedGrado('all');
                setSelectedParalelo('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg border ${
                selectedGrado === 'all'
                  ? 'bg-maroon border-maroon'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${selectedGrado === 'all' ? 'text-white' : 'text-gray-700'}`}>
                Todos
              </Text>
            </TouchableOpacity>

            {availableGrados.map((grado) => {
              const isSelected = selectedGrado === grado;
              return (
                <TouchableOpacity
                  key={grado}
                  onPress={() => {
                    setSelectedGrado(grado);
                    setSelectedParalelo('all');
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg border ${
                    isSelected ? 'bg-maroon border-maroon' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                    {grado}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Select de Paralelos (dinámico) */}
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mr-1">Paralelo:</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedParalelo('all');
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg border ${
                selectedParalelo === 'all'
                  ? 'bg-maroon border-maroon'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${selectedParalelo === 'all' ? 'text-white' : 'text-gray-700'}`}>
                Todos
              </Text>
            </TouchableOpacity>

            {availableParalelos.map((paralelo) => {
              const isSelected = selectedParalelo === paralelo;
              return (
                <TouchableOpacity
                  key={paralelo}
                  onPress={() => {
                    setSelectedParalelo(paralelo);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg border ${
                    isSelected ? 'bg-maroon border-maroon' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                    Paralelo {paralelo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Filtro de Estado */}
          <View className="flex-row items-center gap-1.5 ml-auto">
            <TouchableOpacity
              onPress={() => {
                setStatusFilter(undefined);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs ${
                statusFilter === undefined ? 'bg-gray-800 border-gray-800' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${statusFilter === undefined ? 'text-white' : 'text-gray-600'}`}>
                Todos ({filteredStudents.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setStatusFilter(1);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs ${
                statusFilter === 1 ? 'bg-green-700 border-green-700' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${statusFilter === 1 ? 'text-white' : 'text-gray-600'}`}>
                Activos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setStatusFilter(0);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs ${
                statusFilter === 0 ? 'bg-red-700 border-red-700' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <Text className={`text-xs font-bold ${statusFilter === 0 ? 'text-white' : 'text-gray-600'}`}>
                Inactivos
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BentoCard>

      {/* ── NÓMINA DE ESTUDIANTES EN CARTAS (GRID RESPONSIVO) ── */}
      <BentoCard className="p-4 bg-white border border-gray-100 shadow-sm">
        {loading ? (
          <View className="py-16 items-center justify-center">
            <ActivityIndicator size="large" color="#801529" />
            <Text className="text-xs text-gray-500 mt-3 font-medium">Cargando estudiantes...</Text>
          </View>
        ) : paginatedStudents.length === 0 ? (
          <View className="py-16 items-center justify-center bg-gray-50 rounded-2xl">
            <Ionicons name="school-outline" size={48} color="#D1D5DB" />
            <Text className="text-base font-bold text-gray-700 mt-3">No se encontraron estudiantes</Text>
            <Text className="text-xs text-gray-400 mt-1 max-w-xs text-center">
              No hay alumnos registrados que coincidan con los filtros seleccionados.
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap -mx-2 min-w-0">
            {paginatedStudents.map((st) => {
              const docs = st.documentos ?? [];
              const ciDoc = docs.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc ??
                (docs.find((d) => (d as any).tipo_doc === 'CI') as any)?.numero_doc ?? 'Sin CI';
              const rudeDoc = docs.find((d) => d.tipoDoc === 'RUDE' || (d as any).tipo_doc === 'RUDE')?.numeroDoc ??
                (docs.find((d) => (d as any).tipo_doc === 'RUDE') as any)?.numero_doc;
              const apPat = st.apellidoPaterno || (st as any).apellido_paterno || '';
              const apMat = st.apellidoMaterno || (st as any).apellido_materno || '';
              const stFullName = getFullName(st.nombre, apPat, apMat);
              const isActivo = isUsuarioActivo(st.estado);

              return (
                <View key={st.id} className="w-full md:w-1/2 lg:w-1/3 p-2 min-w-0">
                  <BentoCard className="p-4 bg-white border border-gray-100 hover:border-maroon/30 transition-all flex-col justify-between h-full shadow-sm hover:shadow-md overflow-hidden">
                    <View className="min-w-0">
                      <View className="flex-row items-start justify-between mb-3.5">
                        <View className="relative">
                          <UserAvatar
                            nombre={st.nombre}
                            apellidoPaterno={apPat}
                            fotoUrl={st.fotoUrl}
                            className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-gold/40 shadow-sm"
                            textoClassName="text-gold font-bold text-xl"
                          />
                          <View
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                              isActivo ? 'bg-green-500' : 'bg-red-500'
                            }`}
                          />
                        </View>

                        <View className="items-end gap-1.5">
                          <View className="bg-maroon/10 border border-maroon/30 px-2 py-0.5 rounded-md">
                            <Text className="text-[10px] font-bold text-maroon">Estudiante</Text>
                          </View>
                          <StatusBadge status={st.estado} />
                        </View>
                      </View>

                      <Text className="font-bold text-gray-900 text-sm" numberOfLines={2}>
                        {stFullName}
                      </Text>
                      <Text className="text-xs font-mono text-maroon mt-0.5">
                        @{st.username || 'sin-cuenta'}
                      </Text>

                      <View className="flex-row items-center gap-1.5 mt-2 bg-maroon/5 border border-maroon/20 px-2.5 py-1 rounded-lg self-start">
                        <Ionicons name="school" size={12} color="#801529" />
                        <Text className="text-xs font-bold text-maroon">
                          {studentCourseMap[String(st.id)]
                            ? `${studentCourseMap[String(st.id)].cursoLabel} · ${studentCourseMap[String(st.id)].nivel.charAt(0).toUpperCase() + studentCourseMap[String(st.id)].nivel.slice(1)}`
                            : 'Sin curso asignado'}
                        </Text>
                      </View>

                      <View className="flex-row flex-wrap gap-1.5 mt-3">
                        <View className="bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                          <Text className="text-xs text-gray-700 font-mono">CI: {ciDoc}</Text>
                        </View>
                        {rudeDoc ? (
                          <View className="bg-gold/20 px-2.5 py-1 rounded-lg border border-gold/40">
                            <Text className="text-xs font-bold text-maroon font-mono">RUDE: {rudeDoc}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    <View className="flex-row flex-wrap items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                      <TouchableOpacity
                        onPress={() => handleViewStudent(st)}
                        className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl flex-row items-center gap-1.5"
                      >
                        <Ionicons name="eye-outline" size={15} color="#7A1F3D" />
                        <Text className="text-xs font-bold text-maroon">Ficha</Text>
                      </TouchableOpacity>

                      {canEdit && (
                        <>
                          <TouchableOpacity
                            onPress={() => handleEdit(st)}
                            className="p-2 bg-maroon/10 hover:bg-maroon/20 rounded-xl flex-row items-center gap-1.5"
                          >
                            <Ionicons name="create-outline" size={15} color="#7A1F3D" />
                            <Text className="text-xs font-bold text-maroon">Editar</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleToggleState(st)}
                            className="p-2 bg-gray-100 rounded-xl flex-row items-center gap-1.5"
                          >
                            <Ionicons
                              name={isActivo ? 'arrow-down-circle-outline' : 'checkmark-circle-outline'}
                              size={15}
                              color={isActivo ? '#DC2626' : '#16A34A'}
                            />
                            <Text
                              className={`text-xs font-semibold ${
                                isActivo ? 'text-red-600' : 'text-green-600'
                              }`}
                            >
                              {isActivo ? 'Baja' : 'Activar'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setDeletingStudent(st)}
                            className="p-2 bg-red-50 hover:bg-red-100 rounded-xl flex-row items-center gap-1.5"
                          >
                            <Ionicons name="trash-outline" size={15} color="#DC2626" />
                            <Text className="text-xs font-bold text-red-600">Eliminar</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </BentoCard>
                </View>
              );
            })}
          </View>
        )}

        {/* ── CONTROLES DE PAGINACIÓN ── */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={filteredStudents.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 20]}
          onPageChange={setCurrentPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setCurrentPage(1);
          }}
          className="mt-6"
        />
      </BentoCard>

      {/* ── MODAL DIALOG DE REGISTRO E INSCRIPCIÓN (3 PASOS) ── */}
      <Modal visible={showModal} animationType="fade" transparent onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-3 md:p-6">
          <View className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl flex-col">
            <View className="p-5 bg-maroon text-white flex-row items-center justify-between">
              <View>
                <Text className="text-lg font-bold text-white">
                  {editingStudent ? 'Editar Estudiante' : 'Registro de Nuevo Estudiante'}
                </Text>
                <Text className="text-xs text-white/80 mt-0.5">
                  {editingStudent
                    ? 'Actualización de datos personales y expediente'
                    : `Paso ${step} de 3: ${
                        step === 1 ? 'Datos del Tutor' : step === 2 ? 'Datos del Estudiante' : 'Inscripción a Curso'
                      }`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/20 items-center justify-center">
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5 max-h-[68vh]" contentContainerStyle={{ gap: 16 }}>
              {/* PASO 1: REGISTRO DEL TUTOR */}
              {step === 1 && (
                <View className="gap-4">
                  <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                    <Text className="text-xs font-bold text-maroon mb-3 uppercase">1. Fotografía del Tutor (MinIO)</Text>
                    <ProfilePhotoPicker photoUri={tutorPhoto} onChange={setTutorPhoto} required={false} />
                  </BentoCard>

                  <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                    <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Datos Personales del Tutor</Text>
                    <View className="flex-row flex-wrap gap-2">
                      <InlineInput
                        value={tutorForm.nombre}
                        onChangeText={(v) => { clearFieldError('tutorNombre'); setTutorForm((f) => ({ ...f, nombre: v })); }}
                        placeholder="Nombre *"
                        error={fieldErrors.tutorNombre}
                      />
                      <InlineInput
                        value={tutorForm.apellidoPaterno}
                        onChangeText={(v) => { clearFieldError('tutorApellidoPaterno'); setTutorForm((f) => ({ ...f, apellidoPaterno: v })); }}
                        placeholder="Apellido Paterno *"
                        error={fieldErrors.tutorApellidoPaterno}
                      />
                      <InlineInput
                        value={tutorForm.apellidoMaterno}
                        onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoMaterno: v }))}
                        placeholder="Apellido Materno"
                      />
                      <BirthDatePicker value={tutorForm.nacimiento} onChange={(v) => setTutorForm((f) => ({ ...f, nacimiento: v }))} />
                    </View>
                  </BentoCard>

                  <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                    <DocumentInput
                      documents={tutorDocs}
                      onChange={setTutorDocs}
                      requiredTypes={TUTOR_REQUIRED_DOCS}
                      title="Cédula de Identidad del Tutor *"
                      fieldErrors={fieldErrors}
                    />
                  </BentoCard>

                  <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                    <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Contacto y Parentesco</Text>
                    <View className="flex-row flex-wrap gap-2">
                      <InlineInput
                        value={tutorForm.celular}
                        numericOnly
                        maxLength={15}
                        onChangeText={(v) => setTutorForm((f) => ({ ...f, celular: v }))}
                        placeholder="Celular / WhatsApp (Sólo números)"
                      />
                      <InlineInput
                        value={tutorForm.parentesco}
                        onChangeText={(v) => setTutorForm((f) => ({ ...f, parentesco: v }))}
                        placeholder="Parentesco (Padre, Madre, Tutor...)"
                      />
                    </View>
                  </BentoCard>

                  <TouchableOpacity
                    onPress={handleSaveTutor}
                    disabled={saving}
                    className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
                  >
                    {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Text className="text-white font-bold text-sm">Guardar Tutor y Continuar</Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* PASO 2: DATOS DEL ESTUDIANTE Y TUTOR */}
              {step === 2 && (
                <View className="gap-4">
                  {/* Selector de Pestañas en Modo Edición */}
                  {editingStudent && (
                    <View className="flex-row gap-2 bg-gray-100 p-1 rounded-2xl">
                      <TouchableOpacity
                        onPress={() => setEditTab('student')}
                        className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-2 ${
                          editTab === 'student' ? 'bg-white shadow-sm' : ''
                        }`}
                      >
                        <Ionicons
                          name="school"
                          size={16}
                          color={editTab === 'student' ? '#801529' : '#6B7280'}
                        />
                        <Text
                          numberOfLines={2}
                          ellipsizeMode="tail"
                          className={`text-xs font-bold flex-1 min-w-0 ${
                            editTab === 'student' ? 'text-maroon' : 'text-gray-600'
                          }`}
                        >
                          1. Datos Estudiante
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setEditTab('tutor')}
                        className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-2 ${
                          editTab === 'tutor' ? 'bg-white shadow-sm' : ''
                        }`}
                      >
                        <Ionicons
                          name="people"
                          size={16}
                          color={editTab === 'tutor' ? '#801529' : '#6B7280'}
                        />
                        <Text
                          numberOfLines={2}
                          ellipsizeMode="tail"
                          className={`text-xs font-bold flex-1 min-w-0 ${
                            editTab === 'tutor' ? 'text-maroon' : 'text-gray-600'
                          }`}
                        >
                          2. Tutor / Apoderado
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Formulario del Estudiante (cuando no se está editando el tutor) */}
                  {(!editingStudent || editTab === 'student') && (
                    <>
                      {tutorSummary && !editingStudent && (
                        <View className="p-3 bg-gold/20 rounded-xl border border-gold/40 flex-row items-center justify-between">
                          <View>
                            <Text className="text-xs font-bold text-maroon">Tutor Vinculado:</Text>
                            <Text className="text-xs text-gray-800">{tutorSummary}</Text>
                          </View>
                          <Ionicons name="checkmark-circle" size={20} color="#7A1F3D" />
                        </View>
                      )}

                      <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                        <Text className="text-xs font-bold text-maroon mb-2 uppercase">Fotografía del Estudiante (MinIO)</Text>
                        <ProfilePhotoPicker photoUri={studentPhoto} onChange={setStudentPhoto} required={false} />
                      </BentoCard>

                      <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                        <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Datos Personales del Estudiante</Text>
                        <View className="flex-row flex-wrap gap-2">
                          <InlineInput
                            value={studentForm.nombre}
                            onChangeText={(v) => {
                              clearFieldError('studentNombre');
                              setStudentForm((f) => ({ ...f, nombre: v }));
                              const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                              handleAutoFillStudentUsername(v, studentForm.apellidoPaterno, studentForm.apellidoMaterno, ciDoc);
                            }}
                            placeholder="Nombre *"
                            error={fieldErrors.studentNombre}
                          />
                          <InlineInput
                            value={studentForm.apellidoPaterno}
                            onChangeText={(v) => {
                              clearFieldError('studentApellidoPaterno');
                              setStudentForm((f) => ({ ...f, apellidoPaterno: v }));
                              const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                              handleAutoFillStudentUsername(studentForm.nombre, v, studentForm.apellidoMaterno, ciDoc);
                            }}
                            placeholder="Apellido Paterno *"
                            error={fieldErrors.studentApellidoPaterno}
                          />
                          <InlineInput
                            value={studentForm.apellidoMaterno}
                            onChangeText={(v) => {
                              setStudentForm((f) => ({ ...f, apellidoMaterno: v }));
                              const ciDoc = studentDocs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                              handleAutoFillStudentUsername(studentForm.nombre, studentForm.apellidoPaterno, v, ciDoc);
                            }}
                            placeholder="Apellido Materno"
                          />
                          <BirthDatePicker value={studentForm.nacimiento} onChange={(v) => setStudentForm((f) => ({ ...f, nacimiento: v }))} />
                        </View>
                      </BentoCard>

                      <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                        <DocumentInput
                          documents={studentDocs}
                          onChange={(docs) => {
                            setStudentDocs(docs);
                            const ciDoc = docs.find((d) => d.tipoDoc === 'CI')?.numeroDoc ?? '';
                            handleAutoFillStudentUsername(studentForm.nombre, studentForm.apellidoPaterno, studentForm.apellidoMaterno, ciDoc);
                          }}
                          requiredTypes={STUDENT_REQUIRED_DOCS}
                          title="Documentos del Estudiante (CI y RUDE en PDF)"
                          fieldErrors={fieldErrors}
                        />
                      </BentoCard>

                      <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                        <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Credenciales Autogeneradas</Text>
                        <View className="flex-row flex-wrap gap-2">
                          <InlineInput
                            value={studentForm.username}
                            editable={false}
                            placeholder="Usuario institucional autogenerado"
                            error={fieldErrors.studentUsername}
                          />
                          <InlineInput
                            value={studentForm.email}
                            editable={false}
                            placeholder="Correo institucional"
                            error={fieldErrors.studentEmail}
                          />
                        </View>
                      </BentoCard>
                    </>
                  )}

                  {/* Formulario del Tutor / Apoderado (cuando se edita en modo tutor) */}
                  {editingStudent && editTab === 'tutor' && (
                    <>
                      <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                        <Text className="text-xs font-bold text-maroon mb-3 uppercase">Datos Personales del Tutor / Apoderado</Text>
                        <View className="flex-row flex-wrap gap-2">
                          <InlineInput
                            value={tutorForm.nombre}
                            onChangeText={(v) => { clearFieldError('tutorNombre'); setTutorForm((f) => ({ ...f, nombre: v })); }}
                            placeholder="Nombre del Tutor *"
                            error={fieldErrors.tutorNombre}
                          />
                          <InlineInput
                            value={tutorForm.apellidoPaterno}
                            onChangeText={(v) => { clearFieldError('tutorApellidoPaterno'); setTutorForm((f) => ({ ...f, apellidoPaterno: v })); }}
                            placeholder="Apellido Paterno *"
                            error={fieldErrors.tutorApellidoPaterno}
                          />
                          <InlineInput
                            value={tutorForm.apellidoMaterno}
                            onChangeText={(v) => setTutorForm((f) => ({ ...f, apellidoMaterno: v }))}
                            placeholder="Apellido Materno"
                          />
                        </View>
                      </BentoCard>

                      <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                        <DocumentInput
                          documents={tutorDocs}
                          onChange={setTutorDocs}
                          requiredTypes={TUTOR_REQUIRED_DOCS}
                          title="Cédula de Identidad del Tutor *"
                          fieldErrors={fieldErrors}
                        />
                      </BentoCard>

                      <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                        <Text className="text-xs font-bold text-gray-700 mb-3 uppercase">Contacto y Parentesco</Text>
                        <View className="flex-row flex-wrap gap-2">
                          <InlineInput
                            value={tutorForm.celular}
                            numericOnly
                            maxLength={15}
                            onChangeText={(v) => setTutorForm((f) => ({ ...f, celular: v }))}
                            placeholder="Celular / WhatsApp del Tutor"
                          />
                          <InlineInput
                            value={tutorForm.parentesco}
                            onChangeText={(v) => setTutorForm((f) => ({ ...f, parentesco: v }))}
                            placeholder="Parentesco (Padre, Madre, Tutor...)"
                          />
                        </View>
                      </BentoCard>
                    </>
                  )}

                  <TouchableOpacity
                    onPress={handleSaveStudent}
                    disabled={saving}
                    className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
                  >
                    {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Text className="text-white font-bold text-sm">
                          {editingStudent ? 'Guardar Cambios (Estudiante y Tutor)' : 'Continuar a Inscripción'}
                        </Text>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* PASO 3: ASIGNACIÓN A CURSO PERIODO */}
              {step === 3 && (
                <View className="gap-4">
                  <BentoCard className="p-4 bg-gray-50 border border-gray-200">
                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Seleccionar Nivel Educativo</Text>
                    <View className="flex-row gap-2 mb-3">
                      <TouchableOpacity
                        onPress={() => setModalNivelInscripcion('primaria')}
                        className={`flex-1 min-w-0 py-2.5 rounded-xl items-center ${
                          modalNivelInscripcion === 'primaria' ? 'bg-maroon' : 'bg-gray-200'
                        }`}
                      >
                        <Text className={`text-xs font-bold flex-1 min-w-0 ${modalNivelInscripcion === 'primaria' ? 'text-white' : 'text-gray-700'}`}>
                          Primaria
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setModalNivelInscripcion('secundaria')}
                        className={`flex-1 min-w-0 py-2.5 rounded-xl items-center ${
                          modalNivelInscripcion === 'secundaria' ? 'bg-maroon' : 'bg-gray-200'
                        }`}
                      >
                        <Text className={`text-xs font-bold flex-1 min-w-0 ${modalNivelInscripcion === 'secundaria' ? 'text-white' : 'text-gray-700'}`}>
                          Secundaria
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text className="text-xs font-bold text-gray-700 mb-2 uppercase">Curso y Paralelo Activo *</Text>
                    <View className="gap-2">
                      {cursosPeriodo
                        .filter((cp) => {
                          const n = (cp.curso?.nivel || cp.nivel || '').toLowerCase();
                          return modalNivelInscripcion === 'primaria'
                            ? n.includes('primaria') || n.includes('inicial')
                            : n.includes('secundaria') || n.includes('bachill');
                        })
                        .map((cp) => {
                          const isSel = modalSelectedCursoId === String(cp.id);
                          const c = cp.curso || {};
                          return (
                            <TouchableOpacity
                              key={cp.id}
                              onPress={() => setModalSelectedCursoId(String(cp.id))}
                              className={`p-3 rounded-xl border flex-row items-center justify-between min-w-0 ${
                                isSel ? 'bg-gold/20 border-maroon' : 'bg-white border-gray-200'
                              }`}
                            >
                              <Text className="text-xs font-bold text-gray-800 flex-1 min-w-0" numberOfLines={2} ellipsizeMode="tail">
                                {c.grado || cp.grado} &quot;{c.paralelo || cp.paralelo}&quot; - {c.nivel || cp.nivel}
                              </Text>
                              <Ionicons
                                name={isSel ? 'radio-button-on' : 'radio-button-off'}
                                size={18}
                                color={isSel ? '#801529' : '#9CA3AF'}
                              />
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  </BentoCard>

                  <TouchableOpacity
                    onPress={handleFinalizeRegistration}
                    disabled={saving}
                    className="bg-maroon rounded-xl py-3.5 items-center flex-row justify-center gap-2 shadow"
                  >
                    {saving ? <ActivityIndicator color="#FFFFFF" /> : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                        <Text className="text-white font-bold text-sm">Finalizar Registro e Inscripción</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* FICHA DETALLADA DE CONSULTA DE ESTUDIANTE */}
      {selectedStudentDetail && (
        <Modal
          visible={Boolean(selectedStudentDetail)}
          animationType="fade"
          transparent
          onRequestClose={() => setSelectedStudentDetail(null)}
        >
          <View className="flex-1 bg-black/60 items-center justify-center p-4">
            <View className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden shadow-2xl p-6">
              <View className="flex-row justify-between items-center mb-4 border-b border-gray-100 pb-3">
                <Text className="text-lg font-bold text-maroon">Ficha Académica del Estudiante</Text>
                <TouchableOpacity onPress={() => setSelectedStudentDetail(null)}>
                  <Ionicons name="close" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {loadingStudentDetail ? (
                <ActivityIndicator color="#7A1F3D" className="py-8" />
              ) : (
                <ScrollView className="gap-3 max-h-[60vh]">
                  <View className="flex-row items-center gap-4 mb-3">
                    <UserAvatar
                      nombre={selectedStudentDetail.nombre}
                      apellidoPaterno={selectedStudentDetail.apellidoPaterno}
                      fotoUrl={selectedStudentDetail.fotoUrl}
                      className="w-16 h-16 rounded-2xl bg-gray-100 border-2 border-maroon/20"
                      textoClassName="text-maroon font-bold text-xl"
                    />
                    <View>
                      <Text className="text-base font-bold text-gray-900">
                        {getFullName(
                          selectedStudentDetail.nombre,
                          selectedStudentDetail.apellidoPaterno || (selectedStudentDetail as any).apellido_paterno,
                          selectedStudentDetail.apellidoMaterno || (selectedStudentDetail as any).apellido_materno,
                        )}
                      </Text>
                      <Text className="text-xs font-mono text-maroon">@{selectedStudentDetail.username}</Text>
                      <Text className="text-xs text-gray-500">{selectedStudentDetail.email || 'Sin correo'}</Text>
                    </View>
                  </View>

                  <View className="bg-gray-50 p-3.5 rounded-xl gap-1.5 border border-gray-200">
                    <Text className="text-xs font-bold text-gray-700 uppercase">Documentos Registrados</Text>
                    {(selectedStudentDetail.documentos ?? []).map((d, i) => (
                      <Text key={i} className="text-xs text-gray-600">
                        • {d.tipoDoc || (d as any).tipo_doc}: {d.numeroDoc || (d as any).numero_doc}
                      </Text>
                    ))}
                  </View>

                  {(() => {
                    const apod = selectedStudentDetail.apoderados?.[0] as any;
                    const tutorUser = selectedTutorDetail;
                    if (!apod && !tutorUser) return null;

                    const tNombre = tutorUser
                      ? getFullName(tutorUser.nombre, tutorUser.apellidoPaterno, tutorUser.apellidoMaterno)
                      : getFullName(apod.nombre, apod.apellidoPaterno, apod.apellidoMaterno);
                    const tParentesco = apod?.parentesco || 'Tutor / Apoderado Legal';
                    const tCi = apod?.ci || tutorUser?.documentos?.find((d) => d.tipoDoc === 'CI' || (d as any).tipo_doc === 'CI')?.numeroDoc || 'No registrado';
                    const tCelular = apod?.celular || apod?.telefono || tutorUser?.contactos?.find((c) => c.tipo === 'Celular' || c.tipo === 'Telefono')?.contenido || 'No registrado';

                    return (
                      <View className="bg-gold/10 p-4 rounded-2xl gap-2 border border-gold/40 mt-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-xs font-bold text-maroon uppercase tracking-wide">
                            Tutor / Apoderado Vinculado
                          </Text>
                          <View className="bg-gold/20 px-2 py-0.5 rounded border border-gold/40">
                            <Text className="text-[11px] font-bold text-maroon">{tParentesco}</Text>
                          </View>
                        </View>
                        <Text className="text-base font-bold text-gray-900">
                          {tNombre}
                        </Text>
                        <View className="flex-row flex-wrap gap-2 mt-1">
                          <View className="bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                            <Text className="text-xs text-gray-700 font-mono">CI: {tCi}</Text>
                          </View>
                          <View className="bg-white px-2.5 py-1 rounded-lg border border-gray-200 flex-row items-center gap-1">
                            <Ionicons name="call-outline" size={12} color="#4B5563" />
                            <Text className="text-xs text-gray-700 font-mono">{tCelular}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* Modal de Confirmación de Baja */}
      <BajaConfirmModal
        user={bajaTarget}
        visible={Boolean(bajaTarget)}
        loading={bajaLoading}
        onCancel={() => setBajaTarget(null)}
        onConfirm={confirmBaja}
      />

      {/* Modal de Confirmación de Eliminación Permanente */}
      <ConfirmDeleteModal
        visible={Boolean(deletingStudent)}
        itemName={deletingStudent ? getFullName(deletingStudent.nombre, deletingStudent.apellidoPaterno, deletingStudent.apellidoMaterno) : ''}
        loading={deleteLoading}
        onCancel={() => setDeletingStudent(null)}
        onConfirm={handleConfirmDeleteStudent}
        warningNote="Se eliminarán permanentemente las inscripciones, notas, asistencias y registros vinculados del estudiante."
      />
    </ScrollView>
  );
}
