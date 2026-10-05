import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Text, TouchableOpacity, View } from 'react-native';
import type { DashboardData } from '../../../api/dashboard.api';
import { MESES } from '../../../api/dashboard.api';
import { BentoCard } from '../../../shared/ui';
import { useResponsive } from '../../../utils/responsive';

interface Props {
  data: DashboardData;
  role: string;
  userName: string;
  onNavigate?: (route: string) => void;
}

const WINE = '#801529';
const GOLD = '#B99A72';
const LEVEL_COLORS = [WINE, GOLD, '#C88A9A', '#62577B'];

export function InstitutionDashboard({ data, role, userName, onNavigate }: Props) {
  const { isMobile, width } = useResponsive();
  const compact = width < 1024;
  const director = ['director', 'admin', 'administrador', 'directores', 'administradores'].includes(role);
  const chartWidth = Math.max(280, Math.min(760, width - (isMobile ? 56 : compact ? 310 : 390)));
  const economy = data.economico;

  return (
    <View className="gap-5 pb-8">
      <View className={`gap-4 ${compact ? '' : 'flex-row items-stretch'}`}>
        <Hero
          director={director}
          userName={userName}
          periodo={data.contexto.periodo?.nombre ?? 'Sin gestion activa'}
          onNavigate={onNavigate}
          className={compact ? '' : 'flex-[2]'}
        />
        {!compact ? <QuickAccess onNavigate={onNavigate} /> : null}
      </View>

      {compact ? <QuickAccess onNavigate={onNavigate} horizontal={isMobile} /> : null}

      <View className="flex-row flex-wrap gap-3">
        <StatCard
          label="Matricula institucional"
          value={formatNumber(data.academico.matricula.total)}
          detail={`${data.academico.cursos.total} cursos activos`}
          icon="people-outline"
          accent={WINE}
        />
        <StatCard
          label="Ingresos cobrados"
          value={economy ? formatMoney(economy.cobrado) : '—'}
          detail={economy ? `${economy.porcentajeCobranza ?? 0}% de cobranza` : 'Dato no disponible'}
          icon="wallet-outline"
          accent={GOLD}
        />
        <StatCard
          label="Asistencia efectiva"
          value={data.asistencia.global.tasa === null ? '—' : `${data.asistencia.global.tasa}%`}
          detail={`${data.asistencia.global.ausentes} faltas registradas`}
          icon="checkmark-circle-outline"
          accent="#2FAE89"
          alert={(data.asistencia.global.tasa ?? 100) < 85}
        />
        <StatCard
          label="Estudiantes en riesgo"
          value={formatNumber(data.riesgo.total)}
          detail={`${data.riesgo.riesgoAlto} requieren atencion prioritaria`}
          icon="alert-circle-outline"
          accent="#C65B63"
          alert={data.riesgo.riesgoAlto > 0}
        />
      </View>

      <View className={`gap-4 ${compact ? '' : 'flex-row items-stretch'}`}>
        <TrendPanel data={data} chartWidth={chartWidth} className={compact ? '' : 'flex-[2]'} />
        <LevelPanel data={data} className={compact ? '' : 'flex-1'} />
      </View>

      <View className={`gap-4 ${compact ? '' : 'flex-row items-stretch'}`}>
        <AcademicPanel data={data} className={compact ? '' : 'flex-[2]'} />
        <AlertsPanel data={data} onNavigate={onNavigate} className={compact ? '' : 'flex-1'} />
      </View>

      <View className="flex-row flex-wrap items-center justify-between border-t border-gray-200 pt-4 px-1">
        <Text className="text-[10px] font-bold tracking-[1.5px] text-gray-400">SISTEMA DE GESTION ACADEMICA</Text>
        <Text className="text-[10px] text-gray-400">Datos del periodo · {data.contexto.periodo?.nombre ?? 'Sin periodo'}</Text>
      </View>
    </View>
  );
}

