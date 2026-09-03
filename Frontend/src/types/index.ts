export type Genero = 'masculino' | 'femenino' | 'otro';
export type EstadoUsuario = 0 | 1 | 2;
export type TipoDocumento = 'DNI' | 'Pasaporte' | 'CI' | string;
export type TipoContacto = 'Telefono' | 'Celular' | 'Whatsapp' | string;

export interface CursoProfesor {
  asignacionId: string;
  cursoId: string;
  nivel: string;
  grado: string;
  paralelo: string;
  materiaId: string;
  materia: string;
  anio: number;
}

export interface AuthUsuario {
  id: string;
  username: string;
  email: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fotoUrl: string | null;
  rol: string;
  rolId: string;
  nivel?: string;
  grado?: string;
  paralelo?: string;
  periodoId?: string;
  anio?: number;
  cursos?: CursoProfesor[];
}

export interface LoginResponse {
  requires2FA?: boolean;
  token?: string;
  usuario?: AuthUsuario;
  sessionId?: string;
  tempToken?: string;
  emailMasked?: string;
  expiresInSeconds?: number;
  message?: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface ApiError {
  error: string;
}

export interface UsuarioCuenta {
  id?: string;
  username: string;
  email: string;
  ultimoLogin?: string | null;
}

export interface UsuarioDoc {
  id?: string;
  tipoDoc: TipoDocumento;
  numeroDoc: string;
  docUrl?: string | null;
  /** URI local del PDF seleccionado (no se envía dentro de datos). */
  fileUri?: string;
  fileName?: string;
}

export interface UsuarioDir {
  id?: string;
  zona: string;
  distrito?: string | null;
  bloque?: string | null;
  calle?: string | null;
  numero?: string | null;
  edificio?: string | null;
  piso?: number | null;
  referencia?: string | null;
}

export interface UsuarioCont {
  id?: string;
  tipo: TipoContacto;
  contenido: string;
}

export interface Usuario {
  id: string;
  rolId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nacimiento: string;
  genero?: Genero | null;
  fotoUrl?: string | null;
  estado: EstadoUsuario;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  rol?: string;
  username?: string;
  email?: string;
  ultimoLogin?: string | null;
  cuenta?: UsuarioCuenta | null;
  documentos?: UsuarioDoc[];
  direccion?: UsuarioDir | null;
  contactos?: UsuarioCont[];
}

export interface UsuariosListResponse {
  data: Usuario[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UsuariosQueryParams {
  page?: number;
  limit?: number;
  rolId?: string;
  estado?: EstadoUsuario;
  buscar?: string;
}

export interface UpdateUsuarioPayload {
  rolId?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nacimiento?: string;
  genero?: Genero;
  estado?: EstadoUsuario;
  cuenta?: {
    username?: string;
    email?: string;
    password?: string;
  };
  documentos?: UsuarioDoc[];
  direccion?: UsuarioDir;
  contactos?: UsuarioCont[];
  maestro?: { especialidad?: string };
}

export interface CreateUsuarioPayload {
  rolId: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nacimiento: string;
  genero?: Genero;
  estado?: EstadoUsuario;
  cuenta?: { username: string; email: string; password: string };
  documentos?: UsuarioDoc[];
  direccion?: UsuarioDir;
  contactos?: UsuarioCont[];
  maestro?: { especialidad?: string; fechaContratacion?: string };
  apoderadoId?: string;
  parentesco?: string;
}

export interface UpdateUsuarioResponse {
  message: string;
  fotoUrl: string | null;
}
