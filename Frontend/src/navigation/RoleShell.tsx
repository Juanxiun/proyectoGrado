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
import { MaestroCursosScreen } from '../features/maestros/screens/MaestroCursosScreen';
import { MaestroMateriasScreen } from '../features/maestros/screens/MaestroMateriasScreen';
import { MaestroEvaluacionesScreen } from '../features/maestros/screens/MaestroEvaluacionesScreen';
import { EstudianteCursosScreen } from '../features/usuarios/screens/EstudianteCursosScreen';
import { EstudianteMateriasScreen } from '../features/usuarios/screens/EstudianteMateriasScreen';
import { EstudianteEvaluacionesScreen } from '../features/usuarios/screens/EstudianteEvaluacionesScreen';
import { ScheduleScreen } from '../features/academico/screens/ScheduleScreen';
import { ForcePasswordChangeModal } from '../features/usuarios/components/ForcePasswordChangeModal';
import { FirstLoginProfileModal } from '../features/usuarios/components/FirstLoginProfileModal';

interface RoleShellProps {
  navItems: NavItem[];
  dashboardComponent: React.ComponentType;
  panelTitle?: string;
}

export function RoleShell({ navItems, dashboardComponent: Dashboard, panelTitle = 'Panel Administrativo' }: RoleShellProps) {
  const { user } = useAuth();
  const [activeRoute, setActiveRoute] = useState('Dashboard');
  const [schedulePeriodoId, setSchedulePeriodoId] = useState('');

  const handleNavigate = (route: string, params?: { periodoId?: string }) => {
    if (route === 'Horarios' && params?.periodoId) setSchedulePeriodoId(params.periodoId);
    setActiveRoute(route);
  };

  if (!user) return null;

  const userName = getFullName(user.nombre, user.apellidoPaterno);
  const userEmail = user.email;

  const roleName = user.rol.toLowerCase();
  const isTeacher = roleName.includes('maestro') || roleName.includes('profesor') || roleName.includes('docente');
  const isStudent = roleName.includes('estudiante') || roleName.includes('alumno') || roleName.includes('padre') || roleName.includes('apoderado') || roleName.includes('tutor');

  const renderContent = () => {
    switch (activeRoute) {
      case 'Dashboard':
        return <Dashboard />;
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
      case 'Tesoreria':
        return <PlaceholderScreen title="Económico" />;
      case 'Cursos':
        if (isTeacher) return <MaestroCursosScreen />;
        if (isStudent) return <EstudianteCursosScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Calificaciones':
        if (isStudent) return <EstudianteEvaluacionesScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Materias':
        if (isTeacher) return <MaestroMateriasScreen />;
        if (isStudent) return <EstudianteMateriasScreen />;
        return <AcademicServicesScreen area="learning" onNavigate={handleNavigate} />;
      case 'Pagos':
        return <PlaceholderScreen title="Económico" />;
      case 'Horarios':
      case 'Horario':
        return <ScheduleScreen initialPeriodoId={schedulePeriodoId} />;
      default:
        return navItems.some((n) => n.route === activeRoute)
          ? <PlaceholderScreen title={navItems.find((n) => n.route === activeRoute)?.label ?? activeRoute} />
          : <NotFoundScreen onGoBack={() => setActiveRoute('Dashboard')} />;
    }
  };

  return (
    <>
      <AppLayout
        title={panelTitle}
        userName={userName}
        userEmail={userEmail}
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
