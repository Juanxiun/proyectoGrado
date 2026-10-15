// shell_roles -> distribuir interfaz según rol de usuario (estudiante, docente, admin)
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppLayout } from '../displays/layouts/AppLayout';
import { ProfileScreen } from '../displays/screens/ProfileScreen';
import { PlaceholderScreen } from '../displays/screens/PlaceholderScreen';
import { NotFoundScreen } from '../displays/screens/ErrorScreens';
import { getFullName } from '../utils/validation';
import type { NavItem } from '../displays/components/Sidebar';
import { DocentesManagementScreen } from '../features/usuarios/screens/DocentesManagementScreen';
import { EstudiantesManagementScreen } from '../features/usuarios/screens/EstudiantesManagementScreen';
import { AdministrativoManagementScreen } from '../features/usuarios/screens/AdministrativoManagementScreen';
import { AcademicServicesScreen } from '../features/academico/screens/AcademicServicesScreen';
import { DashboardScreen } from '../features/dashboard/screens/DashboardScreen';
import { MaestroCursosScreen } from '../features/maestros/screens/MaestroCursosScreen';
import { MaestroMateriasScreen } from '../features/maestros/screens/MaestroMateriasScreen';
import { MaestroEvaluacionesScreen } from '../features/maestros/screens/MaestroEvaluacionesScreen';
import { MaestroRendimientoScreen } from '../features/maestros/screens/MaestroRendimientoScreen';
import { MaestroSeguimientoScreen } from '../features/maestros/screens/MaestroSeguimientoScreen';
import { EstudianteCursosScreen } from '../features/usuarios/screens/EstudianteCursosScreen';
import { EstudianteMateriasScreen } from '../features/usuarios/screens/EstudianteMateriasScreen';
import { EstudianteEvaluacionesScreen } from '../features/usuarios/screens/EstudianteEvaluacionesScreen';
import { ScheduleScreen } from '../features/academico/screens/ScheduleScreen';
import { SeguimientoScreen } from '../features/academico/screens/SeguimientoScreen';
import { EconomyManagementScreen } from '../features/billing/screens/EconomyManagementScreen';
import { BillingStudentScreen } from '../features/billing/screens/BillingStudentScreen';
import { ForcePasswordChangeModal } from '../features/usuarios/components/ForcePasswordChangeModal';
import { FirstLoginProfileModal } from '../features/usuarios/components/FirstLoginProfileModal';
import { MobileAccessRestrictedScreen } from '../displays/screens/MobileAccessRestrictedScreen';
import { useResponsive } from '../utils/responsive';
import { EstudianteDashboardScreen } from '../features/gamificacion/screens/EstudianteDashboardScreen';
import { EstudianteRendimientoScreen } from '../features/usuarios/screens/EstudianteRendimientoScreen';
import { EstudianteAsistenciaScreen } from '../features/usuarios/screens/EstudianteAsistenciaScreen';

interface RoleShellProps {
  navItems: NavItem[];
  /**
   * @deprecated El inicio usa `DashboardScreen` (ServiceDashboard). El
   * componente queda por si algún rol necesita un panel propio.
   */
  dashboardComponent?: React.ComponentType;
  panelTitle?: string;
}

