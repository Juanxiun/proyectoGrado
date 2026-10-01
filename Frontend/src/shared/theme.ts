/**
 * Tokens del diseño institucional. Única fuente de verdad de color, espacio,
 * radio y tipografía; `tailwind.config.js` replica el palette para NativeWind.
 *
 * La identidad visual es "papel marfil + sello granate": superficies claras
 * (gray-50) con acentos maroon, igual que los paneles de administración.
 */
export const COLORS = {
  // Marca
  maroon: '#801529',
  maroonDark: '#5c0f1e',
  maroonLight: '#a01d35',
  cream: '#F5EDE4',
  tan: '#C4A882',
  bronze: '#8B6914',
  gold: '#D4A74A',

  // Superficies
  background: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',

  // Texto
  text: '#1F2937',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  textInverted: '#FFFFFF',

  // Estados
  success: '#16A34A',
  warning: '#EAB308',
  danger: '#DC2626',
  info: '#2563EB',

  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
} as const;

export const GRAY = {
  50: '#F9FAFB',
  100: '#F3F4F6',
  200: '#E5E7EB',
  300: '#D1D5DB',
  400: '#9CA3AF',
  500: '#6B7280',
  600: '#4B5563',
  700: '#374151',
  800: '#1F2937',
  900: '#111827',
} as const;

/** Escala de espaciado en múltiplos de 4 (px). */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 999,
} as const;

/**
 * Clases de NativeWind para los roles semánticos. Usar estos roles en vez de
 * escribir colores sueltos es lo que mantiene las pantallas coherentes entre sí.
 */
export const TONE = {
  surface: 'bg-white border-gray-100',
  surfaceMuted: 'bg-gray-50 border-gray-100',
  brand: 'bg-maroon text-white',
  brandSubtle: 'bg-maroon/10 text-maroon',
  danger: 'bg-red-50 border-red-200 text-red-600',
  success: 'bg-green-50 border-green-200 text-green-700',
  warning: 'bg-amber-50 border-amber-200 text-amber-700',
  info: 'bg-blue-50 border-blue-200 text-blue-700',

  label: 'text-xs font-semibold text-gray-500 uppercase tracking-wide',
  title: 'text-lg font-bold text-gray-900',
  body: 'text-sm text-gray-600',
} as const;

/** Alturas de control para que inputs y botones midan lo mismo en toda la app. */
export const CONTROL_HEIGHT = {
  sm: 'py-2 px-3 text-sm',
  md: 'py-2.5 px-3.5 text-sm',
  lg: 'py-3.5 px-4 text-base',
} as const;

export const THEME = { COLORS, GRAY, SPACING, RADIUS, TONE, CONTROL_HEIGHT } as const;
export default THEME;
