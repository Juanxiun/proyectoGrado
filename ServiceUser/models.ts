export type Genero = 'masculino' | 'femenino' | 'otro';
export type EstadoUsuario = 'activo' | 'inactivo' | 'bloqueado' | 0 | 1 | 2;
export type EstadoEstudiante = 'activo' | 'retirado' | 'egresado' | 'suspendido';
export type EstadoMaestro = 'activo' | 'inactivo' | 'retirado';
export type TipoDocumento = 'DNI' | 'Pasaporte' | 'CI' | string;
export type TipoContacto = 'Telefono' | 'Celular' | 'Whatsapp' | string;
export type Parentesco = 'Padre' | 'Madre' | 'Tutor Legal' | string;

export interface Rol {
    readonly id: bigint;
    rol: string;
    descripcion?: string | null;
    activo?: boolean;
}

export interface UsuarioCuenta {
    readonly id: bigint;
    usuarioId: bigint;
    username: string;
    email?: string | null;
    passwordHash: string;
    emailVerificado?: boolean;
    ultimoLogin?: Date | null;
    intentosFallidos?: number;
    bloqueadoHasta?: Date | null;
    fechaCreacion?: Date;
    fechaActualizacion?: Date;
}

export interface UsuarioDocumento {
    readonly id: bigint;
    usuarioId: bigint;
    tipoDoc: TipoDocumento;
    numeroDoc: string;
    docUrl?: string | null;
    fechaCreacion?: Date;
}
export type UsuarioDoc = UsuarioDocumento;

export interface UsuarioDireccion {
    readonly id: bigint;
    usuarioId: bigint;
    zona: string;
    distrito?: string | null;
    bloque?: string | null;
    calle?: string | null;
    numero?: string | null;
    edificio?: string | null;
    piso?: number | null;
    referencia?: string | null;
    fechaActualizacion?: Date;
}
export type UsuarioDir = UsuarioDireccion;

export interface UsuarioContacto {
    readonly id: bigint;
    usuarioId: bigint;
    tipo: TipoContacto;
    contenido: string;
    principal?: boolean;
    fechaCreacion?: Date;
}
export type UsuarioCont = UsuarioContacto;

export interface Estudiante {
    readonly id: bigint;
    usuarioId: bigint;
    fechaIngreso: Date;
    fechaEgreso?: Date | null;
    estado: EstadoEstudiante;
    fechaCreacion?: Date;
    fechaActualizacion?: Date;
}

export interface Apoderado {
    readonly id: bigint;
    usuarioId: bigint;
    ocupacion?: string | null;
    fechaCreacion?: Date;
}

export interface EstudianteApoderado {
    estudianteId: bigint;
    apoderadoId: bigint;
    parentesco: Parentesco;
    esPrincipal: boolean;
    autorizadoRecoger?: boolean;
    fechaCreacion?: Date;
}

export interface Maestro {
    readonly id: bigint;
    usuarioId: bigint;
    especialidad?: string | null;
    materias?: Array<{ id: string; codigo?: string; nombre: string }>;
    fechaContratacion: Date;
    fechaRetiro?: Date | null;
    estado: EstadoMaestro;
    fechaCreacion?: Date;
    fechaActualizacion?: Date;
}

export interface Usuario {
    readonly id: bigint;
    rolId: bigint;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno?: string | null;
    nacimiento: Date;
    genero?: Genero;
    fotoUrl?: string | null;
    estado: EstadoUsuario;
    readonly fechaCreacion: Date;
    fechaActualizacion: Date;
    rol?: Rol;
    cuenta?: UsuarioCuenta;
    documentos?: UsuarioDocumento[];
    direccion?: UsuarioDireccion;
    contactos?: UsuarioContacto[];
    apoderados?: EstudianteApoderado[];
}

export type CreateUsuarioInput = Omit<Usuario, 'id' | 'fechaCreacion' | 'fechaActualizacion' | 'rol' | 'cuenta' | 'documentos' | 'direccion' | 'contactos' | 'apoderados'>;
export type UpdateUsuarioInput = Partial<CreateUsuarioInput>;