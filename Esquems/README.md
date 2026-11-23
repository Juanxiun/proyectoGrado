# Datos de demostración

`datos.sql` carga datos de prueba para `ShalomDB` después de crear el esquema con
`BDmain.sql`. Para una instalación vacía, ejecutar desde la raíz:

```bash
psql -U Juanxiu -d ShalomDB -v ON_ERROR_STOP=1 -f Esquems/BDmain.sql
psql -U Juanxiu -d ShalomDB -v ON_ERROR_STOP=1 -f Esquems/datos.sql
```

En una base de pruebas existente, vaciar primero sus datos con
`Esquems/Clear/ShalomDB.sql`; no ejecutar la limpieza en una base con información
que se quiera conservar. El seed necesita la extensión PostgreSQL `pgcrypto`
para generar hashes bcrypt compatibles con el servicio.

Las cuentas de demostración usan la contraseña `Shalom2026#`. Los usuarios
estudiantiles se generan siguiendo el formato actual de `generateUsername()`:
iniciales de apellidos y nombre, dígitos del CI y checksum. El conjunto incluye
400 estudiantes (200 por nivel), 2 directores, 6 administrativos, 16 docentes,
aulas y paralelos A/B, un asesor por curso, gestión 2026, planes de pago para ambos
niveles, horarios de ambos niveles (secundaria en la mañana y primaria en la tarde), mensualidades,
actividades y notas de primero de secundaria A/B, y asistencia solo de esos dos
cursos.
