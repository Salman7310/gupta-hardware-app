import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevation, radius, size, space, theme, type } from '../theme';

export interface MenuAction {
  readonly label: string;
  readonly onPress: () => void;
  /** Shown in red. For anything the shopkeeper cannot take back. */
  readonly destructive?: boolean;
}

/**
 * The ⋮ menu in a screen's header.
 *
 * Actions that change a document permanently live here rather than at the foot
 * of the screen. Two reasons, both learned the hard way: at the bottom of a
 * long bill they sit below the fold, so the shopkeeper never finds them; and
 * styled quietly enough not to be tapped by accident, they stop looking like
 * buttons at all. In the header they are always one tap away, always in the
 * same place, and nowhere near Share, which is what gets pressed all day.
 */
export function HeaderMenu({ actions }: { actions: readonly MenuAction[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();

  if (actions.length === 0) return null;

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        hitSlop={12}
        style={styles.trigger}
        accessibilityRole="button"
        accessibilityLabel="More actions"
      >
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        {/* Tapping anywhere off the menu closes it, as a menu should. */}
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={[styles.sheet, { marginTop: insets.top + size.tap }]}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  // Closed first, so the confirmation that follows is not
                  // stacked underneath a menu that is still open.
                  setIsOpen(false);
                  action.onPress();
                }}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                accessibilityRole="button"
              >
                <Text style={[styles.label, action.destructive && styles.destructive]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: size.tap,
    height: size.tap,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.text },

  backdrop: { flex: 1, alignItems: 'flex-end' },
  sheet: {
    marginRight: space.sm,
    minWidth: 220,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    paddingVertical: space.xs,
    ...elevation.raised,
  },
  item: {
    minHeight: size.tap,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  itemPressed: { backgroundColor: theme.surfaceSunken },
  label: { ...type.body, color: theme.text },
  destructive: { color: theme.danger },
});
