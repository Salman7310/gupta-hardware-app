import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  type KeyboardEvent,
  Platform,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';

/**
 * Keeps the field being typed into, and the Save bar beneath it, clear of the
 * keyboard.
 *
 * The app draws edge to edge — Expo SDK 57 turns it on and Android 15 enforces
 * it — and in that mode Android no longer shrinks the window when the keyboard
 * opens: the manifest's `adjustResize` is simply ignored. Every screen relied
 * on that shrinking, and the KeyboardAvoidingView each one sat in was switched
 * off on Android, so on a real phone the keyboard covered the lower fields and
 * the Save bar.
 *
 * This pads its own bottom by however much of it the keyboard covers, measured
 * against where the view actually is on screen. KeyboardAvoidingView measures
 * against its parent instead, so under a screen header it would leave the
 * bottom field half hidden unless every screen passed in its header's height.
 */
export function KeyboardAware({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const view = useRef<View>(null);
  const [covered, setCovered] = useState(0);

  useEffect(() => {
    const onShow = (event: KeyboardEvent) => {
      const keyboardTop = event.endCoordinates.screenY;
      view.current?.measureInWindow((_x, y, _width, height) => {
        setCovered(Math.max(0, Math.round(y + height - keyboardTop)));
      });
    };
    // Android reports the keyboard only once it is up; iOS warns before.
    const shown = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      onShow,
    );
    const hidden = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setCovered(0),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return (
    <View ref={view} style={[styles.fill, style, { paddingBottom: covered }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
