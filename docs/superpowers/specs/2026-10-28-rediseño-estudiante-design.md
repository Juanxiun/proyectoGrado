# Diseño — Rediseño integral del home y rendimiento del estudiante (Opción A)

## Intent y por qué
El home del estudiante (`EstudianteDashboardScreen`) y la pantalla de rendimiento (`EstudianteRendimientoScreen`) se ven formales, con listas planas y poco jerarquía visual. El usuario quiere una app "con más vida": rango del estudiante grande y resaltado, insignias visibles, tienda de recompensas que funcione, ranking como podio con foto de perfil, "qué aprendí hoy" como resumen narrativo, carga destacada mientras espera el feedback de Mistral, preguntas falladas en cuadrícula con respuesta en modal, tarjetas de estado roja/verde/azul con gráficos en rendimiento, y una recomendación personalizada final.

## Alcance (dentro de la Opción A)
1. `EstudianteDashboardScreen.tsx` — home del estudiante.
2. `ActividadGamificadaModal.tsx` — modal de actividad/preguntas + feedback.
3. `EstudianteRendimientoScreen.tsx` — analizar mi rendimiento.
4. Componentes nuevos de UI en `src/shared/ui/` (podio, tarjeta de estado, gráfico simple, insignia, carga destacada).
5. No se agregan tablas SQL ni endpoints. Se reusa la API existente (`gamificacionApi`, `aprendizajeApi`, `seguimientoApi`).

## Restricciones
- NativeWind (Tailwind) + Ionicons. No hay librería de gráficos instalada (`victory`/`react-native-svg` ausentes): los "gráficos" se dibujan con `View`/`ScrollView` (barras horizontales y donut simple en `View` circular).
- No modificar backend. `avatarUrl` ya viene en `RankingEstudiante` pero no se usaba.
- Mantener strings/comentarios en español. Mantener navegación por `onNavigate`.
- No romper las 6 pre-existing errors de tsc (no son regresiones nuevas).

## Partes del cómo (acuerdos de diseño)

### Paleta "más viva"
- Marca: maroon `#801529` (ya existente) como acento principal.
- Colores de estado: verde éxito `#16A34A`, azul información `#2563EB`, rojo peligro `#DC2626`, ámbar advertencia `#D97706`.
- Fondo general claro `#F4F5F7` (ya en AppLayout). Tarjetas con sombra suave y bordes redondeados grandes (`rounded-3xl`).

### 1. Home — EstudianteDashboardScreen
- **Héroe superior**: saludo animado visualmente, foto del estudiante (UserAvatar) grande, y **el rango (D/C/B/A/S) enorme y resaltado** con su color (`coloresRango`), nivel y XP bajo el rango.
- **Racha diaria**: medallón de fuego grande, texto de días, umbral 50%.
- **Puntos individuales**: tarjeta destacada con total grande, progreso diario `puntosHoy / limiteDiario`, botón "Tienda de Recompensas".
- **Insignias del estudiante**: fila horizontal de insignias obtenidas (ícono + nombre), con insignia bloqueada en gris si no tiene ninguna.
- **"Qué aprendí hoy"**: resumen narrativo en una tarjeta (ej. "Repasaste varios temas de matemáticas y demostraste un rendimiento muy bueno."), construido a partir de `resumen.aprendizajeHoy` (materias, aciertos, porcentaje). Si no hay actividad, mensaje alentador.
- **Desafíos diarios**: reutilizar `ListaDesafiosDiarios`, visual de tarjetas.
- **Ranking del curso como podio**: top 3 en fila con foto de perfil (UserAvatar), posición grande (1/2/3), nombre y puntos; resto en lista ligera debajo. Botón para alternar curso/paralelo. El estudiante logueado se resalta (borde o fondo distinto).
- **Tienda de recompensas**: modal existente se mantiene; se asegura que los puntos se descuenten y se recargue `puntosInd` tras canje.

### 2. Modal de actividad — ActividadGamificadaModal
- **Carga destacada** mientras espera feedback de Mistral: pantalla de carga full con `ActivityIndicator` grande, texto "Generando tu retroalimentación personalizada..." y barra/progreso animado, no un indicador pequeño centrado.
- **Preguntas falladas en cuadrícula**: al terminar, agrupar respuestas incorrectas en una cuadrícula (2 columnas) con enunciado, respuesta del estudiante y respuesta correcta.
- **Respuesta de cada fallada en modal**: al tocar una tarjeta de pregunta fallada, abrir modal con la explicación (`explicacion` / `feedback`) y la respuesta correcta.

### 3. Rendimiento — EstudianteRendimientoScreen
- Cabecera con foto, nombre, promedio general grande.
- **Tarjetas de estado roja/verde/azul**:
  - Verde: fortalezas (materias >= 80).
  - Azul: tiempo de estudio / tasas de comprensión.
  - Roja: lo que está fallando (materias < 60 o en riesgo).
- Cada tarjeta con su "gráfico": barra de progreso horizontal coloreada o donut simple en `View`.
- **Recomendación personalizada final**: tarjeta al final con texto narrativo "en qué mejorar", "qué seguir estudiando", "dónde reforzar", construido a partir de materias en riesgo y promedio.

## Qué se deja al builder
- Colores exactos de cada tarjeta y textos finales de las recomendaciones (se sugieren placeholders en español).
- Animaciones exactas de la carga (expo no tiene Reanimated confirmado; se usa `ActivityIndicator` grande + texto).

## Aprobación requerida
Nada se construye hasta que confirmes este diseño.