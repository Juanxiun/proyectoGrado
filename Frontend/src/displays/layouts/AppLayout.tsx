import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsive } from '../../utils/responsive';
import { AppHeader } from '../components/AppHeader';
import { BottomNav } from '../components/BottomNav';
import { Sidebar, type NavItem } from '../components/Sidebar';

interface AppLayoutProps {
  title: string;
  userName: string;
  userEmail: string;
  userPhoto?: string | null;
  navItems: NavItem[];
  activeRoute: string;
  onNavigate: (route: string) => void;
  onProfilePress?: () => void;
  children: React.ReactNode;
}

export function AppLayout({
  title,
  userName,
  userEmail,
  userPhoto,
  navItems,
  activeRoute,
  onNavigate,
  onProfilePress,
  children,
}: AppLayoutProps) {
  const { isMobile } = useResponsive();

  return (
    <SafeAreaView className="flex-1 bg-gray-100" edges={['top']}>
      <View className="flex-1 flex-row">
        {!isMobile && (
          <Sidebar items={navItems} activeRoute={activeRoute} onNavigate={onNavigate} />
        )}

        <View className="flex-1">
          <AppHeader
            title={title}
            userName={userName}
            userEmail={userEmail}
            userPhoto={userPhoto}
            onProfilePress={onProfilePress}
          />

          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4 pb-8"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {isMobile && (
            <BottomNav items={navItems} activeRoute={activeRoute} onNavigate={onNavigate} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
