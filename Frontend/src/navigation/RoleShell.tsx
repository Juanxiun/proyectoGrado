import { useState } from 'react';
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

interface RoleShellProps {
  navItems: NavItem[];
  dashboardComponent: React.ComponentType;
  panelTitle?: string;
}

export function RoleShell({ navItems, dashboardComponent: Dashboard, panelTitle = 'Panel Administrativo' }: RoleShellProps) {
  const { user } = useAuth();
  const [activeRoute, setActiveRoute] = useState('Dashboard');

  if (!user) return null;

  const userName = getFullName(user.nombre, user.apellidoPaterno);
  const userEmail = user.email;

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
        return <PlaceholderScreen title="Materias" />;
      case 'Inscripciones':
        return <PlaceholderScreen title="Materias" />;
      case 'Evaluaciones':
        return <PlaceholderScreen title="Evaluaciones" />;
      case 'Tesoreria':
        return <PlaceholderScreen title="Económico" />;
      case 'Cursos':
        return <PlaceholderScreen title="Materias" />;
      case 'Calificaciones':
        return <PlaceholderScreen title="Evaluaciones" />;
      case 'Pagos':
        return <PlaceholderScreen title="Económico" />;
      case 'Horario':
        return <PlaceholderScreen title="Horario" />;
      default:
        return navItems.some((n) => n.route === activeRoute)
          ? <PlaceholderScreen title={navItems.find((n) => n.route === activeRoute)?.label ?? activeRoute} />
          : <NotFoundScreen onGoBack={() => setActiveRoute('Dashboard')} />;
    }
  };

  return (
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
  );
}
