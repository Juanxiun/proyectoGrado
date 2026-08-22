export type Genero = 'masculino' | 'femenino' | 'otro';
export type EstadoUsuario = 0 | 1 | 2;
export type TipoDocumento = 'DNI' | 'Pasaporte' | 'CI' | string;
export type TipoContacto = 'Telefono' | 'Celular' | 'Whatsapp' | string;
export type Parentesco = 'Padre' | 'Madre' | 'Tutor Legal' | string;

export interface Rol {
    readonly id: bigint;
    rol: string;
}

export interface UsuarioCuenta {
    readonly id: bigint;
    usuarioId: bigint;
    username: string;
    passwordHash: string;
    ultimoLogin?: Date | null;
}

export interface UsuarioDoc {
    readonly id: bigint;
    usuarioId: bigint;
    tipoDoc: TipoDocumento;
    numeroDoc: string;
    docUrl?: string | null;
}

export interface UsuarioDir {
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
}

export interface UsuarioCont {
    readonly id: bigint;
    usuarioId: bigint;
    tipo: TipoContacto;
    contenido: string;
}

export interface EstudianteApoderado {
    estudianteId: bigint;
    apoderadoId: bigint;
    parentesco: Parentesco;
    esPrincipal: boolean;
}

export interface Usuario {
    readonly id: bigint;
    rolId: bigint;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    nacimiento: Date;
    genero?: Genero;
    fotoUrl?: string | null;
    estado: EstadoUsuario;
    readonly fechaCreacion: Date;
    fechaActualizacion: Date;
    rol?: Rol;
    cuenta?: UsuarioCuenta;
    documentos?: UsuarioDoc[];
    direccion?: UsuarioDir;
    contactos?: UsuarioCont[];
    apoderados?: EstudianteApoderado[];
}

export type CreateUsuarioInput = Omit<Usuario, 'id' | 'fechaCreacion' | 'fechaActualizacion' | 'rol' | 'cuenta' | 'documentos' | 'direccion' | 'contactos' | 'apoderados'>;
export type UpdateUsuarioInput = Partial<CreateUsuarioInput>;