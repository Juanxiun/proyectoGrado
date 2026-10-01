import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { BentoCard, HeroBanner, KpiCard, StatusBadge } from '../../../shared/ui';
import { getFullName } from '../../../utils/validation';
import { useResponsive } from '../../../utils/responsive';

interface CursoCapacidad {
  curso: string;
  nivel: string;
  inscritos: number;
  capacidad: number;
  aula: string;
  turno: string;
}

const CURSOS_OCUPACION: CursoCapacidad[] = [
  { curso: '1° Primaria A', nivel: 'Primaria', inscritos: 28, capacidad: 30, aula: 'Aula 101', turno: 'Mañana' },
  { curso: '2° Primaria A', nivel: 'Primaria', inscritos: 30, capacidad: 30, aula: 'Aula 102', turno: 'Mañana' },
  { curso: '1° Secundaria A', nivel: 'Secundaria', inscritos: 29, capacidad: 32, aula: 'Aula 201', turno: 'Mañana' },
  { curso: '2° Secundaria B', nivel: 'Secundaria', inscritos: 27, capacidad: 32, aula: 'Aula 202', turno: 'Mañana' },
  { curso: '3° Secundaria A', nivel: 'Secundaria', inscritos: 31, capacidad: 32, aula: 'Aula 203', turno: 'Mañana' },
];

const OPERACIONES_ADMIN = [
  { title: 'Inscripción Escolar', desc: 'Matrícula y asignación de cursos', icon: 'person-add-outline' as const, tag: 'INSCRIPCIONES' },
  { title: 'Registro de Estudiantes', desc: 'Expedientes, CI y apoderados', icon: 'people-outline' as const, tag: 'ESTUDIANTES' },
  { title: 'Gestión Docente', desc: 'Asignación de materias y cursos', icon: 'school-outline' as const, tag: 'DOCENTES' },
  { title: 'Gestión de Horarios', desc: 'Aulas y bloques de clase', icon: 'time-outline' as const, tag: 'HORARIOS' },
];

export function ControlDashboard() {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const name = user ? getFullName(user.nombre, user.apellidoPaterno) : 'Control Académico';

  return (
    <View className="gap-5">
      {/* Hero Banner */}
      <HeroBanner
        badge="Control y Registro"
        badgeSecondary="Gestión Activa"
        title="Panel de Control Académico"
        subtitle={`Hola, ${name}. Supervisa inscripciones, asignación de cursos y expedientes de la comunidad escolar.`}
        variant="maroon"
      />

      {/* KPI Bento Grid */}
      <View className="flex-row flex-wrap gap-3">
        <KpiCard label="Inscripciones Activas" value="468" trend="98% de cupos cubiertos" icon="person-add-outline" />
        <KpiCard label="Cursos Habilitados" value="24" trend="12 Prim. / 12 Sec." icon="layers-outline" />
        <KpiCard label="Plantel Docente" value="28" trend="Todos asignados" icon="school-outline" />
        <KpiCard label="Aulas Asignadas" value="18" trend="Turno Mañana" icon="business-outline" />
      </View>

      {/* Bento Main Grid */}
      <View className={`gap-4 ${isMobile ? '' : 'flex-row'}`}>
        {/* Capacidad y Ocupación de Cursos */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-[2]'}`}>
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">Capacidad de Cursos y Aulas</Text>
              <Text className="text-xs text-gray-500">Monitoreo de ocupación y cupos por paralelo</Text>
            </View>
            <View className="bg-maroon/10 px-2.5 py-1 rounded-lg">
              <Text className="text-maroon text-xs font-bold uppercase">Ciclo Regular</Text>
            </View>
          </View>

          <View className="gap-3">
            {CURSOS_OCUPACION.map((item) => {
              const porcentaje = Math.round((item.inscritos / item.capacidad) * 100);
              const isFull = item.inscritos >= item.capacidad;

              return (
                <View key={item.curso} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex-row items-center justify-between flex-wrap gap-2">
                  <View className="flex-1 min-w-[160px]">
                    <View className="flex-row items-center gap-2">
                      <Text className="font-bold text-gray-900 text-sm">{item.curso}</Text>
                      <StatusBadge
                        label={isFull ? 'Completo' : 'Disponible'}
                        variant={isFull ? 'warning' : 'success'}
                      />
                    </View>
                    <Text className="text-xs text-gray-500 mt-0.5">{item.nivel} · {item.aula} · {item.turno}</Text>
                  </View>

                  <View className="w-36">
                    <View className="flex-row justify-between text-xs mb-1">
                      <Text className="text-xs text-gray-500">{item.inscritos}/{item.capacidad} est.</Text>
                      <Text className="text-xs font-bold text-gray-800">{porcentaje}%</Text>
                    </View>
                    <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View
                        className={`h-full rounded-full ${isFull ? 'bg-amber-500' : 'bg-maroon'}`}
                        style={{ width: `${porcentaje}%` }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </BentoCard>

        {/* Distribución Comunidad Escolar */}
        <BentoCard className={`p-5 ${isMobile ? '' : 'flex-1'}`}>
          <Text className="text-lg font-bold text-gray-900 mb-1">Comunidad Escolar</Text>
          <Text className="text-xs text-gray-500 mb-4">Usuarios registrados en el sistema</Text>

          <View className="gap-2.5">
            {[
              { label: 'Estudiantes', count: '468', icon: 'people-outline', color: '#801529' },
              { label: 'Apoderados / Tutores', count: '420', icon: 'person-outline', color: '#B45309' },
              { label: 'Docentes', count: '28', icon: 'school-outline', color: '#16A34A' },
              { label: 'Administrativos', count: '6', icon: 'shield-outline', color: '#2563EB' },
            ].map((item) => (
              <View key={item.label} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-2.5">
                  <View className="w-8 h-8 rounded-lg bg-white items-center justify-center border border-gray-200">
                    <Ionicons name={item.icon as any} size={16} color={item.color} />
                  </View>
                  <Text className="text-sm font-semibold text-gray-700">{item.label}</Text>
                </View>
                <Text className="text-base font-bold text-gray-900">{item.count}</Text>
              </View>
            ))}
          </View>

          <View className="mt-4 pt-3 border-t border-gray-100">
            <Text className="text-[11px] text-gray-400 text-center">
              Todos los accesos están protegidos con autenticación en 2 pasos (2FA).
            </Text>
          </View>
        </BentoCard>
      </View>

      {/* Operaciones Rápidas */}
      <BentoCard className="p-5">
        <Text className="text-lg font-bold text-gray-900 mb-4">Operaciones de Gestión Escolar</Text>
        <View className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {OPERACIONES_ADMIN.map((item) => (
            <View key={item.title} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <View className="flex-row items-center justify-between mb-2">
                <View className="w-9 h-9 rounded-lg bg-maroon/10 items-center justify-center">
                  <Ionicons name={item.icon} size={19} color="#801529" />
                </View>
                <Text className="text-[10px] font-bold text-maroon uppercase">{item.tag}</Text>
              </View>
              <Text className="font-bold text-gray-900 text-sm">{item.title}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">{item.desc}</Text>
            </View>
          ))}
        </View>
      </BentoCard>
    </View>
  );
}

