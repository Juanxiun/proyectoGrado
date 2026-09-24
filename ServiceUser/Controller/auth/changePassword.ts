import { Context } from "@oak/oak";
import { query } from "../../connects/Database/transaction.ts";
// deno-lint-ignore no-explicit-any
import bcrypt from "bcryptjs";

export function validatePasswordPolicy(password: string): { valid: boolean; error?: string } {
  if (typeof password !== "string" || password.length < 8) {
    return { valid: false, error: "La contraseña debe tener al menos 8 caracteres" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "La contraseña debe incluir al menos una letra mayúscula" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "La contraseña debe incluir al menos un número" };
  }
  if (!/[@#$&]/.test(password)) {
    return { valid: false, error: "La contraseña debe incluir al menos un carácter especial entre (@, #, $, &)" };
  }
  return { valid: true };
}

export async function changePassword(ctx: Context): Promise<void> {
  try {
    const auth = ctx.state.auth;
    if (!auth?.sub) {
      ctx.response.status = 401;
      ctx.response.body = { error: "No autenticado" };
      return;
    }

    const body = await ctx.request.body.json();
    const { newPassword: requestedPassword, passwordNueva, confirmPassword, passwordActual } = body ?? {};
    const newPassword = requestedPassword ?? passwordNueva;

    if (!newPassword) {
      ctx.response.status = 400;
      ctx.response.body = { error: "La nueva contraseña es requerida", field: "newPassword" };
      return;
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Las contraseñas no coinciden", field: "confirmPassword" };
      return;
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      ctx.response.status = 400;
      ctx.response.body = { error: policyCheck.error, field: "newPassword" };
      return;
    }

    if (passwordActual) {
      const current = await query<{ password_hash: string }>(
        `SELECT password_hash FROM usuario_cuenta WHERE usuario_id = $1`,
        [auth.sub],
      );
      if (!current.rows.length) {
        ctx.response.status = 404;
        ctx.response.body = { error: "Cuenta no encontrada" };
        return;
      }
      // deno-lint-ignore no-explicit-any
      const validCurrent = await (bcrypt as any).compare(passwordActual, current.rows[0].password_hash);
      if (!validCurrent) {
        ctx.response.status = 400;
        ctx.response.body = { error: "La contraseña actual no es correcta", field: "passwordActual" };
        return;
      }
    }

    // deno-lint-ignore no-explicit-any
    const hash = await (bcrypt as any).hash(newPassword, 12);

    await query(
      `UPDATE usuario_cuenta
       SET password_hash = $1, primer_login = false, password_actualizado = true, ultimo_login = NOW()
       WHERE usuario_id = $2`,
      [hash, auth.sub],
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Contraseña actualizada exitosamente",
    };
  } catch (err) {
    console.error("[changePassword]", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Error al actualizar la contraseña" };
  }
}
