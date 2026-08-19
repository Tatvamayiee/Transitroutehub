export function classNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatINR(value: number, currency: 'INR' | 'USD' = 'INR'): string {
  if (!Number.isFinite(value)) return currency === 'USD' ? '$0' : '₹0';
  if (currency === 'USD') {
    const usd = value / 83;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(usd);
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getUserCurrency(): 'INR' | 'USD' {
  if (typeof window === 'undefined') return 'INR';
  try {
    const raw = localStorage.getItem('trh.v1.settings');
    if (!raw) return 'INR';
    const arr = JSON.parse(raw) as Array<{ currency: 'INR' | 'USD' }>;
    return arr[0]?.currency === 'USD' ? 'USD' : 'INR';
  } catch {
    return 'INR';
  }
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDate(iso: string, withTime = true): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    if (!withTime) return date;
    const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} · ${time}`;
  } catch {
    return '—';
  }
}

export function formatRelative(iso: string): string {
  try {
    const d = new Date(iso).getTime();
    if (Number.isNaN(d)) return '';
    const diff = Date.now() - d;
    const m = 60_000, h = m * 60, day = h * 24;
    if (diff < m) return 'just now';
    if (diff < h) return `${Math.floor(diff / m)} min ago`;
    if (diff < day) return `${Math.floor(diff / h)} h ago`;
    if (diff < day * 7) return `${Math.floor(diff / day)} d ago`;
    return formatDate(iso, false);
  } catch {
    return '';
  }
}

export function shortId(prefix = 'TRH'): string {
  const part = Math.random().toString(36).slice(2, 7).toUpperCase();
  const yr = new Date().getFullYear();
  return `${prefix}-${yr}-${part}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function safeNumber(input: unknown, fallback = 0): number {
  const n = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(n) ? n : fallback;
}

export function trimAll(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}
