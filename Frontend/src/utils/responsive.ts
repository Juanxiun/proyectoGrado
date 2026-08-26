import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS } from '../constants/config';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isMobile = width < BREAKPOINTS.MOBILE;
  const isTablet = width >= BREAKPOINTS.MOBILE && width < 1024;
  const isDesktop = width >= 1024;

  return { width, height, isMobile, isTablet, isDesktop };
}
