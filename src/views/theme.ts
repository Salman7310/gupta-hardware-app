import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * One place for colour, spacing and type, so screens stay consistent as they
 * multiply.
 *
 * `accent` is the brand green and is only ever a fill behind white text. Green
 * text on white sits near 3:1, which is under AA for body sizes, so anything
 * written in the brand colour uses `accentInk` instead. The shop reads this in
 * daylight with dusty hands; contrast is not decoration.
 */
export const theme = {
  background: '#F6F6F3',
  surface: '#FFFFFF',
  surfaceSunken: '#EFEFEA',
  border: '#E3E3DC',
  borderStrong: '#CFCFC6',

  text: '#16161A',
  textLabel: '#3D3D38',
  textMuted: '#6E6E68',
  textPlaceholder: '#9A9A92',

  /** Fills only — white sits on this. */
  accent: '#1D9E75',
  accentPressed: '#17855F',
  accentText: '#FFFFFF',
  /** Brand colour written as text, dark enough to read. */
  accentInk: '#0F7355',
  accentSurface: '#E8F5EF',

  danger: '#A32D2D',
  dangerSurface: '#FBEDED',
  warningBg: '#FAEEDA',
  warningText: '#854F0B',
} as const;

/** A 4pt rhythm. Screens use these rather than loose numbers. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  huge: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/**
 * Touch targets. The shop uses this one-handed at a counter, often holding
 * something else, so nothing interactive is smaller than `tap`.
 */
export const size = {
  tap: 52,
  control: 56,
  fab: 62,
} as const;

export const type = {
  display: { fontSize: 28, fontWeight: '600', letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.2 },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '400' },
  micro: { fontSize: 12, fontWeight: '500' },
} satisfies Record<string, TextStyle>;

/**
 * Depth instead of outlines. A card that lifts off the background reads faster
 * than one fenced by a hairline, and hairlines disappear on a cheap screen in
 * a bright shop.
 */
export const elevation = {
  card: Platform.select({
    android: { elevation: 1.5 },
    default: {
      shadowColor: '#1B1B16',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
  }),
  raised: Platform.select({
    android: { elevation: 5 },
    default: {
      shadowColor: '#1B1B16',
      shadowOpacity: 0.16,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
  }),
} satisfies Record<string, ViewStyle | undefined>;

/** The surface most content sits on. */
export const card: ViewStyle = {
  backgroundColor: theme.surface,
  borderRadius: radius.lg,
  ...elevation.card,
};

/** Shared by every stack screen, so headers do not drift apart. */
export const screenOptions = {
  headerTitleStyle: { ...type.heading, color: theme.text },
  headerStyle: { backgroundColor: theme.background },
  headerShadowVisible: false,
  headerTintColor: theme.accentInk,
  contentStyle: { backgroundColor: theme.background },
} as const;
