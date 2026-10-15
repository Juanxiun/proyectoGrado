import "./env.config.ts";
import { BrevoClient } from "@getbrevo/brevo";

export const EMAIL_FROM = Deno.env.get("EMAIL_FROM");

// config -> brevo correo
const apikeyBrevo = String(Deno.env.get("BREVO_API_KEY"));
export const brevo = new BrevoClient({
  apiKey: apikeyBrevo,
  timeoutInSeconds: 30,
  maxRetries: 3,
});
