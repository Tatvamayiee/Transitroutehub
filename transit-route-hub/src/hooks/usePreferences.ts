import { useEffect, useState, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { getUserCurrency } from '../utils/format';
import type { UserSettings } from '../types';

const DARK_KEY = 'trh.v1.darkMode';
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function readDark(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DARK_KEY) === '1';
}

export function applyDarkMode(value: boolean) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DARK_KEY, value ? '1' : '0');
  const root = document.documentElement;
  if (value) root.classList.add('dark');
  else root.classList.remove('dark');
  notify();
}

export function initTheme() {
  applyDarkMode(readDark());
}

export function usePreferences(userId: string | undefined) {
  const [settings, setSettings] = useState<UserSettings | null>(() =>
    userId ? storageService.getSettings(userId) ?? null : null,
  );

  const refresh = useCallback(() => {
    if (!userId) return;
    setSettings(storageService.getSettings(userId) ?? null);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = () => refresh();
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, [refresh]);

  function update(patch: Partial<UserSettings>) {
    if (!userId) return;
    const next: UserSettings = {
      userId,
      emailNotifications: true,
      pushNotifications: true,
      shipmentUpdates: true,
      routeMatches: true,
      darkMode: false,
      currency: 'INR',
      ...settings,
      ...patch,
    };
    if (patch.darkMode !== undefined) applyDarkMode(patch.darkMode);
    storageService.upsertSettings(next);
    setSettings(next);
    notify();
  }

  return { settings, update };
}

export function useCurrency() {
  const [currency, setCurrency] = useState<'INR' | 'USD'>(getUserCurrency());
  useEffect(() => {
    const handler = () => setCurrency(getUserCurrency());
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);
  return currency;
}

