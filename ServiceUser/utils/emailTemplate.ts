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

  // Aseguramos que el código principal es el foco visual.
  const deviceText = `${dispositivo.browser ?? "Navegador Web"} en ${dispositivo.os ?? "Sistema Operativo"}`;
  const ipText = dispositivo.ip || "IP no registrada";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SGA - Verificación de Acceso</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        /* Estilos generales y reset para email clients */
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f7fa; /* Fondo más suave */
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 16px;
            color: #333333;
        }
        .container {
            max-width: 450px; /* Ampliado ligeramente para más contenido */
            width: 90%;
            margin: 20px 0;
            background-color: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 6px 20px rgba(0,0,0,0.1);
            text-align: center;
        }

        /* Header - Identidad corporativa */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            background-color: #721c24; /* Manteniendo el color de marca */
            color: white;
            padding: 15px 20px;
            border-radius: 10px 10px 0 0; /* Solo bordes superiores redondeados */
            margin-bottom: 20px;
        }
        .header img {
            max-width: 40px;
            margin-top: 5px;
        }
        .header .info {
            text-align: right;
            line-height: 1.2;
        }
        .header .info div:first-child {
             font-size: 1.1em;
             font-weight: bold;
        }
        .header .info div:last-child {
             font-size: 0.9em;
             opacity: 0.9;
        }

        /* Cuerpo del mensaje y títulos */
        h1 {
            font-size: 24px;
            color: #721c24;
            margin-top: 0;
            margin-bottom: 10px;
        }
        p {
            line-height: 1.6;
            margin-bottom: 15px;
        }

        /* Código de verificación (Foco principal) */
        .code-box {
            background-color: #e9ecef; /* Gris claro para destacar */
            border: 1px solid #dee2e6;
            color: #721c24;
            font-size: 38px;
            font-weight: bold;
            letter-spacing: 5px;
            padding: 20px;
            margin: 25px 0;
            border-radius: 8px;
            display: inline-block;
            width: 80%;
            max-width: 300px;
        }

        /* Temporizador */
        .timer-container {
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 30px;
            padding: 10px 0;
        }
        .timer-container .icon {
            color: #ffc107; /* Naranja suave */
            margin-right: 10px;
        }
        .timer-container .time {
            font-weight: bold;
            color: #dc3545; /* Rojo de alerta */
        }

        /* Botones de acción */
        .btn-copy, .btn-verification {
            display: inline-block;
            text-decoration: none; /* Quita el subrayado */
            background-color: #721c24; /* Color de marca */
            color: white;
            padding: 12px 25px;
            border-radius: 6px;
            font-weight: bold;
            transition: background-color 0.3s;
            cursor: pointer;
            border: none;
            margin-bottom: 20px;
        }
        .btn-copy:hover, .btn-verification:hover {
            background-color: #621820;
        }

        /* Grid de información (Datos de la sesión) */
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            text-align: left;
            padding: 10px 0;
            border-top: 1px solid #eee;
            border-bottom: 1px solid #eee;
            margin-bottom: 25px;
        }
        .info-grid div {
            display: flex;
            flex-direction: column;
            font-size: 0.95em;
        }
        .info-grid .label {
            font-weight: 600;
            color: #555;
            margin-bottom: 3px;
            font-size: 0.85em;
        }
        .info-grid .value {
            color: #333;
            font-weight: 500;
        }

        /* Alerta de seguridad */
        .alert {
            display: flex;
            align-items: flex-start;
            background-color: #fff3cd;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #ffeeba;
            margin-bottom: 20px;
        }
        .alert .icon {
            flex-shrink: 0;
            margin-right: 15px;
            font-size: 20px;
            line-height: 1;
            margin-top: 3px;
            color: #856404;
        }
        .alert .message-content {
             /* Asegura que el texto dentro de la alerta sea legible */
            line-height: 1.4;
            font-size: 0.95em;
        }
        
        .footer {
            text-align: center;
        }

    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://via.placeholder.com/40/721c24/FFFFFF?text=SGA" alt="Logo">
            <div class="info">
                <div>AUTENTICACIÓN SEGURA</div>
                <div>Juanitorex Gato Palta</div>
                <div>ROL: DIRECTOR</div>
            </div>
        </div >
        
        <h1>Sistema de Gestión Académica</h1>
        <p>Estimado/a <strong>Juanitorex Gato Palta</strong>, necesitamos su código de verificación para completar su inicio de sesión seguro.</p>
        
        <!-- Bloque de Código Principal -->
        <div class="code-box">
            <span>${codigo2FA}</span>
        </div>
        
        <!-- Temporizador mejorado -->
        <div class="timer-container">
            <i class="fas fa-clock icon"></i>
            <span>Válido únicamente durante los próximos <span class="time">${tiempoExpiracionMinutos} MINUTOS</span></span>
        </div>
        
        <button class="btn-copy">
            <i class="fas fa-copy icon" style="margin-right: 8px;"></i>
            Copiar código
        </button>
        
        <!-- Datos de sesión -->
        <div class="info-grid">
            <div>
                <span class="label">Dispositivo</span>
                <span class="value">${deviceText}</span>
            </div>
            <div>
                <span class="label">Dirección IP</span>
                <span class="value">${ipText}</span>
            </div>
            <div>
                <span class="label">Fecha y Hora</span>
                <span class="value">${fechaHora}</span>
            </div>
            <div>
                <span class="label">Nivel de Acceso</span>
                <span class="value">${rol}</span>
            </div>
        </div>
        
        <!-- Aviso de seguridad mejorado -->
        <div class="alert">
            <i class="fas fa-shield-alt icon"></i>
            <div class="message-content">
                <strong>⚠️ Advertencia de Seguridad:</strong> Si tú no has solicitado este código, por favor, ignora este mensaje y actualiza tu contraseña inmediatamente. Alguien podría estar intentando acceder a tu cuenta sin autorización.
            </div>
        </div>
        
        <div class="footer">
            <button class="btn-verification">Cancelar o Volver al Login</button>
        </div>
    </div >
</body>
</html>
  `.trim();
}