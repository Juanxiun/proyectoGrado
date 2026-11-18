import { Alert, Platform } from 'react-native';

export function confirmLogout(logout: () => Promise<void>) {
  const close = () => { void logout().catch(() => Alert.alert('Error', 'No se pudo cerrar sesión. Intenta de nuevo.')); };
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm('¿Desea salir del sistema?')) close();
    return;
  }
  Alert.alert('Cerrar sesión', '¿Desea salir del sistema?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: close },
  ]);
}
