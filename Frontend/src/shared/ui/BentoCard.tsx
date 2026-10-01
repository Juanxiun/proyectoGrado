import { View, type ViewProps } from 'react-native';

interface BentoCardProps extends ViewProps {
  className?: string;
  children: React.ReactNode;
}

export function BentoCard({ className = '', children, ...props }: BentoCardProps) {
  return (
    <View
      className={`rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
