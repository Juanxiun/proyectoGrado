-- Datos de demostración de Shalom. Ejecutar después de BDmain.sql en ShalomDB.
-- Credenciales de prueba: la clave común se genera como bcrypt cost 12 mediante pgcrypto.
-- Recomendado: ejecutar primero Esquems/Clear/ShalomDB.sql en una base de pruebas.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
#variable_conflict use_column
DECLARE
  roles_map jsonb;
  r_id bigint;
  periodo bigint;
  turno_manana bigint;
  turno_tarde bigint;
  id_aula bigint;
  m_ids bigint[] := '{}';
  m_nombres text[] := ARRAY['Matemática','Lenguaje','Ciencias Naturales','Ciencias Sociales','Inglés','Educación Física','Artes Plásticas','Música'];
  m_codigos text[] := ARRAY['MAT','LEN','CN','CS','ING','EF','ART','MUS'];
  m_pesada boolean[] := ARRAY[true,true,true,true,false,false,false,false];
  m_docentes bigint[] := '{}';
  alumno_ids bigint[] := '{}';
  alumno_est_ids bigint[] := '{}';
  doc_ids bigint[] := '{}';
  i int; j int; k int; g int; p int; n int; q int; a int;
  usuario_id bigint; est_id bigint; maestro_id bigint; docente_asignado bigint; curso_id bigint; cp_id bigint;
  v_plan_id bigint; v_plan_primaria_id bigint; pension_id bigint; pago_id bigint; asign_id bigint; encargo_id bigint;
  cuota_id bigint; username_demo text; ci_demo text; idx_pat int; idx_mat int; checksum int; fecha_base date := DATE '2026-02-02';
  tema_titulo text; tema_contenido text;
  curso_horario record; materia_horario record; bloque_horario record;
  aula_horario bigint; hora_inicio_horario time; hora_fin_horario time; bloque_asignado boolean;
  clave_hash text := crypt('Shalom2026#', gen_salt('bf', 12));
  niveles text[] := ARRAY['primaria','secundaria'];
  grados text[] := ARRAY['1°','2°','3°','4°','5°','6°'];
  nombres text[] := ARRAY['Ana','Luis','Sofía','Mateo','Valeria','Diego','Camila','Samuel','Lucía','Gabriel','Daniela','Andrés','María','Joaquín','Elena','Nicolás','Paula','Tomás','Isabel','Martín'];
  apellidos text[] := ARRAY['Flores','Mamani','Rojas','Gutiérrez','Pérez','Choque','Vargas','Quispe','Mendoza','Rivera','Calle','Torrez','López','Salazar','Cruz','Romero','Suárez','Arce','Díaz','Fernández'];
  nombres_doc text[] := ARRAY['Carla','Miguel','Patricia','Roberto','Elena','Jorge','Mónica','Raúl','Verónica','Pablo','Silvia','Héctor','Natalia','Óscar','Teresa','Marco'];
  apellidos_doc text[] := ARRAY['Alarcón','Beltrán','Cárdenas','Delgado','Espinoza','Fuentes','Guzmán','Herrera','Iriarte','Jiménez','Lara','Montes','Núñez','Ocampo','Paredes','Quiroga'];
