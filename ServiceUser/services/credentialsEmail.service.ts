import { brevo, EMAIL_FROM } from "../config/send.conf.ts";
import { generateCredentialsWelcomeEmailHtml, CredentialsEmailProps } from "../utils/emailTemplate.ts";

export async function sendWelcomeCredentialsEmail(
  props: CredentialsEmailProps & { targetEmail?: string },
): Promise<void> {
  const target = props.targetEmail || props.email;
  const html = generateCredentialsWelcomeEmailHtml(props);

  try {
    const sendResult = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: "Shalom SGA", email: EMAIL_FROM },
      to: [{ email: target }],
      subject: `Bienvenido a Shalom SGA - Credenciales de acceso para ${props.nombre}`,
      htmlContent: html,
    });
    console.log(
      `[CredentialsEmail] Correo con credenciales enviado a ${target} (ID: ${sendResult.messageId ?? "ok"})`,
    );
  } catch (mailErr) {
    console.warn(`[CredentialsEmail] No se pudo enviar correo a ${target}:`, mailErr);
    console.log(
      `[CREDENTIALS FALLBACK] Usuario: ${props.username} | Pass temporal: ${props.passwordTemporal} | Rol: ${props.rol}`,
    );
  }
}
