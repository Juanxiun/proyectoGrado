import { StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';

export const loginStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(128, 21, 41, 0.85)',
  },
  cardFooter: {
    backgroundColor: COLORS.cream,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
});
