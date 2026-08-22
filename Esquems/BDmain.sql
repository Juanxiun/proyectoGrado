-- PostgreSQL Production Schema for ShalomDB

-- 1. CONFIGURACIÓN Y TABLAS CORE
CREATE TABLE roles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    nombre VARCHAR(80) NOT NULL,
    apellido_paterno VARCHAR(80) NOT NULL,
    apellido_materno VARCHAR(80) NOT NULL,
    nacimiento DATE NOT NULL,
    genero VARCHAR(15) CHECK (genero IN ('masculino', 'femenino', 'otro')),
    foto_url VARCHAR(500),
    estado SMALLINT NOT NULL DEFAULT 1 CHECK (estado IN (0, 1, 2)), -- 0: Inactivo, 1: Activo, 2: Suspendido
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuario_cuenta (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    ultimo_login TIMESTAMPTZ
);

CREATE TABLE usuario_doc (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo_doc VARCHAR(50) NOT NULL, -- DNI, Pasaporte, CI, etc.
    numero_doc VARCHAR(50) NOT NULL UNIQUE,
    doc_url VARCHAR(500)
);

CREATE TABLE usuario_dir (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    zona VARCHAR(90) NOT NULL,
    distrito VARCHAR(100),
    bloque VARCHAR(100),
    calle VARCHAR(100),
    numero VARCHAR(50),
    edificio VARCHAR(100),
    piso INT,
    referencia TEXT
);

CREATE TABLE usuario_cont (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL, -- Telefono, Celular, Whatsapp
    contenido VARCHAR(200) NOT NULL
);

-- 2. ROLES ESPECÍFICOS Y APODERADOS
CREATE TABLE maestros (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    especialidad VARCHAR(100),
    fecha_contratacion DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Relación N:M de Estudiantes con sus Apoderados/Tutores
CREATE TABLE estudiante_apoderado (
    estudiante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    apoderado_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    parentesco VARCHAR(50) NOT NULL, -- Padre, Madre, Tutor Legal
    es_principal BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (estudiante_id, apoderado_id)
);

-- 3. ESTRUCTURA ACADÉMICA Y CURSOS
CREATE TABLE periodos_academicos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    anio INT NOT NULL UNIQUE, -- Ej: 2026
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE materias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    materia VARCHAR(100) NOT NULL,
    descripcion TEXT
);

CREATE TABLE materia_material (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    materia_id BIGINT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    titulo VARCHAR(250) NOT NULL,
    detalle TEXT,
    mat_url VARCHAR(500) NOT NULL,
    fecha_subida TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cursos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nivel VARCHAR(40) NOT NULL CHECK (nivel IN ('inicial', 'primaria', 'secundaria', 'bachillerato')),
    grado VARCHAR(10) NOT NULL, -- Ej: "1", "2", "6"
    paralelo VARCHAR(5) NOT NULL, -- Ej: "A", "B"
    capacidad_maxima INT NOT NULL DEFAULT 30,
    CONSTRAINT uq_curso UNIQUE (nivel, grado, paralelo)
);

CREATE TABLE curso_asesor (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    maestro_id BIGINT NOT NULL REFERENCES maestros(id) ON DELETE CASCADE,
    periodo_id BIGINT NOT NULL REFERENCES periodos_academicos(id) ON DELETE CASCADE,
    CONSTRAINT uq_asesor_periodo UNIQUE (curso_id, periodo_id)
);

-- Asignación de maestros a materias por curso y periodo
CREATE TABLE asignaciones_docentes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    materia_id BIGINT NOT NULL REFERENCES materias(id) ON DELETE CASCADE,
    maestro_id BIGINT NOT NULL REFERENCES maestros(id) ON DELETE CASCADE,
    periodo_id BIGINT NOT NULL REFERENCES periodos_academicos(id) ON DELETE CASCADE,
    CONSTRAINT uq_materia_curso_periodo UNIQUE (curso_id, materia_id, periodo_id)
);

-- Matriculación del estudiante en un curso y año lectivo
CREATE TABLE inscripciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    curso_id BIGINT NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
    periodo_id BIGINT NOT NULL REFERENCES periodos_academicos(id) ON DELETE RESTRICT,
    fecha_inscripcion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_estudiante_periodo UNIQUE (estudiante_id, periodo_id)
);

-- 4. OPERACIONES ESCOLARES (EVALUACIONES, ASISTENCIA Y PAGOS)
CREATE TABLE evaluaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    asignacion_id BIGINT NOT NULL REFERENCES asignaciones_docentes(id) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    ponderacion DECIMAL(5,2) CHECK (ponderacion > 0 AND ponderacion <= 100),
    bimestre_trimestre SMALLINT NOT NULL CHECK (bimestre_trimestre BETWEEN 1 AND 4),
    fecha_limite DATE
);

CREATE TABLE calificaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    evaluacion_id BIGINT NOT NULL REFERENCES evaluaciones(id) ON DELETE CASCADE,
    estudiante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nota DECIMAL(5,2) CHECK (nota >= 0 AND nota <= 100),
    observacion TEXT,
    CONSTRAINT uq_nota_estudiante UNIQUE (evaluacion_id, estudiante_id)
);

CREATE TABLE asistencia (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    asignacion_id BIGINT NOT NULL REFERENCES asignaciones_docentes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(15) NOT NULL CHECK (estado IN ('presente', 'ausente', 'atraso', 'justificado')),
    justificacion TEXT,
    CONSTRAINT uq_asistencia_estudiante UNIQUE (estudiante_id, asignacion_id, fecha)
);

CREATE TABLE pensiones_pagos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estudiante_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    periodo_id BIGINT NOT NULL REFERENCES periodos_academicos(id) ON DELETE CASCADE,
    mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    monto DECIMAL(10,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
    fecha_pago TIMESTAMPTZ,
    comprobante_url VARCHAR(500)
);

-- 5. ÍNDICES PARA OPTIMIZACIÓN EN PRODUCCIÓN
CREATE INDEX idx_usuarios_rol ON usuarios(rol_id);
CREATE INDEX idx_inscripciones_curso ON inscripciones(curso_id, periodo_id);
CREATE INDEX idx_calificaciones_estudiante ON calificaciones(estudiante_id);
CREATE INDEX idx_asistencia_fecha ON asistencia(fecha, asignacion_id);
CREATE INDEX idx_pagos_estudiante_estado ON pensiones_pagos(estudiante_id, estado);