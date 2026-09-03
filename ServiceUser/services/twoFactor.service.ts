import { getRedis } from "../connects/Redis/redis.ts";
import { brevo, EMAIL_FROM } from "../config/send.conf.ts";
import { generate2FABentoEmailHtml } from "../utils/emailTemplate.ts";
import { DeviceInfo, LocationInfo } from "../utils/deviceDetector.ts";

const ROLES_2FA = ["director", "maestros", "maestro", "profesor", "docente", "control", "gerencia"];
function generateCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000)).padStart(6, "0");
}

export function is2FARequiredForRole(rol: string): boolean {
  if (!rol) return false;
  const cleanRol = rol.trim().toLowerCase();
  return ROLES_2FA.includes(cleanRol);
}

export interface TwoFactorSessionData {
  userId: string;
  username: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fotoUrl: string | null;
  rol: string;
  rolId: string;
  // deno-lint-ignore no-explicit-any
  extraInfo: Record<string, any>;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
  code: string;
  attempts: number;
  createdAt: string;
}

export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "u***@dominio.com";
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export async function generateAndSend2FACode(params: {
  userId: string;
  username: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fotoUrl: string | null;
  rol: string;
  rolId: string;
  // deno-lint-ignore no-explicit-any
  extraInfo: Record<string, any>;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
}): Promise<{ tempToken: string; emailMasked: string; expiresInSeconds: number }> {
  const redis = getRedis();
  const tempToken = crypto.randomUUID();
  const code = generateCode();
  const expiresInSeconds = 300; // 5 minutos

  const sessionData: TwoFactorSessionData = {
    ...params,
    code,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  // Guardar en Redis
  try {
    const key = `2fa:token:${tempToken}`;
    await redis.set(key, JSON.stringify(sessionData), "EX", expiresInSeconds);
    await redis.set(`2fa:user:${params.userId}`, tempToken, "EX", expiresInSeconds);
  } catch (redisErr) {
    console.warn("[2FA] Error guardando código en Redis:", redisErr);
  }

  // Generar HTML Bento Grid
  const fechaHora = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const html = generate2FABentoEmailHtml({
    nombre: `${params.nombre} ${params.apellidoPaterno}`,
    username: params.username,
    rol: params.rol,
    codigo2FA: code,
    tiempoExpiracionMinutos: 5,
    dispositivo: {
      browser: params.deviceInfo.browser,
      os: params.deviceInfo.os,
      device: params.deviceInfo.device,
      ip: params.deviceInfo.ip,
    },
    fechaHora,
  });

  // Envío por correo electrónico con Resend
  try {
    const sendResult = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: "Shalom Edu", email: EMAIL_FROM },
      to: [{ email: params.email }],
      subject: `Tu código de verificación 2FA: ${code}`,
      htmlContent: html,
    });
    console.log(`[2FA] Correo enviado a ${params.email} (Brevo Message ID: ${sendResult.messageId ?? "ok"})`);
  } catch (mailErr) {
    console.error(`[2FA] Error enviando correo a ${params.email}:`, mailErr);
    // En entornos de desarrollo donde el email no esté verificado o no haya internet, el código también se loguea
    console.log(`[2FA DEV FALLBACK] Código 2FA para @${params.username}: ${code}`);
  }

  return {
    tempToken,
    emailMasked: maskEmail(params.email),
    expiresInSeconds,
  };
}

export async function verify2FACode(
  tempToken: string,
  inputCode: string,
): Promise<{ success: boolean; error?: string; sessionData?: TwoFactorSessionData }> {
  const redis = getRedis();
  const key = `2fa:token:${tempToken}`;

  const dataStr = await redis.get(key);
  if (!dataStr) {
    return {
      success: false,
      error: "El código de verificación ha expirado o el token es inválido. Solicita uno nuevo.",
    };
  }

  const sessionData: TwoFactorSessionData = JSON.parse(dataStr);

  if (sessionData.attempts >= 5) {
    await redis.del(key);
    await redis.del(`2fa:user:${sessionData.userId}`);
    return {
      success: false,
      error: "Demasiados intentos fallidos. Por favor inicia sesión nuevamente.",
    };
  }

  if (sessionData.code.trim() !== inputCode.trim()) {
    sessionData.attempts += 1;
    const remainingTtl = await redis.ttl(key);
    if (remainingTtl > 0) {
      await redis.set(key, JSON.stringify(sessionData), "EX", remainingTtl);
    }
    return {
      success: false,
      error: `Código de verificación incorrecto. Intentos restantes: ${5 - sessionData.attempts}`,
    };
  }

  // Código correcto: eliminar de Redis para evitar reutilización
  await redis.del(key);
  await redis.del(`2fa:user:${sessionData.userId}`);

  return {
    success: true,
    sessionData,
  };
}

export async function resend2FACode(
  tempToken: string,
): Promise<{ success: boolean; error?: string; emailMasked?: string }> {
  const redis = getRedis();
  const key = `2fa:token:${tempToken}`;

  const dataStr = await redis.get(key);
  if (!dataStr) {
    return {
      success: false,
      error: "La sesión 2FA ha expirado. Por favor vuelve a ingresar tus credenciales.",
    };
  }

  const sessionData: TwoFactorSessionData = JSON.parse(dataStr);
  const newCode = generateCode();
  sessionData.code = newCode;
  sessionData.attempts = 0;

  const expiresInSeconds = 300;
  await redis.set(key, JSON.stringify(sessionData), "EX", expiresInSeconds);
  await redis.set(`2fa:user:${sessionData.userId}`, tempToken, "EX", expiresInSeconds);

  const fechaHora = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  const html = generate2FABentoEmailHtml({
    nombre: `${sessionData.nombre} ${sessionData.apellidoPaterno}`,
    username: sessionData.username,
    rol: sessionData.rol,
    codigo2FA: newCode,
    tiempoExpiracionMinutos: 5,
    dispositivo: {
      browser: sessionData.deviceInfo.browser,
      os: sessionData.deviceInfo.os,
      device: sessionData.deviceInfo.device,
      ip: sessionData.deviceInfo.ip,
    },
    fechaHora,
  });

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: "Shalom Edu", email: EMAIL_FROM },
      to: [{ email: sessionData.email }],
      subject: `🔐 Nuevo código de verificación 2FA: ${newCode}`,
      htmlContent: html,
    });
  } catch (err) {
    console.error("[2FA] Error al reenviar correo:", err);
    console.log(`[2FA DEV FALLBACK] Nuevo código 2FA para @${sessionData.username}: ${newCode}`);
  }

  return {
    success: true,
    emailMasked: maskEmail(sessionData.email),
  };
}