BEGIN
  INSERT INTO roles (rol, descripcion) VALUES
    ('director','Dirección institucional'), ('control','Área administrativa y control'),
    ('profesor','Docente'), ('estudiante','Estudiante'), ('apoderado','Apoderado'), ('gerencia','Dirección ejecutiva')
  ON CONFLICT (rol) DO UPDATE SET activo = true;

  SELECT jsonb_object_agg(rol,id) INTO roles_map FROM roles;

  -- Periodo académico vigente (gestión 2026), con tres trimestres.
  UPDATE periodos_academicos SET activo=false WHERE activo=true;
  INSERT INTO periodos_academicos
    (anio,nombre,fecha_inicio,fecha_fin,inicio_gestion,fin_gestion,estado,estructura_generada,horarios_generados,plan_pagos_generado,activo)
  VALUES (2026,'Gestión 2026',fecha_base,DATE '2026-12-18',fecha_base,DATE '2026-12-18','activo',true,true,true,true)
  ON CONFLICT (anio,nombre) DO UPDATE SET activo=true, estado='activo'
  RETURNING id INTO periodo;
  UPDATE periodos_academicos SET activo=false WHERE id<>periodo;

  INSERT INTO trimestres (periodo_id,numero,inicio,fin) VALUES
    (periodo,1,fecha_base,DATE '2026-05-08'),
    (periodo,2,DATE '2026-05-11',DATE '2026-08-28'),
    (periodo,3,DATE '2026-08-31',DATE '2026-12-18')
  ON CONFLICT (periodo_id,numero) DO UPDATE SET inicio=excluded.inicio,fin=excluded.fin;

  INSERT INTO turnos (codigo,nombre,hora_inicio,hora_fin,receso_inicio,receso_fin,duracion_periodo_minutos)
  VALUES ('manana','Mañana','07:00','12:30','09:30','10:00',45)
  ON CONFLICT (codigo) DO UPDATE SET activo=true
  RETURNING id INTO turno_manana;
  INSERT INTO turnos (codigo,nombre,hora_inicio,hora_fin,receso_inicio,receso_fin,duracion_periodo_minutos)
  VALUES ('tarde','Tarde','14:00','18:30','16:00','16:30',45)
  ON CONFLICT (codigo) DO UPDATE SET activo=true
  RETURNING id INTO turno_tarde;

  -- Aulas: un aula por curso, paralelos A y B en primaria y secundaria.
  FOR i IN 1..2 LOOP
    FOR g IN 1..6 LOOP
      FOR p IN 0..1 LOOP
        INSERT INTO cursos (nivel,grado,paralelo,capacidad_maxima,activo)
        VALUES (niveles[i],grados[g],CASE WHEN p=0 THEN 'A' ELSE 'B' END,25,true)
        ON CONFLICT (nivel,grado,paralelo) DO UPDATE SET capacidad_maxima=25,activo=true
        RETURNING id INTO curso_id;
        INSERT INTO aulas (codigo,nombre,capacidad,activa)
        VALUES (upper(substr(niveles[i],1,2))||g||CASE WHEN p=0 THEN 'A' ELSE 'B' END,
                initcap(niveles[i])||' '||grados[g]||CASE WHEN p=0 THEN ' A' ELSE ' B' END,25,true)
        ON CONFLICT (codigo) DO UPDATE SET activa=true,capacidad=25
        RETURNING id INTO id_aula;
        INSERT INTO cursos_periodo (curso_id,periodo_id,capacidad_maxima,turno_id,estado)
        VALUES (curso_id,periodo,25,CASE WHEN niveles[i]='primaria' THEN turno_tarde ELSE turno_manana END,'activo')
        ON CONFLICT (curso_id,periodo_id) DO UPDATE SET estado='activo',turno_id=EXCLUDED.turno_id
        RETURNING id INTO cp_id;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Catálogo de materias y mallas para ambos niveles y todos los grados.
  FOR j IN 1..array_length(m_nombres,1) LOOP
    INSERT INTO materias (codigo,nombre,descripcion,tipo_materia,carga_horaria_semanal,peso_sintactico,materia_pesada,activo)
    VALUES (m_codigos[j],m_nombres[j],'Materia de demostración', 'principal',
      CASE WHEN m_pesada[j] THEN 2 ELSE 3 END, CASE WHEN m_pesada[j] THEN 3 ELSE 1 END,m_pesada[j],true)
    ON CONFLICT (codigo) DO UPDATE SET nombre=excluded.nombre,activo=true,materia_pesada=excluded.materia_pesada
    RETURNING id INTO id_aula;
    m_ids := array_append(m_ids,id_aula);
    FOR i IN 1..2 LOOP
      FOR g IN 1..6 LOOP
        INSERT INTO grado_materias (nivel,grado,materia_id,tipo_materia,carga_horaria_semanal,orden)
        VALUES(niveles[i],grados[g],id_aula,'principal',CASE WHEN niveles[i]='primaria' OR j<=4 THEN 2 ELSE 3 END,j)
        ON CONFLICT (nivel,grado,materia_id) DO UPDATE SET carga_horaria_semanal=excluded.carga_horaria_semanal;
        INSERT INTO mallas_curriculares (periodo_id,nivel,grado,materia_id,tipo_materia,carga_horaria_semanal,peso_sintactico)
        VALUES(periodo,niveles[i],grados[g],id_aula,'principal',CASE WHEN niveles[i]='primaria' OR j<=4 THEN 2 ELSE 3 END,CASE WHEN m_pesada[j] THEN 3 ELSE 1 END)
        ON CONFLICT (periodo_id,nivel,grado,materia_id) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Temas y horas previstas de la malla (una unidad por trimestre, para cada materia y grado).
  FOR i IN 1..2 LOOP
    FOR g IN 1..6 LOOP
      FOR j IN 1..8 LOOP
        FOR k IN 1..3 LOOP
          tema_titulo := CASE j
            WHEN 1 THEN CASE k WHEN 1 THEN 'Sistema de numeración y operaciones' WHEN 2 THEN 'Fracciones, medidas y proporcionalidad' ELSE 'Geometría y resolución de problemas' END
            WHEN 2 THEN CASE k WHEN 1 THEN 'Comprensión lectora y vocabulario' WHEN 2 THEN 'Producción de textos y gramática' ELSE 'Literatura, exposición y argumentación' END
            WHEN 3 THEN CASE k WHEN 1 THEN 'Seres vivos y sus ecosistemas' WHEN 2 THEN 'Materia, energía y cambios' ELSE 'Cuerpo humano, salud y ambiente' END
            WHEN 4 THEN CASE k WHEN 1 THEN 'Historia y memoria de la comunidad' WHEN 2 THEN 'Territorio, mapas y recursos' ELSE 'Convivencia y organización social' END
            WHEN 5 THEN CASE k WHEN 1 THEN 'Everyday vocabulary and expressions' WHEN 2 THEN 'Reading and writing short texts' ELSE 'Basic grammar and communication' END
            WHEN 6 THEN CASE k WHEN 1 THEN 'Coordinación y habilidades motrices' WHEN 2 THEN 'Deportes, reglas y trabajo en equipo' ELSE 'Hábitos saludables y condición física' END
            WHEN 7 THEN CASE k WHEN 1 THEN 'Línea, forma y color' WHEN 2 THEN 'Técnicas y composición visual' ELSE 'Proyecto artístico y expresión cultural' END
            ELSE CASE k WHEN 1 THEN 'Ritmo, pulso y sonidos' WHEN 2 THEN 'Lectura musical y melodía' ELSE 'Interpretación y creación colectiva' END
          END;
          tema_contenido := 'Unidad '||k||' de '||m_nombres[j]||' para '||grados[g]||' de '||niveles[i]||'. Incluye conceptos, práctica guiada, actividad de aplicación y revisión de aprendizajes.';
          INSERT INTO malla_temas(nivel,grado,materia_id,unidad,titulo,contenidos,horas_previstas,es_evaluacion,orden)
          VALUES(niveles[i],grados[g],m_ids[j],k,tema_titulo,tema_contenido,8,k=3,k)
          ON CONFLICT (nivel,grado,materia_id,unidad) DO UPDATE SET
            titulo=EXCLUDED.titulo,contenidos=EXCLUDED.contenidos,
            horas_previstas=EXCLUDED.horas_previstas,es_evaluacion=EXCLUDED.es_evaluacion,orden=EXCLUDED.orden;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Equipo directivo (2), administrativo (6) y docentes: dos habilitados por materia.
  FOR i IN 1..2 LOOP
    INSERT INTO usuarios (rol_id,nombre,apellido_paterno,apellido_materno,nacimiento,genero)
    VALUES ((roles_map->>'director')::bigint, nombres_doc[i],apellidos_doc[i],'Shalom',DATE '1980-01-01','femenino') RETURNING id INTO usuario_id;
    INSERT INTO usuario_cuenta (usuario_id,username,email,password_hash) VALUES
      (usuario_id,'director'||i||'2026','director'||i||'2026@shalom.edu.bo',clave_hash);
  END LOOP;
  FOR i IN 1..6 LOOP
    INSERT INTO usuarios (rol_id,nombre,apellido_paterno,apellido_materno,nacimiento,genero)
    VALUES ((roles_map->>'control')::bigint,nombres_doc[i+2],apellidos_doc[i+2],'Shalom',DATE '1985-01-01','masculino') RETURNING id INTO usuario_id;
    INSERT INTO usuario_cuenta (usuario_id,username,email,password_hash) VALUES
      (usuario_id,'admin'||i||'2026','admin'||i||'2026@shalom.edu.bo',clave_hash);
  END LOOP;

  FOR j IN 1..array_length(m_ids,1) LOOP
    FOR k IN 1..2 LOOP
      i := (j-1)*2+k;
      INSERT INTO usuarios (rol_id,nombre,apellido_paterno,apellido_materno,nacimiento,genero)
      VALUES ((roles_map->>'profesor')::bigint,nombres_doc[i],apellidos_doc[i],'Docente',DATE '1982-01-01',CASE WHEN i%2=0 THEN 'femenino' ELSE 'masculino' END)
      RETURNING id INTO usuario_id;
      INSERT INTO usuario_cuenta (usuario_id,username,email,password_hash) VALUES
        (usuario_id,'docente'||lpad(i::text,2,'0')||'2026','docente'||lpad(i::text,2,'0')||'2026@shalom.edu.bo',clave_hash);
      INSERT INTO maestros (usuario_id,especialidad,fecha_contratacion,materias_configuradas)
      VALUES(usuario_id,m_nombres[j],DATE '2020-02-01',true) RETURNING id INTO maestro_id;
      INSERT INTO maestro_materias (maestro_id,materia_id) VALUES(maestro_id,m_ids[j]) ON CONFLICT DO NOTHING;
      m_docentes := array_append(m_docentes,maestro_id);
    END LOOP;
  END LOOP;

  -- Apoderados y 400 estudiantes: 200 por nivel, repartidos en 12 grados/paralelos.
  FOR i IN 1..400 LOOP
    j := CASE WHEN i<=200 THEN 1 ELSE 2 END;
    g := ((i-1)%200)/34+1;
    IF g>6 THEN g:=6; END IF;
    p := CASE WHEN ((i-1)%34)>=17 THEN 1 ELSE 0 END;
    idx_pat := ((i*7-1)+(i-1)/20)%20+1;
    idx_mat := ((i*11-1)+3*((i-1)/20))%20+1;
    ci_demo := (5000000+i)::text;
    checksum := substr(ci_demo,1,1)::int + substr(ci_demo,2,1)::int +
      substr(ci_demo,length(ci_demo)-1,1)::int + substr(ci_demo,length(ci_demo),1)::int;
    WHILE checksum >= 10 LOOP
      checksum := (checksum/10)::int + checksum%10;
    END LOOP;
    username_demo := lower(
      substr(translate(apellidos[idx_pat],'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN'),1,2) ||
      substr(translate(apellidos[idx_mat],'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN'),1,2) ||
      substr(translate(nombres[((i-1)%20)+1],'áéíóúüñÁÉÍÓÚÜÑ','aeiouunAEIOUUN'),1,2) ||
      substr(ci_demo,1,2) || substr(ci_demo,length(ci_demo)-1,2) || checksum::text
    );
    -- Mismo patrón generateUsername() del servicio: iniciales de apellidos/nombre + CI + checksum.
    INSERT INTO usuarios (rol_id,nombre,apellido_paterno,apellido_materno,nacimiento,genero)
    VALUES((roles_map->>'estudiante')::bigint,nombres[((i-1)%20)+1],apellidos[idx_pat],apellidos[idx_mat],DATE '2010-01-01'+(i%1500),CASE WHEN i%2=0 THEN 'femenino' ELSE 'masculino' END)
    RETURNING id INTO usuario_id;
    INSERT INTO usuario_cuenta(usuario_id,username,email,password_hash)
    VALUES(usuario_id,username_demo,username_demo||'@shalom.edu.bo',clave_hash);
    INSERT INTO estudiantes(usuario_id,fecha_ingreso,estado) VALUES(usuario_id,fecha_base,'activo') RETURNING id INTO est_id;
    alumno_ids := array_append(alumno_ids,usuario_id);
    alumno_est_ids := array_append(alumno_est_ids,est_id);
    INSERT INTO usuario_documentos(usuario_id,tipo_doc,numero_doc)
    VALUES(usuario_id,'CI',ci_demo);

    INSERT INTO usuarios (rol_id,nombre,apellido_paterno,apellido_materno,nacimiento,genero)
    VALUES((roles_map->>'apoderado')::bigint,nombres[((i+8)%20)+1],apellidos[((i+4)%20)+1],'Tutor',DATE '1975-01-01','otro') RETURNING id INTO r_id;
    INSERT INTO usuario_cuenta(usuario_id,username,email,password_hash)
    VALUES(r_id,'tut'||lpad(i::text,4,'0')||'2026','tut'||lpad(i::text,4,'0')||'2026@shalom.edu.bo',clave_hash);
    INSERT INTO apoderados(usuario_id,ocupacion) VALUES(r_id,'Trabajador/a') RETURNING id INTO cuota_id;
    INSERT INTO estudiante_apoderado(estudiante_id,apoderado_id,parentesco,es_principal,autorizado_recoger)
    VALUES(est_id,cuota_id,'madre/padre',true,true);

    SELECT cp.id INTO cp_id FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
    WHERE cp.periodo_id=periodo AND c.nivel=niveles[j] AND c.grado=grados[g]
      AND c.paralelo=CASE WHEN p=0 THEN 'A' ELSE 'B' END;
    INSERT INTO inscripciones(estudiante_id,curso_periodo_id,periodo_id,estado,origen)
    VALUES(est_id,cp_id,periodo,'activo','nueva');
  END LOOP;

  -- Dos docentes calificados por materia; se asigna un docente por grupo para no duplicar sesiones.
  FOR i IN 1..16 LOOP
    j := ((i-1)/2)+1;
    INSERT INTO asignaciones_docentes(maestro_id,materia_id,curso_periodo_id,estado)
    SELECT m_docentes[(j-1)*2+CASE WHEN c.paralelo='A' THEN 1 ELSE 2 END],m_ids[j],cp.id,'activo'
    FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
    WHERE cp.periodo_id=periodo AND c.nivel='secundaria'
    ON CONFLICT (maestro_id,materia_id,curso_periodo_id) DO NOTHING;
    INSERT INTO asignaciones_docentes(maestro_id,materia_id,curso_periodo_id,estado)
    SELECT m_docentes[(j-1)*2+2],m_ids[j],cp.id,'activo'
    FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
    WHERE cp.periodo_id=periodo AND c.nivel='primaria' AND c.paralelo='B'
    ON CONFLICT (maestro_id,materia_id,curso_periodo_id) DO NOTHING;
    INSERT INTO asignaciones_docentes(maestro_id,materia_id,curso_periodo_id,estado)
    SELECT m_docentes[(j-1)*2+1],m_ids[j],cp.id,'activo'
    FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
    WHERE cp.periodo_id=periodo AND c.nivel='primaria' AND c.paralelo='A'
    ON CONFLICT (maestro_id,materia_id,curso_periodo_id) DO NOTHING;
  END LOOP;

  -- Cada curso-periodo recibe un asesor activo antes de construir sus horarios.
  INSERT INTO curso_asesor (curso_periodo_id,maestro_id,fecha_inicio,fecha_fin)
  SELECT cp.id,ad.maestro_id,p.inicio_gestion,p.fin_gestion
  FROM cursos_periodo cp
  JOIN periodos_academicos p ON p.id=cp.periodo_id
  JOIN LATERAL (
    SELECT asignacion.maestro_id
    FROM asignaciones_docentes asignacion
    JOIN materias materia ON materia.id=asignacion.materia_id
    WHERE asignacion.curso_periodo_id=cp.id AND asignacion.estado='activo'
    ORDER BY materia.materia_pesada DESC,materia.id
    LIMIT 1
  ) ad ON true
  WHERE cp.periodo_id=periodo AND cp.estado='activo'
  ON CONFLICT (curso_periodo_id) DO UPDATE SET
    maestro_id=EXCLUDED.maestro_id,fecha_inicio=EXCLUDED.fecha_inicio,fecha_fin=EXCLUDED.fecha_fin;

  -- Programación de primaria y secundaria, respetando la disponibilidad de curso, docente y aula.
  -- Los horarios se colocan en los turnos configurados; solo hay bloques completos y hasta dos materias pesadas por día.
  DELETE FROM horarios h USING cursos_periodo cp
  WHERE h.curso_periodo_id=cp.id AND cp.periodo_id=periodo;
  CREATE TEMP TABLE tmp_horarios_generados (
    curso_periodo_id bigint, materia_id bigint, asignacion_id bigint, maestro_id bigint,
    aula_id bigint, turno_id bigint, dia_semana smallint, hora_inicio time, hora_fin time
  ) ON COMMIT DROP;
  TRUNCATE tmp_horarios_generados;

  FOR curso_horario IN
    SELECT cp.id AS curso_periodo_id,cp.turno_id,cp.capacidad_maxima,c.nivel,c.grado,c.paralelo
    FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
    WHERE cp.periodo_id=periodo AND cp.estado='activo'
    ORDER BY c.nivel,c.grado,c.paralelo
  LOOP
    SELECT a.id INTO aula_horario FROM aulas a
    WHERE a.codigo=upper(substr(curso_horario.nivel,1,2))||substring(curso_horario.grado from 1 for 1)||curso_horario.paralelo
      AND a.activa=true AND a.capacidad>=curso_horario.capacidad_maxima;
    IF aula_horario IS NULL THEN
      RAISE EXCEPTION 'No existe aula con capacidad para % % %',curso_horario.nivel,curso_horario.grado,curso_horario.paralelo;
    END IF;

    FOR materia_horario IN
      SELECT m.id AS materia_id,m.materia_pesada,m.peso_sintactico,mc.carga_horaria_semanal,
        ad.id AS asignacion_id,ad.maestro_id
      FROM mallas_curriculares mc JOIN materias m ON m.id=mc.materia_id
      JOIN asignaciones_docentes ad ON ad.materia_id=m.id AND ad.estado='activo'
      JOIN cursos_periodo cp ON cp.id=ad.curso_periodo_id AND cp.periodo_id=mc.periodo_id
      JOIN cursos c ON c.id=cp.curso_id AND c.nivel=mc.nivel AND c.grado=mc.grado
      WHERE mc.periodo_id=periodo AND mc.nivel=curso_horario.nivel
        AND mc.grado=curso_horario.grado AND cp.id=curso_horario.curso_periodo_id
      ORDER BY m.materia_pesada DESC,m.peso_sintactico DESC,m.id
    LOOP
      FOR q IN 1..materia_horario.carga_horaria_semanal LOOP
        bloque_asignado := false;
        FOR bloque_horario IN
          SELECT d.dia,s.bloque,
            (SELECT count(*) FROM tmp_horarios_generados th
             WHERE th.curso_periodo_id=curso_horario.curso_periodo_id AND th.dia_semana=d.dia) AS carga_dia
          FROM generate_series(1,5) AS d(dia)
          CROSS JOIN generate_series(1,CASE WHEN curso_horario.nivel='primaria' THEN 4 ELSE 6 END) AS s(bloque)
          ORDER BY carga_dia,d.dia,s.bloque
        LOOP
          IF curso_horario.nivel='primaria' THEN
            hora_inicio_horario := CASE bloque_horario.bloque
              WHEN 1 THEN TIME '14:00' WHEN 2 THEN TIME '14:45'
              WHEN 3 THEN TIME '16:30' ELSE TIME '17:15' END;
            hora_fin_horario := CASE bloque_horario.bloque
              WHEN 1 THEN TIME '14:45' WHEN 2 THEN TIME '15:30'
              WHEN 3 THEN TIME '17:15' ELSE TIME '18:00' END;
          ELSE
            hora_inicio_horario := CASE bloque_horario.bloque
              WHEN 1 THEN TIME '07:00' WHEN 2 THEN TIME '07:45' WHEN 3 THEN TIME '08:30'
              WHEN 4 THEN TIME '10:00' WHEN 5 THEN TIME '10:45' ELSE TIME '11:30' END;
            hora_fin_horario := CASE bloque_horario.bloque
              WHEN 1 THEN TIME '07:45' WHEN 2 THEN TIME '08:30' WHEN 3 THEN TIME '09:15'
              WHEN 4 THEN TIME '10:45' WHEN 5 THEN TIME '11:30' ELSE TIME '12:15' END;
          END IF;

          IF materia_horario.materia_pesada AND
             (SELECT count(*) FROM tmp_horarios_generados th
              JOIN materias tm ON tm.id=th.materia_id
              WHERE th.curso_periodo_id=curso_horario.curso_periodo_id
                AND th.dia_semana=bloque_horario.dia AND tm.materia_pesada)>=2 THEN
            CONTINUE;
          END IF;
          IF EXISTS (SELECT 1 FROM tmp_horarios_generados th
                     WHERE th.curso_periodo_id=curso_horario.curso_periodo_id
                       AND th.dia_semana=bloque_horario.dia AND th.hora_inicio=hora_inicio_horario) THEN
            CONTINUE;
          END IF;
          IF EXISTS (SELECT 1 FROM tmp_horarios_generados th
                     WHERE th.maestro_id=materia_horario.maestro_id
                       AND th.dia_semana=bloque_horario.dia AND th.hora_inicio=hora_inicio_horario) THEN
            CONTINUE;
          END IF;
          IF EXISTS (SELECT 1 FROM tmp_horarios_generados th
                     WHERE th.aula_id=aula_horario AND th.dia_semana=bloque_horario.dia
                       AND th.hora_inicio=hora_inicio_horario) THEN
            CONTINUE;
          END IF;

          INSERT INTO tmp_horarios_generados
            (curso_periodo_id,materia_id,asignacion_id,maestro_id,aula_id,turno_id,dia_semana,hora_inicio,hora_fin)
          VALUES(curso_horario.curso_periodo_id,materia_horario.materia_id,materia_horario.asignacion_id,
            materia_horario.maestro_id,aula_horario,curso_horario.turno_id,bloque_horario.dia,
            hora_inicio_horario,hora_fin_horario);
          bloque_asignado := true;
          EXIT;
        END LOOP;
        IF NOT bloque_asignado THEN
          RAISE EXCEPTION 'No se pudo ubicar materia % para % % % sin conflictos',
            materia_horario.materia_id,curso_horario.nivel,curso_horario.grado,curso_horario.paralelo;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  INSERT INTO horarios
    (curso_periodo_id,materia_id,asignacion_id,maestro_id,aula_id,turno_id,dia_semana,hora_inicio,hora_fin)
  SELECT curso_periodo_id,materia_id,asignacion_id,maestro_id,aula_id,turno_id,dia_semana,hora_inicio,hora_fin
  FROM tmp_horarios_generados;

  -- Falla toda la carga si quedó algún solapamiento de curso, docente o aula.
  IF EXISTS (
    SELECT 1 FROM horarios h1 JOIN horarios h2 ON h1.id<h2.id
      AND h1.dia_semana=h2.dia_semana
      AND h1.hora_inicio<h2.hora_fin AND h2.hora_inicio<h1.hora_fin
    WHERE h1.curso_periodo_id IN (SELECT id FROM cursos_periodo WHERE periodo_id=periodo)
      AND h2.curso_periodo_id IN (SELECT id FROM cursos_periodo WHERE periodo_id=periodo)
      AND (h1.curso_periodo_id=h2.curso_periodo_id OR h1.maestro_id=h2.maestro_id OR h1.aula_id=h2.aula_id)
  ) THEN
    RAISE EXCEPTION 'La gestión de prueba contiene horarios solapados para curso, docente o aula';
  END IF;
  IF EXISTS (
    SELECT 1 FROM horarios h JOIN materias m ON m.id=h.materia_id
    WHERE h.curso_periodo_id IN (SELECT cp.id FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
                                 WHERE cp.periodo_id=periodo)
      AND m.materia_pesada
    GROUP BY h.curso_periodo_id,h.dia_semana HAVING count(*) FILTER (WHERE m.materia_pesada)>2
  ) THEN
    RAISE EXCEPTION 'La gestión de prueba excede dos materias pesadas en un día';
  END IF;

  -- Ambos niveles requieren plan generado para dejar lista la activación de la gestión.
  INSERT INTO planes_pago(periodo_id,nivel,nombre,cantidad_cuotas,monto_total,monto_cuota,dia_vencimiento,estado)
  VALUES(periodo,'primaria','Mensualidad primaria 2026',10,5000,500,10,'generado')
  ON CONFLICT (periodo_id,nivel) DO UPDATE SET estado='generado' RETURNING id INTO v_plan_primaria_id;
  FOR j IN 1..10 LOOP
    INSERT INTO cuotas_plan_pago(plan_id,numero,anio,mes,fecha_vencimiento,monto,estado)
    VALUES(v_plan_primaria_id,j,2026,j+1,make_date(2026,j+1,10),500,'pendiente')
    ON CONFLICT (plan_id,numero) DO UPDATE SET monto=EXCLUDED.monto;
  END LOOP;

  -- Planes de pago y cuotas mensuales para secundaria; escenarios de pago al día, mora de 1 mes y mora mayor.
  INSERT INTO planes_pago(periodo_id,nivel,nombre,cantidad_cuotas,monto_total,monto_cuota,dia_vencimiento,estado)
  VALUES(periodo,'secundaria','Mensualidad secundaria 2026',10,5000,500,10,'generado')
  ON CONFLICT (periodo_id,nivel) DO UPDATE SET estado='generado' RETURNING id INTO v_plan_id;
  FOR i IN 1..10 LOOP
    INSERT INTO cuotas_plan_pago(plan_id,numero,anio,mes,fecha_vencimiento,monto,estado)
    VALUES(v_plan_id,i,2026,i+1,make_date(2026,i+1,10),500,'pendiente')
    ON CONFLICT(plan_id,numero) DO UPDATE SET monto=500 RETURNING id INTO cuota_id;
  END LOOP;
  FOR i IN 201..400 LOOP
    SELECT e.id INTO est_id FROM estudiantes e WHERE e.usuario_id=alumno_ids[i];
    FOR j IN 1..10 LOOP
      INSERT INTO pensiones(estudiante_id,periodo_id,plan_pago_id,numero_cuota,concepto,mes,monto,fecha_vencimiento,estado)
      VALUES(est_id,periodo,v_plan_id,j,'Mensualidad',j,500,make_date(2026,j+1,10),'pendiente') RETURNING id INTO pension_id;
      IF i%3=0 OR (i%3=1 AND j<=9) OR (i%3=2 AND j<=7) THEN
        INSERT INTO pagos(estudiante_id,monto,metodo,numero_transaccion,fecha_pago,registrado_por,estado,observacion)
        VALUES(est_id,500,'transferencia','DEMO-'||i||'-'||j,make_date(2026,j+1,9),(SELECT u.id FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE r.rol='control' ORDER BY u.id LIMIT 1),'confirmado','Pago de prueba') RETURNING id INTO pago_id;
        INSERT INTO pago_pensiones(pago_id,pension_id,monto) VALUES(pago_id,pension_id,500);
        UPDATE pensiones SET estado='pagado' WHERE id=pension_id;
      END IF;
    END LOOP;
  END LOOP;

  -- 15 actividades por curso: cinco en cada trimestre; notas solo para estudiantes inscritos en 1° A/B.
  FOR cp_id IN SELECT cp.id FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
               WHERE cp.periodo_id=periodo AND c.nivel='secundaria' AND c.grado='1°' AND c.paralelo IN ('A','B') LOOP
    FOR q IN 1..15 LOOP
        j := ((q-1)%8)+1;
        SELECT id INTO asign_id FROM asignaciones_docentes WHERE curso_periodo_id=cp_id AND materia_id=m_ids[j] ORDER BY id LIMIT 1;
        k := ((q-1)/5)+1;
        INSERT INTO encargos(asignacion_id,tipo,titulo,descripcion,ponderacion,fecha_publicacion,fecha_limite,estado)
        VALUES(asign_id,CASE WHEN q%5=0 THEN 'evaluación' ELSE 'actividad' END,
          'Actividad '||q||' - '||m_nombres[j], 'Actividad de seguimiento del trimestre '||k,
          100.0/5,CASE k WHEN 1 THEN DATE '2026-03-01' WHEN 2 THEN DATE '2026-06-01' ELSE DATE '2026-09-01' END,
          CASE k WHEN 1 THEN DATE '2026-04-01' WHEN 2 THEN DATE '2026-07-01' ELSE DATE '2026-11-30' END,'publicado') RETURNING id INTO encargo_id;
        -- Calificaciones diversas: mayoría alto, grupo moderado y pocos promedios bajos.
        FOR i IN 201..400 LOOP
          IF alumno_est_ids[i] IN (SELECT ins.estudiante_id FROM inscripciones ins WHERE ins.curso_periodo_id=cp_id) THEN
          SELECT e.id INTO est_id FROM estudiantes e WHERE e.usuario_id=alumno_ids[i];
          IF i%20=0 THEN n:=55+(q%10); ELSIF i%5=0 THEN n:=68+(q%10); ELSE n:=82+(q%18); END IF;
          INSERT INTO encargo_entregas(encargo_id,estudiante_id,archivo_url,nombre_archivo,tipo_mime,tamanio_bytes,fecha_entrega,estado_entrega)
          VALUES(encargo_id,est_id,'demo://entregas/'||i||'/'||q,'entrega-'||q||'.pdf','application/pdf',1024,
            CASE k WHEN 1 THEN DATE '2026-04-01' WHEN 2 THEN DATE '2026-07-01' ELSE DATE '2026-10-01' END,'a_tiempo');
          INSERT INTO calificaciones(encargo_id,estudiante_id,nota,observacion,fecha_calificacion,fecha_actualizacion)
          VALUES(encargo_id,est_id,n,'Calificación de demostración',
            CASE k WHEN 1 THEN TIMESTAMPTZ '2026-03-25 12:00:00-04' WHEN 2 THEN TIMESTAMPTZ '2026-06-24 12:00:00-04' ELSE TIMESTAMPTZ '2026-10-15 12:00:00-04' END,
            CASE k WHEN 1 THEN TIMESTAMPTZ '2026-03-25 12:00:00-04' WHEN 2 THEN TIMESTAMPTZ '2026-06-24 12:00:00-04' ELSE TIMESTAMPTZ '2026-10-15 12:00:00-04' END);
          END IF;
        END LOOP;
    END LOOP;
  END LOOP;

  -- Asistencia únicamente para estudiantes de 1° secundaria A y B.
  FOR cp_id IN SELECT cp.id FROM cursos_periodo cp JOIN cursos c ON c.id=cp.curso_id
               WHERE cp.periodo_id=periodo AND c.nivel='secundaria' AND c.grado='1°' AND c.paralelo IN ('A','B') LOOP
    FOR i IN 201..400 LOOP
      IF alumno_est_ids[i] IN (SELECT e.id FROM estudiantes e JOIN inscripciones ins ON ins.estudiante_id=e.id WHERE ins.curso_periodo_id=cp_id) THEN
        FOR j IN 1..8 LOOP
          SELECT id INTO asign_id FROM asignaciones_docentes WHERE curso_periodo_id=cp_id AND materia_id=m_ids[j] ORDER BY id LIMIT 1;
          FOR k IN 1..3 LOOP
            FOR q IN 1..10 LOOP
              INSERT INTO asistencia(estudiante_id,asignacion_id,fecha,estado)
              VALUES(alumno_est_ids[i],asign_id,
                CASE k WHEN 1 THEN DATE '2026-03-02'+(q-1) WHEN 2 THEN DATE '2026-06-01'+(q-1) ELSE DATE '2026-10-01'+q END,
                CASE WHEN (i+q+k)%25=0 THEN 'ausente' WHEN (i+q+k)%17=0 THEN 'atraso' ELSE 'presente' END)
              ON CONFLICT (estudiante_id,asignacion_id,fecha) DO NOTHING;
            END LOOP;
          END LOOP;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  IF (SELECT count(*) FROM cursos_periodo WHERE periodo_id=periodo AND estado='activo') < 24 THEN
    RAISE EXCEPTION 'No se generaron los 24 cursos-periodo esperados';
  END IF;
  IF EXISTS (SELECT 1 FROM cursos_periodo cp WHERE cp.periodo_id=periodo AND cp.estado='activo'
             AND NOT EXISTS (SELECT 1 FROM curso_asesor ca WHERE ca.curso_periodo_id=cp.id)) THEN
    RAISE EXCEPTION 'Hay cursos-periodo sin asesor asignado';
  END IF;
  IF (SELECT count(DISTINCT nivel) FROM planes_pago WHERE periodo_id=periodo AND estado='generado') < 2 THEN
    RAISE EXCEPTION 'Faltan planes de pago para primaria o secundaria';
  END IF;

  -- Indicadores completos de gestión para que la gestión se muestre habilitada.
  UPDATE periodos_academicos SET estructura_generada=true,horarios_generados=true,plan_pagos_generado=true,
    estado='activo',activo=true,activado_at=COALESCE(activado_at,NOW()) WHERE id=periodo;
END $$;

COMMIT;

-- Resumen: 400 estudiantes (200 por nivel); área directiva 2; administrativa 6;
-- 16 docentes (2 habilitados por cada materia); asistencia solo 1° secundaria A/B.
