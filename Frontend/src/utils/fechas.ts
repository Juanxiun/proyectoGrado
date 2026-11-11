export const MONTHS = [
  { short: 'Ene', long: 'Enero' },
  { short: 'Feb', long: 'Febrero' },
  { short: 'Mar', long: 'Marzo' },
  { short: 'Abr', long: 'Abril' },
  { short: 'May', long: 'Mayo' },
  { short: 'Jun', long: 'Junio' },
  { short: 'Jul', long: 'Julio' },
  { short: 'Ago', long: 'Agosto' },
  { short: 'Sep', long: 'Septiembre' },
  { short: 'Oct', long: 'Octubre' },
  { short: 'Nov', long: 'Noviembre' },
  { short: 'Dic', long: 'Diciembre' },
];

// dateString -> armar fecha YYYY-MM-DD desde sus componentes
export const dateString = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

// formatFechaHora -> ISO a "YYYY-MM-DD HH:mm"
export function formatFechaHora(iso?: string | null): string {
  return iso?.replace(/T/, ' ').slice(0, 16) ?? '';
}

// formatFechaHoraSegundos -> ISO a "YYYY-MM-DD HH:mm:ss"
export function formatFechaHoraSegundos(iso?: string | null): string {
  return iso?.replace(/T/, ' ').slice(0, 19) ?? '';
}
