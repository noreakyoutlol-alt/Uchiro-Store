/**
 * Formats an order ID or number to a clean, consistent short badge.
 * Examples:
 *   "3097fa8b-4c21-4f1a-b328-98e6a12b4567" -> "#UCH-3097FA"
 *   "UCH-3097FA" -> "#UCH-3097FA"
 *   "#UCH-3097FA" -> "#UCH-3097FA"
 */
export function formatShortOrderId(id: string): string {
  if (!id) return '#UCH-000000';
  if (id.startsWith('#')) return id;
  if (id.startsWith('UCH-')) return `#${id}`;
  const clean = id.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `#UCH-${clean}`;
}