function Hero({
  director,
  userName,
  periodo,
  onNavigate,
  className = '',
}: {
  director: boolean;
  userName: string;
  periodo: string;
  onNavigate?: (route: string) => void;
  className?: string;
}) {
  return (
    <View className={`rounded-3xl overflow-hidden bg-maroon p-6 md:p-8 min-h-[236px] justify-between ${className}`}>
      <View className="absolute right-[-36px] top-[-50px] w-64 h-64 rounded-full border border-white/10" />
      <View className="absolute right-5 top-8 w-40 h-40 rounded-full border border-white/10" />
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-white/15 px-3 py-1">
          <Text className="text-[10px] text-white font-bold tracking-wider">{director ? 'DIRECCION INSTITUCIONAL' : 'GESTION ADMINISTRATIVA'}</Text>
        </View>
        <Text className="text-xs text-white/70">{periodo}</Text>
      </View>
      <View className="max-w-[680px] mt-5">
        <Text className="text-white text-3xl md:text-4xl font-bold tracking-tight">
          {director ? 'Control institucional global' : 'Panel administrativo'}
        </Text>
        <Text className="text-sm md:text-base text-white/75 mt-2 leading-6">
          Hola, {userName}. Supervisa matriculas, rendimiento academico, asistencia y finanzas desde un solo lugar.
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-2 mt-5">
        <HeroButton label="Registrar pago" icon="add-circle-outline" onPress={() => onNavigate?.('Economia')} primary />
        <HeroButton label="Ver estudiantes" icon="people-outline" onPress={() => onNavigate?.('Estudiantes')} />
      </View>
    </View>
  );
}

function HeroButton({ label, icon, onPress, primary = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; primary?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center gap-2 rounded-xl px-4 py-3 ${primary ? 'bg-white' : 'border border-white/40 bg-white/5'}`}
    >
      <Ionicons name={icon} size={16} color={primary ? WINE : '#FFFFFF'} />
      <Text className={`text-xs font-bold ${primary ? 'text-maroon' : 'text-white'}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAccess({ onNavigate, horizontal = false }: { onNavigate?: (route: string) => void; horizontal?: boolean }) {
  const items: Array<{ title: string; route: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { title: 'Economia y pagos', route: 'Economia', icon: 'wallet-outline' },
    { title: 'Matriculas', route: 'Inscripciones', icon: 'person-add-outline' },
    { title: 'Directorio de estudiantes', route: 'Estudiantes', icon: 'people-outline' },
    { title: 'Gestion docente', route: 'Docentes', icon: 'school-outline' },
  ];
  return (
    <BentoCard className={`p-4 ${horizontal ? '' : 'md:w-[290px]'}`}>
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name="flash-outline" size={18} color={WINE} />
        <Text className="text-lg font-bold text-gray-900">Accesos directos</Text>
      </View>
      <View className={horizontal ? 'flex-row flex-wrap gap-2' : 'gap-2'}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.route}
            onPress={() => onNavigate?.(item.route)}
            className={`flex-row items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 ${horizontal ? 'flex-1 min-w-[145px]' : ''}`}
          >
            <View className="w-9 h-9 rounded-xl bg-white items-center justify-center">
              <Ionicons name={item.icon} size={17} color={WINE} />
            </View>
            <Text className="flex-1 text-xs font-semibold text-gray-700">{item.title}</Text>
            <Ionicons name="chevron-forward" size={15} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </View>
    </BentoCard>
  );
}

function StatCard({ label, value, detail, icon, accent, alert = false }: { label: string; value: string; detail: string; icon: keyof typeof Ionicons.glyphMap; accent: string; alert?: boolean }) {
  return (
    <View className="flex-1 min-w-[175px] rounded-2xl bg-white border border-gray-100 shadow-sm p-4 overflow-hidden">
      <View className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }} />
      <View className="flex-row items-center justify-between">
        <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: `${accent}12` }}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
        {alert ? <View className="rounded-full bg-red-50 px-2 py-1"><Text className="text-[9px] text-red-700 font-bold">ATENCION</Text></View> : null}
      </View>
      <Text className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-4">{label}</Text>
      <Text className="text-2xl font-bold text-gray-900 mt-1" numberOfLines={1}>{value}</Text>
      <Text className="text-[11px] text-gray-400 mt-1" numberOfLines={1}>{detail}</Text>
    </View>
  );
}

