const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * "14 Mar 2026". Written out rather than left to Intl, which is not guaranteed
 * on every engine this ships to, and a bill date that renders differently on
 * two phones is a support call.
 */
export function formatDate(epochMs: number): string {
  const at = new Date(epochMs);
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
}

export function formatTime(epochMs: number): string {
  const at = new Date(epochMs);
  const hours = at.getHours();
  const minutes = String(at.getMinutes()).padStart(2, '0');
  const suffix = hours < 12 ? 'am' : 'pm';
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${minutes} ${suffix}`;
}
