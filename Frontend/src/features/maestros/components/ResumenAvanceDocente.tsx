import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { academicManagementApi, academicServicesApi } from '../../../api/academicServices.api';
import { BentoCard } from '../../../shared/ui';
import { useAuth } from '../../../context/AuthContext';

type Resumen = { planificadas: number; impartidas: number; pendientes: number };

function contarClasesPlanificadas(inicio: string, fin: string, filas: Array<{ diaSemana: number }>) {
  const desde = new Date(`${inicio.slice(0, 10)}T00:00:00`);
  const hasta = new Date(`${fin.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return 0;
  let total = 0;
  for (const fila of filas) {
    const fecha = new Date(desde);
    while (fecha <= hasta) {
      const dia = fecha.getDay() === 0 ? 7 : fecha.getDay();
      if (dia === Number(fila.diaSemana)) total += 1;
      fecha.setDate(fecha.getDate() + 1);
    }
  }
  return total;
}

export function ResumenAvanceDocente({ periodoId }: { periodoId: string }) {
  const { user } = useAuth();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vigente = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const [periodoRows, asignacionRows] = await Promise.all([
          academicServicesApi.listAll('periodos', { id: periodoId }),
          academicServicesApi.listAll('asignaciones'),
        ]);
        const periodo = periodoRows.find((row: any) => String(row.id) === periodoId) as any;
        const asignaciones = asignacionRows.filter((row: any) => {
          if (user?.maestroId && String(row.maestroId) === String(user.maestroId)) return true;
          return String(row.maestro?.usuarioId ?? '') === String(user?.id ?? '');
        }) as any[];
        const assignmentKeys = new Set(asignaciones.map((row) => `${String(row.cursoPeriodoId ?? row.cursoPeriodo?.id)}:${String(row.materiaId ?? row.materia?.id ?? '')}`));
        const horarios = await academicManagementApi.listSchedules(periodoId, user?.maestroId ? { maestroId: String(user.maestroId) } : {});
        const filas = (horarios as any[]).filter((row) => assignmentKeys.has(`${String(row.cursoPeriodoId)}:${String(row.materiaId ?? row.materia?.id ?? '')}`));
        const hoy = new Date().toISOString().slice(0, 10);
        const inicio = String(periodo?.fechaInicio ?? periodo?.inicio ?? `${new Date().getFullYear()}-01-01`);
        const planificadas = contarClasesPlanificadas(inicio, hoy, filas);
        const registros = await Promise.all(asignaciones.map((row) => academicServicesApi.listAll('asistencia', { asignacionId: String(row.id) }).catch(() => [])));
        const fechasImpartidas = new Set<string>();
        registros.forEach((items, index) => items.forEach((row: any) => {
          const dia = String(row.fecha ?? '').slice(0, 10);
          if (dia && dia >= inicio.slice(0, 10) && dia <= hoy) fechasImpartidas.add(`${String(asignaciones[index].id)}:${dia}`);
        }));
        const impartidas = Math.min(planificadas, fechasImpartidas.size);
        if (vigente) setResumen({ planificadas, impartidas, pendientes: Math.max(0, planificadas - impartidas) });
      } catch {
        if (vigente) setResumen(null);
      } finally {
        if (vigente) setCargando(false);
      }
    };
    if (periodoId && user) void cargar();
    else { setResumen(null); setCargando(false); }
    return () => { vigente = false; };
  }, [periodoId, user?.id, user?.maestroId]);

  const porcentaje = useMemo(() => resumen?.planificadas ? Math.round((resumen.impartidas / resumen.planificadas) * 100) : 0, [resumen]);

  return <BentoCard className="p-5">
    <View className="flex-row items-center justify-between flex-wrap gap-3"><View><Text className="text-lg font-bold text-gray-900">Avance de clases del período</Text><Text className="text-xs text-gray-500 mt-1">Sesiones programadas hasta hoy, según tu horario y asistencia registrada.</Text></View><Text className="text-2xl font-bold text-maroon">{cargando ? '—' : `${porcentaje}%`}</Text></View>
    {cargando ? <ActivityIndicator className="my-5" color="#801529" /> : resumen ? <>
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden mt-4"><View className="h-full bg-maroon rounded-full" style={{ width: `${porcentaje}%` }} /></View>
      <View className="flex-row flex-wrap gap-6 mt-4"><View><Text className="text-xl font-bold text-gray-900">{resumen.impartidas}</Text><Text className="text-[10px] font-bold uppercase text-gray-500">Impartidas</Text></View><View><Text className="text-xl font-bold text-gray-900">{resumen.planificadas}</Text><Text className="text-[10px] font-bold uppercase text-gray-500">Planificadas</Text></View><View><Text className="text-xl font-bold text-amber-700">{resumen.pendientes}</Text><Text className="text-[10px] font-bold uppercase text-gray-500">Pendientes</Text></View></View>
    </> : <Text className="text-sm text-gray-500 mt-4">No se encontró un horario o período activo para calcular el avance.</Text>}
  </BentoCard>;
}
