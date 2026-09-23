import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../components/BrandMark';
import { space, theme, type } from '../theme';

/**
 * What the shop looks at while the database is being opened and unlocked.
 *
 * It carries the same mark on the same green as the launch image the system
 * shows first, so start-up is one continuous screen rather than a brand splash
 * that blinks out into a bare spinner.
 */
export function LaunchScreen({ message }: { message?: string }) {
  return (
    <View style={styles.screen}>
      <View style={styles.centre}>
        <BrandMark size={84} />
        <Text style={styles.name}>Gupta Hardware</Text>
        <Text style={styles.tagline}>Billing and stock</Text>
      </View>

      <View style={styles.foot}>
        <ActivityIndicator color={theme.accentText} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.accent, padding: space.xxl },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  name: { ...type.title, color: theme.accentText, marginTop: space.sm },
  tagline: { ...type.caption, color: '#D6EFE5', marginTop: -space.sm },
  foot: { alignItems: 'center', gap: space.md, paddingBottom: space.xl },
  message: { ...type.caption, color: '#D6EFE5', textAlign: 'center' },
});
