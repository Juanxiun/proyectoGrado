import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface AppModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the user closes the modal (X button, backdrop tap, or Android back). */
  onClose: () => void;
  /** Header title */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Background color for the header bar (default: maroon #801529) */
  headerColor?: string;
  /** Maximum width of the modal card (default: max-w-3xl) */
  maxWidthClass?: string;
  /** Content inside the modal body */
  children: React.ReactNode;
  /** Whether to show the close X button in the header (default: true) */
  showCloseButton?: boolean;
  /** Whether tapping the backdrop should close the modal (default: true) */
  closeOnBackdrop?: boolean;
}

/**
 * AppModal — shared modal shell used across the entire system.
 *
 * Features:
 *  - Semi-transparent dark backdrop (closes the modal on tap by default)
 *  - Colored header bar with title, optional subtitle, and ✕ close button
 *  - Scrollable body via ScrollView
 *  - Android back-button support via onRequestClose
 *  - KeyboardAvoidingView so inputs stay visible on iOS
 */
export function AppModal({
  visible,
  onClose,
  title,
  subtitle,
  headerColor = '#801529',
  maxWidthClass = 'max-w-3xl',
  children,
  showCloseButton = true,
  closeOnBackdrop = true,
}: AppModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        {/* Backdrop — tap to close */}
        <TouchableWithoutFeedback
          onPress={closeOnBackdrop ? onClose : undefined}
          accessible={false}
        >
          <View className="absolute inset-0 bg-black/60" />
        </TouchableWithoutFeedback>

        {/* Card container — stop backdrop propagation */}
        <View className="flex-1 items-center justify-center p-3 md:p-6">
          <TouchableWithoutFeedback accessible={false}>
            <View
              className={`bg-white rounded-3xl w-full ${maxWidthClass} max-h-[92vh] overflow-hidden shadow-2xl flex-col`}
            >
              {/* ─── Header ─────────────────────────────────────────── */}
              <View
                style={{ backgroundColor: headerColor }}
                className="px-5 py-4 flex-row items-center justify-between"
              >
                <View className="flex-1 pr-3">
                  <Text className="text-base font-bold text-white" numberOfLines={2}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text className="text-xs text-white/75 mt-0.5" numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                {showCloseButton && (
                  <TouchableOpacity
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="w-9 h-9 rounded-full bg-white/20 items-center justify-center"
                    accessibilityLabel="Cerrar modal"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* ─── Body (scrollable) ───────────────────────────────── */}
              <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, gap: 16 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