export function RoleShell({ navItems, panelTitle = 'Panel Administrativo' }: RoleShellProps) {
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const [activeRoute, setActiveRoute] = useState('Dashboard');
  const [schedulePeriodoId, setSchedulePeriodoId] = useState('');
  const [seguimientoPeriodoId, setSeguimientoPeriodoId] = useState('');
  const [materiaTab, setMateriaTab] = useState<'materiales' | 'tareas'>('tareas');

  const handleNavigate = (route: string, params?: { periodoId?: string; tab?: 'materiales' | 'tareas' }) => {
    if (route === 'Horarios' && params?.periodoId) setSchedulePeriodoId(params.periodoId);
    if (route === 'Seguimiento' && params?.periodoId) setSeguimientoPeriodoId(params.periodoId);
    if (route === 'Materias' && params?.tab) setMateriaTab(params.tab);
    setActiveRoute(route);
  };

  if (!user) return null;

  const userName = getFullName(user.nombre, user.apellidoPaterno);
  const userEmail = user.email;
  const roleName = user.rol.toLowerCase();
  const isTeacher = roleName.includes('maestro') || roleName.includes('profesor') || roleName.includes('docente');
  const isStudent = roleName.includes('estudiante') || roleName.includes('alumno');
  const titleByRoute: Record<string, string> = {
    Dashboard: isStudent ? 'Panel Estudiantil' : panelTitle,
    Profile: 'Mi Perfil',
    Materias: 'Mis Materias',
    Horarios: 'Mi Horario',
    Horario: 'Mi Horario',
    Deuda: 'Plan Económico',
  };
  const headerTitle = titleByRoute[activeRoute] ?? panelTitle;

  // Restriccion RBAC: la vista movil es exclusiva para Estudiantes
  if (isMobile && !isStudent) {
    return <MobileAccessRestrictedScreen role={user.rol} />;
  }

  const renderContent = () => {
    switch (activeRoute) {
      case 'Dashboard':
        if (isStudent) return <EstudianteDashboardScreen onNavigate={handleNavigate} />;
        return <DashboardScreen onNavigate={handleNavigate} />;
      case 'Profile':
        return <ProfileScreen />;
      case 'Docentes':
        return <DocentesManagementScreen />;
      case 'Estudiantes':
        return <EstudiantesManagementScreen />;
      case 'Administrativo':
        return <AdministrativoManagementScreen />;
      case 'Estructura':
        return <AcademicServicesScreen area="academic" onNavigate={handleNavigate} />;
      case 'Inscripciones':
        return <AcademicServicesScreen area="enrollment" onNavigate={handleNavigate} />;
      case 'Evaluaciones':
        if (isTeacher) return <MaestroEvaluacionesScreen />;
        if (isStudent) return <EstudianteEvaluacionesScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Cursos':
        if (isTeacher) return <MaestroCursosScreen onNavigate={handleNavigate} />;
        if (isStudent) return <EstudianteCursosScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Calificaciones':
        if (isStudent) return <EstudianteRendimientoScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Asistencia':
        if (isStudent) return <EstudianteAsistenciaScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Materias':
        if (isTeacher) return <MaestroMateriasScreen initialTab={materiaTab} />;
        if (isStudent) return <EstudianteMateriasScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Rendimiento':
        if (isTeacher) return <MaestroRendimientoScreen />;
        return <PlaceholderScreen title="Rendimiento Académico" />;
      case 'Horarios':
      case 'Horario':
        return <ScheduleScreen initialPeriodoId={schedulePeriodoId} />;
      case 'Seguimiento':
        if (isTeacher) return <MaestroSeguimientoScreen />;
        return <SeguimientoScreen initialPeriodoId={seguimientoPeriodoId} />;
      case 'Economia':
        return <EconomyManagementScreen />;
      case 'Deuda':
        return <BillingStudentScreen />;
      default:
        return navItems.some((n) => n.route === activeRoute)
          ? <PlaceholderScreen title={navItems.find((n) => n.route === activeRoute)?.label ?? activeRoute} />
          : <NotFoundScreen onGoBack={() => setActiveRoute('Dashboard')} />;
    }
  };

  return (
    <>
      <AppLayout
        title={headerTitle}
        userName={userName}
        userEmail={userEmail}
        userPhoto={user.fotoUrl}
        navItems={navItems}
        activeRoute={activeRoute}
        onNavigate={setActiveRoute}
        onProfilePress={() => setActiveRoute('Profile')}
      >
        {renderContent()}
      </AppLayout>
      <ForcePasswordChangeModal visible={Boolean(user.debeCambiarPassword)} />
      <FirstLoginProfileModal visible={Boolean(user.debeCompletarPerfil && !user.debeCambiarPassword)} />
    </>
  );
}