function TrendPanel({ data, chartWidth, className = '' }: { data: DashboardData; chartWidth: number; className?: string }) {
  const economy = data.economico;
  const financial = Boolean(economy?.porMes.length);
  const values = financial
    ? economy!.porMes.slice(-6).map((month) => ({ label: MESES[month.mes - 1] ?? '', primary: month.cobrado, secondary: month.facturado }))
    : data.asistencia.ultimosDias.slice(-6).map((day) => ({ label: day.fecha.slice(8), primary: day.tasa ?? 0, secondary: 85 }));
  const graphWidth = Math.max(250, chartWidth - 48);
  const height = 190;
  const pad = { x: 12, y: 14 };
  const max = Math.max(1, ...values.flatMap((point) => [point.primary, point.secondary]));
  const coords = (list: number[]) => list.map((value, i) => ({
    x: pad.x + (values.length <= 1 ? 0 : i * (graphWidth - pad.x * 2) / (values.length - 1)),
    y: height - pad.y - (value / max) * (height - pad.y * 2),
  }));
  const primary = coords(values.map((point) => point.primary));
  const secondary = coords(values.map((point) => point.secondary));
  const line = (points: Array<{ x: number; y: number }>) => points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const fill = primary.length ? `${line(primary)} L ${primary[primary.length - 1].x} ${height - pad.y} L ${primary[0].x} ${height - pad.y} Z` : '';

  return (
    <BentoCard className={`p-5 ${className}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900">{financial ? 'Rendimiento financiero' : 'Asistencia reciente'}</Text>
          <Text className="text-xs text-gray-500 mt-1">{financial ? 'Cobranza real comparada con lo facturado' : 'Porcentaje de asistencia de los ultimos dias'}</Text>
        </View>
        <View className="w-9 h-9 rounded-xl bg-rose-50 items-center justify-center"><Ionicons name="stats-chart-outline" size={18} color={WINE} /></View>
      </View>
      {values.length ? (
        <View className="mt-4">
          <Svg width="100%" height={height} viewBox={`0 0 ${graphWidth} ${height}`}>
            {[0, 1, 2, 3].map((i) => {
              const y = pad.y + i * (height - pad.y * 2) / 3;
              return <Line key={i} x1={pad.x} x2={graphWidth - pad.x} y1={y} y2={y} stroke="#EEF0F3" strokeWidth="1" />;
            })}
            {fill ? <Path d={fill} fill="#F6E9ED" /> : null}
            <Path d={line(secondary)} fill="none" stroke={GOLD} strokeWidth="2.5" strokeDasharray="5 5" />
            <Path d={line(primary)} fill="none" stroke={WINE} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
            {primary.map((point, i) => <Circle key={i} cx={point.x} cy={point.y} r="4" fill={WINE} stroke="white" strokeWidth="2" />)}
          </Svg>
          <View className="flex-row justify-between px-1 mt-1">
            {values.map((point, i) => <Text key={`${point.label}-${i}`} className="text-[10px] text-gray-400">{point.label}</Text>)}
          </View>
          <View className="flex-row flex-wrap gap-4 mt-4">
            <Legend color={WINE} label={financial ? 'Cobrado' : 'Asistencia'} />
            <Legend color={GOLD} label={financial ? 'Facturado' : 'Meta 85%'} dashed />
          </View>
        </View>
      ) : <EmptyState text={financial ? 'Aun no hay movimientos para graficar.' : 'Aun no hay asistencia registrada.'} />}
    </BentoCard>
  );
}

function LevelPanel({ data, className = '' }: { data: DashboardData; className?: string }) {
  const levels = data.academico.matricula.porNivel.filter((level) => level.estudiantes > 0);
  const total = levels.reduce((sum, level) => sum + level.estudiantes, 0);
  const circumference = 2 * Math.PI * 44;
  let offset = 0;
  return (
    <BentoCard className={`p-5 ${className}`}>
      <Text className="text-lg font-bold text-gray-900">Distribucion de estudiantes</Text>
      <Text className="text-xs text-gray-500 mt-1">Matricula activa por nivel academico</Text>
      {total ? (
        <>
          <View className="items-center py-4">
            <View className="w-40 h-40 items-center justify-center">
              <Svg width={160} height={160} viewBox="0 0 120 120" style={{ position: 'absolute' }}>
                {levels.map((level, i) => {
                  const length = level.estudiantes / total * circumference;
                  const circle = <Circle key={level.nivel} cx="60" cy="60" r="44" fill="none" stroke={LEVEL_COLORS[i % LEVEL_COLORS.length]} strokeWidth="15" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} rotation="-90" origin="60, 60" />;
                  offset += length;
                  return circle;
                })}
              </Svg>
              <Text className="text-2xl font-bold text-gray-900">{formatNumber(total)}</Text>
              <Text className="text-[10px] text-gray-400 uppercase">Estudiantes</Text>
            </View>
          </View>
          <View className="gap-3">
            {levels.map((level, i) => (
              <View key={level.nivel} className="flex-row items-center gap-2">
                <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
                <Text className="flex-1 text-xs text-gray-600 capitalize">{level.nivel}</Text>
                <Text className="text-xs font-bold text-gray-800">{formatNumber(level.estudiantes)}</Text>
                <Text className="w-10 text-right text-[10px] text-gray-400">{Math.round(level.estudiantes / total * 100)}%</Text>
              </View>
            ))}
          </View>
        </>
      ) : <EmptyState text="No hay matriculas activas para este periodo." />}
    </BentoCard>
  );
}

function AcademicPanel({ data, className = '' }: { data: DashboardData; className?: string }) {
  const subjects = [...(data.academico._avance ?? [])].sort((a, b) => a.avanceCalificacion - b.avanceCalificacion).slice(0, 4);
  const metrics = [
    { label: 'Materias con encargos', value: data.academico.materias.conEncargos, total: data.academico.materias.total, color: WINE },
    { label: 'Cursos con docente', value: data.academico.cursos.conDocente, total: data.academico.cursos.total, color: '#2FAE89' },
    { label: 'Avance de calificacion', value: data.academico.materias.avanceGlobal, total: 100, color: GOLD, suffix: '%' },
  ];
  return (
    <BentoCard className={`p-5 ${className}`}>
      <View className="flex-row items-center gap-2 mb-4">
        <View className="w-9 h-9 rounded-xl bg-rose-50 items-center justify-center"><Ionicons name="school-outline" size={18} color={WINE} /></View>
        <View><Text className="text-lg font-bold text-gray-900">Panorama academico</Text><Text className="text-xs text-gray-500">Avance y cobertura del periodo</Text></View>
      </View>
      <View className="gap-4">
        {metrics.map((metric) => {
          const pct = metric.total > 0 ? Math.min(100, metric.value / metric.total * 100) : 0;
          return (
            <View key={metric.label}>
              <View className="flex-row justify-between mb-1.5"><Text className="text-xs text-gray-600">{metric.label}</Text><Text className="text-xs font-bold text-gray-800">{metric.suffix ? `${metric.value}${metric.suffix}` : `${metric.value} / ${metric.total}`}</Text></View>
              <View className="h-2 rounded-full bg-gray-100 overflow-hidden"><View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: metric.color }} /></View>
            </View>
          );
        })}
      </View>
      {subjects.length ? (
        <View className="mt-5 pt-4 border-t border-gray-100">
          <Text className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-1">Materias que requieren seguimiento</Text>
          {subjects.map((subject) => (
            <View key={`${subject.materiaId}-${subject.cursoParalelo}`} className="flex-row items-center gap-3 py-2.5 border-b border-gray-50">
              <View className="w-8 h-8 rounded-lg bg-gray-50 items-center justify-center"><Ionicons name="book-outline" size={15} color={WINE} /></View>
              <View className="flex-1"><Text className="text-xs font-semibold text-gray-800" numberOfLines={1}>{subject.materia}</Text><Text className="text-[10px] text-gray-400">{subject.cursoParalelo}</Text></View>
              <Text className="text-xs font-bold" style={{ color: subject.avanceCalificacion < 50 ? '#C65B63' : '#6B7280' }}>{subject.avanceCalificacion}%</Text>
            </View>
          ))}
        </View>
      ) : null}
    </BentoCard>
  );
}

function AlertsPanel({ data, onNavigate, className = '' }: { data: DashboardData; onNavigate?: (route: string) => void; className?: string }) {
  const risks = data.riesgo.top.slice(0, 3);
  const overdue = data.economico?.morosidad.carteraVencida ?? 0;
  return (
    <BentoCard className={`p-5 bg-[#4B0820] border-[#4B0820] ${className}`}>
      <View className="flex-row items-center gap-2 mb-4">
        <Ionicons name="warning-outline" size={19} color="#F2D5A5" />
        <Text className="text-lg font-bold text-white">Alertas prioritarias</Text>
      </View>
      <AlertTile title="Riesgo academico" detail={`${data.riesgo.riesgoAlto} estudiantes en riesgo alto`} icon="school-outline" onPress={() => onNavigate?.('Seguimiento')} />
      <AlertTile title="Asistencia" detail={`${data.asistencia.global.ausentes} faltas · tasa ${data.asistencia.global.tasa ?? 0}%`} icon="calendar-outline" onPress={() => onNavigate?.('Seguimiento')} />
      {data.economico ? <AlertTile title="Cartera vencida" detail={`${formatMoney(overdue)} pendiente de regularizacion`} icon="wallet-outline" onPress={() => onNavigate?.('Economia')} /> : null}
      {risks.length ? (
        <View className="mt-4 pt-3 border-t border-white/15">
          <Text className="text-[10px] text-white/55 uppercase tracking-wider font-bold mb-1">Atencion academica</Text>
          {risks.map((student) => (
            <View key={student.estudianteId} className="flex-row items-center justify-between py-2">
              <View className="flex-1 pr-2"><Text className="text-xs text-white font-semibold" numberOfLines={1}>{student.nombre} {student.apellidoPaterno}</Text><Text className="text-[10px] text-white/55">{student.cursoParalelo}</Text></View>
              <Text className="text-xs font-bold text-[#F2D5A5]">{student.promedio?.toFixed(1) ?? '—'}</Text>
            </View>
          ))}
        </View>
      ) : <Text className="text-[11px] text-white/65 mt-2">No hay estudiantes con alerta activa.</Text>}
      <TouchableOpacity onPress={() => onNavigate?.('Seguimiento')} className="mt-4 border border-white/25 rounded-xl py-3 items-center">
        <Text className="text-xs text-white font-bold">Abrir seguimiento academico</Text>
      </TouchableOpacity>
    </BentoCard>
  );
}

function AlertTile({ title, detail, icon, onPress }: { title: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center gap-3 rounded-xl bg-white/10 p-3 mb-2">
      <View className="w-8 h-8 rounded-lg bg-white/10 items-center justify-center"><Ionicons name={icon} size={16} color="#F2D5A5" /></View>
      <View className="flex-1"><Text className="text-xs text-white font-bold">{title}</Text><Text className="text-[10px] text-white/65 mt-0.5" numberOfLines={2}>{detail}</Text></View>
      <Ionicons name="chevron-forward" size={14} color="#FFFFFF88" />
    </TouchableOpacity>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return <View className="flex-row items-center gap-1.5"><View className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: dashed ? 0.65 : 1 }} /><Text className="text-[10px] text-gray-500">{label}</Text></View>;
}

function EmptyState({ text }: { text: string }) {
  return <View className="py-10 items-center"><Ionicons name="analytics-outline" size={26} color="#C2C7D0" /><Text className="text-xs text-gray-400 mt-2 text-center">{text}</Text></View>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number): string {
  return `Bs ${new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(value)}`;
}
