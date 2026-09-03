export interface TwoFactorEmailProps {
  nombre: string;
  username: string;
  rol: string;
  codigo2FA: string;
  tiempoExpiracionMinutos: number;
  dispositivo: {
    browser?: string;
    os?: string;
    device?: string;
    ip?: string;
  };
  fechaHora: string;
}

export function generate2FABentoEmailHtml(props: TwoFactorEmailProps): string {
  const {
    nombre,
    username,
    rol,
    codigo2FA,
    tiempoExpiracionMinutos,
    dispositivo,
    fechaHora,
  } = props;

  const deviceText = `${dispositivo.browser ?? "Navegador Web"} en ${dispositivo.os ?? "Sistema Operativo"}`;
  const ipText = dispositivo.ip || "IP no registrada";

  return `
  <!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso Multifactor - Shalom</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0c10;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #FFFFFF;
      -webkit-font-smoothing: antialiased;
    }
    table {
      border-spacing: 0;
      width: 100%;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0c10;
      padding: 30px 10px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #14161d;
      border: 1px solid rgba(240, 213, 179, 0.15);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    }
    .bento-padding {
      padding: 24px;
    }
    
    /* Header Box */
    .header-box {
      background: #1c1e28;
      border: 1px solid rgba(240, 213, 179, 0.1);
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 14px;
    }
    
    /* Hero OTP Card */
    .bento-hero {
      background: linear-gradient(135deg, #7A1F3D 0%, #4D1226 100%);
      border: 1px solid #F0D5B3;
      border-radius: 16px;
      padding: 24px 20px;
      text-align: center;
      margin-bottom: 14px;
      box-shadow: 0 6px 18px rgba(122, 31, 61, 0.35);
    }
    .otp-code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 10px;
      color: #F0D5B3;
      background: rgba(0, 0, 0, 0.35);
      padding: 10px 20px;
      border-radius: 10px;
      display: inline-block;
      border: 1px dashed rgba(240, 213, 179, 0.5);
      margin: 12px 0;
    }
    
    /* Grid system */
    .grid-2col {
      width: 100%;
    }
    .grid-cell {
      width: 50%;
      vertical-align: top;
      padding-bottom: 10px;
    }
    .cell-box {
      background: #1c1e28;
      border: 1px solid rgba(240, 213, 179, 0.1);
      border-radius: 12px;
      padding: 14px 16px;
      box-sizing: border-box;
    }
    .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #F0D5B3;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .value {
      font-size: 13px;
      font-weight: 500;
      color: #FFFFFF;
    }

    /* Badges & Alerts */
    .badge-pill {
      display: inline-block;
      background-color: rgba(240, 213, 179, 0.12);
      color: #F0D5B3;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid rgba(240, 213, 179, 0.25);
    }
    .alert-box {
      background: rgba(122, 31, 61, 0.25);
      border: 1px solid rgba(122, 31, 61, 0.6);
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 11px;
      color: #e2e8f0;
      line-height: 1.4;
    }
    .footer-text {
      text-align: center;
      font-size: 10px;
      color: #64748b;
      padding: 16px 20px 24px 20px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table align="center" class="container">
      <tr>
        <td class="bento-padding">
          
          <div class="header-box">
            <table style="width: 100%;">
              <tr>
                <td>
                  <span class="badge-pill">Autenticación Segura 2FA</span>
                  <h1 style="margin: 8px 0 2px 0; font-size: 18px; color: #FFFFFF; font-weight: 700; letter-spacing: 0.5px;">
                    CENTRO EDUCATIVO CRISTIANO SHALOM
                  </h1>
                  <p style="margin: 0; font-size: 12px; color: #a0a5b5;">
                    Hola, <strong style="color: #F0D5B3;">${nombre}</strong> (@${username}) • Rol: <span style="text-transform: capitalize;">${rol}</span>
                  </p>
                </td>
              </tr>
            </table>
          </div>

          <div class="bento-hero">
            <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #F0D5B3; font-weight: 600;">
              Código de Verificación
            </p>
            <div>
              <span class="otp-code">${codigo2FA}</span>
            </div>
            <p style="margin: 0; font-size: 11px; color: rgba(255, 255, 255, 0.85);">
              ⏱ Válido únicamente durante los próximos <strong>${tiempoExpiracionMinutos} minutos</strong>.
            </p>
          </div>

          <table class="grid-2col">
            <tr>
              <td class="grid-cell" style="padding-right: 5px;">
                <div class="cell-box">
                  <div class="label">Dispositivo</div>
                  <div class="value">${deviceText}</div>
                </div>
              </td>
              <td class="grid-cell" style="padding-left: 5px;">
                <div class="cell-box">
                  <div class="label">Dirección IP</div>
                  <div class="value">${ipText}</div>
                </div>
              </td>
            </tr>
            <tr>
              <td class="grid-cell" style="padding-right: 5px;">
                <div class="cell-box">
                  <div class="label">Fecha y Hora</div>
                  <div class="value">${fechaHora}</div>
                </div>
              </td>
              <td class="grid-cell" style="padding-left: 5px;">
                <div class="cell-box" style="border-color: rgba(122, 31, 61, 0.4);">
                  <div class="label">Nivel de Acceso</div>
                  <div class="value" style="color: #F0D5B3;">Restringido (${rol})</div>
                </div>
              </td>
            </tr>
          </table>

          <div class="alert-box">
            <strong style="color: #F0D5B3;">🛡️ Aviso de Seguridad:</strong> Si tú no has solicitado este código para ingresar a la plataforma, ignora este correo y actualiza tu contraseña inmediatamente.
          </div>

        </td>
      </tr>
      <tr>
        <td class="footer-text">
          © ${new Date().getFullYear()} Centro Educativo Cristiano Shalom. Todos los derechos reservados.<br>
          Este es un mensaje automático de autenticación de seguridad.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
  `.trim();
}
