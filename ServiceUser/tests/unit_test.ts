import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  calculateHaversineDistanceKm,
  evaluateStudentDistanceCheating,
} from "../utils/geoDistance.ts";
import { formatDuration } from "../services/session.service.ts";
import {
  is2FARequiredForRole,
  maskEmail,
} from "../services/twoFactor.service.ts";
import { generate2FABentoEmailHtml } from "../utils/emailTemplate.ts";

Deno.test("GeoDistance: Haversine calculates correct distance between two points", () => {
  // La Paz (Plaza Murillo) vs El Alto (Ceja): ~10-12 km
  const dist = calculateHaversineDistanceKm(-16.4958, -68.1336, -16.5050, -68.1630);
  assertEquals(dist > 2 && dist < 15, true);
});

Deno.test("AntiCheat: Flags suspicious distant student login as posible trampa", () => {
  const previousSession = {
    sessionId: "prev-123",
    ubicacion: { lat: -16.5000, lon: -68.1500, ciudad: "La Paz" },
    inicioConexion: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // hace 5 minutos
    dispositivo: { browser: "Chrome", os: "Windows", device: "Desktop", ip: "190.181.1.1" },
  };

  // Login en Santa Cruz (-17.7833, -63.1821, >400 km) 5 minutos después
  const result = evaluateStudentDistanceCheating(
    { lat: -17.7833, lon: -63.1821, ciudad: "Santa Cruz" },
    [previousSession],
  );

  assertEquals(result.posibleTrampa, true);
  assertStringIncludes(result.alertaMensaje ?? "", "Posible trampa detectada");
});

Deno.test("AntiCheat: Normal close-by login is not flagged", () => {
  const previousSession = {
    sessionId: "prev-123",
    ubicacion: { lat: -16.5000, lon: -68.1500, ciudad: "La Paz", zona: "Centro" },
    inicioConexion: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    dispositivo: { browser: "Chrome", os: "Windows", device: "Desktop", ip: "190.181.1.1" },
  };

  // Login a 500 metros en la misma ciudad
  const result = evaluateStudentDistanceCheating(
    { lat: -16.5020, lon: -68.1510, ciudad: "La Paz", zona: "Centro" },
    [previousSession],
  );

  assertEquals(result.posibleTrampa, false);
});

Deno.test("2FA Roles: Correctly identifies 2FA mandatory roles", () => {
  assertEquals(is2FARequiredForRole("Director"), true);
  assertEquals(is2FARequiredForRole("director"), true);
  assertEquals(is2FARequiredForRole("Maestro"), true);
  assertEquals(is2FARequiredForRole("Maestros"), true);
  assertEquals(is2FARequiredForRole("Profesor"), true);
  assertEquals(is2FARequiredForRole("Control"), true);
  assertEquals(is2FARequiredForRole("Gerencia"), true);

  // Non-2FA roles
  assertEquals(is2FARequiredForRole("Estudiante"), false);
  assertEquals(is2FARequiredForRole("estudiante"), false);
  assertEquals(is2FARequiredForRole("Padres"), false);
});

Deno.test("Email Masking: Masks emails correctly", () => {
  assertEquals(maskEmail("juan.perez@shalom.edu"), "ju***z@shalom.edu");
  assertEquals(maskEmail("ab@test.com"), "a***@test.com");
});

Deno.test("Session Duration: Formats elapsed time properly", () => {
  assertEquals(formatDuration(45 * 1000), "45s");
  assertEquals(formatDuration(2 * 60 * 1000 + 30 * 1000), "2m 30s");
  assertEquals(formatDuration(3 * 3600 * 1000 + 15 * 60 * 1000 + 10 * 1000), "3h 15m 10s");
});

Deno.test("Bento Grid Email: Contains required colors and OTP structure", () => {
  const html = generate2FABentoEmailHtml({
    nombre: "Carlos Ramos",
    username: "carlos_prof",
    rol: "Maestro",
    codigo2FA: "948271",
    tiempoExpiracionMinutos: 5,
    dispositivo: {
      browser: "Firefox 128",
      os: "Windows 11",
      device: "Desktop",
      ip: "192.168.1.50",
    },
    fechaHora: "02/09/2026, 17:30",
  });

  assertStringIncludes(html, "#7A1F3D");
  assertStringIncludes(html, "#F0D5B3");
  assertStringIncludes(html, "948271");
  assertStringIncludes(html, "Carlos Ramos");
  assertStringIncludes(html, "Firefox 128");
  assertStringIncludes(html, "Autenticación Segura 2FA");
});
