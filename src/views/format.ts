// The formatters live in core so a printed bill, which is built in a service,
// can use the same ones the screens do. Re-exported here so existing screens
// keep their import.
export { formatDate, formatTime } from '../core';

/**
 * A granted folder's name, from the uri Android hands back: "Documents" from
 * `.../tree/primary%3ADocuments`, "Documents/Gupta" for a folder inside it.
 * Falls back to a plain "Chosen" for a provider that does not put a path in
 * its uris, which is still true and better than a uri.
 */
export function folderLabel(uri: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(uri);
  } catch {
    return 'Chosen';
  }
  const tree = decoded.split('/tree/')[1];
  if (!tree) return 'Chosen';
  if (tree === 'downloads') return 'Downloads';
  const path = tree.includes(':') ? tree.slice(tree.indexOf(':') + 1) : tree;
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  if (trimmed.length === 0) return 'Phone storage';
  return trimmed.replace(/^storage\/emulated\/0\//, '');
}
