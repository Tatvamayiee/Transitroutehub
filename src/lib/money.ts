/**
 * Money formatting for the platform.
 *
 * Amounts are stored as plain numbers (`containers.price_per_m3`, `payments.amount`)
 * and the platform quotes them in rupees: `payments.currency` records `INR` and
 * every displayed figure carries the `₹` symbol.
 *
 * Grouping is done here rather than through `Intl.NumberFormat` so the value
 * rendered on the server and on the client is byte-identical (no hydration
 * mismatch), using the Indian convention of a final group of three digits
 * followed by pairs of two: `1234567.5` → `12,34,567.50`.
 */

export const CURRENCY_CODE = "INR";
export const CURRENCY_SYMBOL = "₹";

/** Place a `₹` amount as one ready-to-render string. */
export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const fixed = Math.abs(safe).toFixed(2);
  const dot = fixed.indexOf(".");
  const whole = fixed.slice(0, dot);
  const fraction = fixed.slice(dot + 1);
  const head = whole.length > 3 ? whole.slice(0, -3) : "";
  const tail = whole.slice(-3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}` : tail;
  return `${safe < 0 ? "-" : ""}${CURRENCY_SYMBOL}${grouped}.${fraction}`;
}
