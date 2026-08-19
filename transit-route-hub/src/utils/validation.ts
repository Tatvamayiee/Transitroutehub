import { trimAll } from './format';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(trimAll(value));
}

export function isPhone(value: string): boolean {
  return PHONE_RE.test(trimAll(value));
}

export function isPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function isNonNegativeNumber(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function isValidDate(value: string): boolean {
  const t = new Date(value).getTime();
  return !Number.isNaN(t);
}

export function isFutureDate(value: string): boolean {
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return t >= today.getTime();
}

export function isDeliveryAfterPickup(pickup: string, delivery: string): boolean {
  if (!isValidDate(pickup) || !isValidDate(delivery)) return false;
  return new Date(delivery).getTime() >= new Date(pickup).getTime();
}

export interface PasswordStrength {
  ok: boolean;
  issues: string[];
}

export function passwordStrength(value: string): PasswordStrength {
  const issues: string[] = [];
  if (!value || value.length < 8) issues.push('At least 8 characters');
  if (!/[A-Za-z]/.test(value)) issues.push('At least one letter');
  if (!/[0-9]/.test(value)) issues.push('At least one number');
  return { ok: issues.length === 0, issues };
}

export function matchPassword(a: string, b: string): boolean {
  return typeof a === 'string' && a === b && a.length > 0;
}

export function sanitizeText(value: string, max = 500): string {
  return trimAll(String(value || '')).slice(0, max);
}
