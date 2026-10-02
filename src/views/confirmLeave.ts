import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from 'expo-router';

/**
 * Asks before a screen with unsaved work is left, by Back, the header arrow or
 * a swipe — all of which used to drop a half-written bill without a word.
 *
 * Returns a function to call just before leaving on purpose, after a save:
 * the screen is replaced by what was saved, and that is not a discard.
 */
export function useConfirmLeave(hasWork: boolean, title: string, message: string): () => void {
  const navigation = useNavigation();
  const leaving = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!hasWork || leaving.current) return;
        event.preventDefault();
        Alert.alert(title, message, [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.dispatch(event.data.action),
          },
        ]);
      }),
    [navigation, hasWork, title, message],
  );

  return useCallback(() => {
    leaving.current = true;
  }, []);
}

/**
 * The same question for a sheet, closed by Back or its own Cancel. On a phone
 * the keyboard's hide button can send Back, so the sheet the shopkeeper is
 * typing into could vanish with everything in it.
 */
export function confirmDiscard(
  hasWork: boolean,
  title: string,
  message: string,
  discard: () => void,
): void {
  if (!hasWork) {
    discard();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Keep editing', style: 'cancel' },
    { text: 'Discard', style: 'destructive', onPress: discard },
  ]);
}
