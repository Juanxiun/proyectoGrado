import { apiRequest } from "./client";
import * as Location from "expo-location";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { LoginRequest, LoginResponse } from "../types";

async function locationForLogin(): Promise<Record<string, unknown>> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return {};
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const place = await Location.reverseGeocodeAsync(current.coords).then((items: Location.LocationGeocodedAddress[]) => items[0]).catch(() => null);
    return {
      ubicacion: {
        lat: current.coords.latitude,
        lon: current.coords.longitude,
        ciudad: place?.city || place?.subregion || undefined,
        zona: place?.district || place?.region || undefined,
        pais: place?.country || undefined,
      },
    };
  } catch {
    return {};
  }
}

function deviceForLogin(): Record<string, unknown> {
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ');
  return {
    dispositivo: {
      device: model || (Device.deviceType === Device.DeviceType.DESKTOP ? 'Navegador de escritorio' : Platform.OS === 'web' ? 'Navegador web' : 'Dispositivo móvil'),
      os: [Device.osName, Device.osVersion].filter(Boolean).join(' ') || 'Desconocido',
    },
  };
}

export const authApi = {
  login: async (credentials: LoginRequest) =>
    apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { ...credentials, ...deviceForLogin(), ...await locationForLogin() },
      auth: false,
    }),
  verify2FA: async (tempToken: string, code: string) =>
    apiRequest<LoginResponse>("/api/auth/verify-2fa", {
      method: "POST",
      body: { tempToken, code, ...deviceForLogin(), ...await locationForLogin() },
      auth: false,
    }),
  resend2FA: (tempToken: string) =>
    apiRequest<{ message: string }>("/api/auth/resend-2fa", {
      method: "POST",
      body: { tempToken },
      auth: false,
    }),
  changePassword: (payload: { passwordActual?: string; passwordNueva: string }) =>
    apiRequest<{ message: string; debeCambiarPassword?: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: payload,
    }),
  logout: () =>
    apiRequest<{ message?: string }>("/api/auth/logout", { method: "POST" }),
};
