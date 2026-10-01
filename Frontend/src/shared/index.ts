/**
 * Capa compartida entre features: tokens de diseño, primitivas de UI y reglas
 * de credenciales. Un feature importa desde aquí, nunca desde otro feature.
 */
export * from './theme';
export * from './validation/credentials';
export * from './ui';
