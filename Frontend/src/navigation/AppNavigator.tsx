import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { ROLE_DASHBOARD_MAP, ROLES } from '../constants/config';
import { LoginScreen } from '../features/auth/screens/LoginScreen';
import { TwoFactorScreen } from '../features/auth/screens/TwoFactorScreen';
import { DireccionDashboard } from '../features/direccion/screens/DireccionDashboard';
import { ControlDashboard } from '../features/control/screens/ControlDashboard';
import { MaestrosDashboard } from '../features/maestros/screens/MaestrosDashboard';
import { UsuariosDashboard } from '../features/usuarios/screens/UsuariosDashboard';
import { ServerErrorScreen } from '../displays/screens/ErrorScreens';
import { RoleShell } from './RoleShell';
import {
  CONTROL_NAV,
  DIRECTOR_NAV,
  MAESTROS_NAV,
  USUARIOS_NAV,
} from './navConfig';

export type RootStackParamList = {
  Login: undefined;
  TwoFactor: undefined;
  Direccion: undefined;
  Control: undefined;
  Maestros: undefined;
  Usuarios: undefined;
  ServerError: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function getRoleScreen(rol: string): keyof RootStackParamList {
  const normalized = rol.toLowerCase();
  const mapped = ROLE_DASHBOARD_MAP[normalized];
  if (mapped) return mapped as keyof RootStackParamList;

  switch (normalized) {
    case ROLES.DIRECTOR: return 'Direccion';
    case ROLES.GERENCIA: return 'Control';
    case ROLES.PROFESOR: return 'Maestros';
    case ROLES.ESTUDIANTE:
    case ROLES.PADRES:
      return 'Usuarios';
    default:
      return 'Usuarios';
  }
}

function AppNavigator() {
  const { isAuthenticated, isLoading, user, pending2FA } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator size="large" color="#801529" />
      </View>
    );
  }

  const activeScreen = pending2FA ? 'TwoFactor' : isAuthenticated && user
    ? getRoleScreen(user.rol)
    : 'Login';

  return (
    <NavigationContainer key={activeScreen}>
      <Stack.Navigator
        initialRouteName={activeScreen}
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        {!isAuthenticated ? (
          pending2FA
            ? <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
            : <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Direccion">
              {() => (
                <RoleShell navItems={DIRECTOR_NAV} dashboardComponent={DireccionDashboard} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Control">
              {() => (
                <RoleShell navItems={CONTROL_NAV} dashboardComponent={ControlDashboard} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Maestros">
              {() => (
                <RoleShell
                  navItems={MAESTROS_NAV}
                  dashboardComponent={MaestrosDashboard}
                  panelTitle="Panel Docente"
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Usuarios">
              {() => (
                <RoleShell
                  navItems={USUARIOS_NAV}
                  dashboardComponent={UsuariosDashboard}
                  panelTitle="Panel Estudiante"
                />
              )}
            </Stack.Screen>
          </>
        )}
        <Stack.Screen name="ServerError" component={ServerErrorScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
