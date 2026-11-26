// tipos -> datos de tutor en actualizacion
export interface TutorUpdateInput {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  ci?: string;
  celular?: string;
  telefono?: string;
  parentesco?: string;
}

export interface DynamicUsuarioUpdate {
  nivel?: string;
  grado?: string;
  estudiante?: { nivel?: string; grado?: string };
  apoderado?: TutorUpdateInput;
  tutor?: TutorUpdateInput;
  parentesco?: string;
  ocupacion?: string;
}

// archivo -> documento recibido en el formulario
export interface DocumentFilePart {
  index: number;
  bytes: Uint8Array;
  name: string;
}

// fila -> usuario actual en base de datos
export interface UsuarioActual {
  foto_url: string | null;
  username: string;
  rol: string;
  nombre: string;
  apellido_paterno: string;
}

// contexto -> autorizacion de la actualizacion
export interface ContextoActualizacion {
  id: string;
  current: UsuarioActual;
  viewerRole?: string;
  isSelf: boolean;
  targetRole: string;
}
