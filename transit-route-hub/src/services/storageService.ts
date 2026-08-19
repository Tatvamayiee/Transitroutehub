import type { AppNotification, Booking, Cargo, Route, Shipment, User, UserSettings, SessionInfo } from '../types';
import { DEMO_OWNER_PASSWORD_HASH } from '../utils/hash';
import {
  seedCargo,
  seedDemoOwner,
  seedDemoBooker,
  seedDemoIntermediary,
  seedBookings,
  seedNotifications,
  seedOperators,
  seedRoutes,
  seedSettings,
  seedShipments,
} from '../data/seed';

const KEY_PREFIX = 'trh.v1.';
const KEYS = {
  users: KEY_PREFIX + 'users',
  session: KEY_PREFIX + 'session',
  cargo: KEY_PREFIX + 'cargo',
  routes: KEY_PREFIX + 'routes',
  bookings: KEY_PREFIX + 'bookings',
  shipments: KEY_PREFIX + 'shipments',
  notifications: KEY_PREFIX + 'notifications',
  settings: KEY_PREFIX + 'settings',
  seeded: KEY_PREFIX + 'seeded',
} as const;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    return safeParse<T>(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable; fail silently
  }
}

export const storageService = {
  // Initialization
  init(): void {
    if (typeof window === 'undefined') return;
    const seeded = read<boolean>(KEYS.seeded, false);
    if (!seeded) {
      write(KEYS.users, [seedDemoOwner, seedDemoBooker, seedDemoIntermediary, ...seedOperators]);
      write(KEYS.cargo, seedCargo);
      write(KEYS.routes, seedRoutes);
      write(KEYS.bookings, seedBookings);
      write(KEYS.shipments, seedShipments);
      write(KEYS.notifications, seedNotifications);
      write(KEYS.settings, seedSettings);
      write(KEYS.seeded, true);
      return;
    }

    // Repair older demo seeds that were created before the demo hash was included.
    const users = this.getUsers();
    const knownSeeds = [seedDemoOwner, seedDemoBooker, seedDemoIntermediary, ...seedOperators];
    knownSeeds.forEach((seedUser) => {
      const existing = users.find((user) => user.id === seedUser.id);
      if (!existing) {
        this.upsertUser(seedUser);
      } else if (!existing.passwordHash) {
        this.upsertUser({ ...existing, passwordHash: DEMO_OWNER_PASSWORD_HASH });
      }
    });
  },

  resetDemoData(): void {
    if (typeof window === 'undefined') return;
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    this.init();
  },

  // Users
  getUsers(): User[] {
    return read<User[]>(KEYS.users, []);
  },
  saveUsers(users: User[]): void {
    write(KEYS.users, users);
  },
  upsertUser(user: User): void {
    const users = this.getUsers();
    const i = users.findIndex((u) => u.id === user.id);
    if (i >= 0) users[i] = user;
    else users.push(user);
    this.saveUsers(users);
  },
  findUserByEmail(email: string): User | undefined {
    return this.getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  findUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
  },

  // Session
  getSession(): SessionInfo | null {
    return read<SessionInfo | null>(KEYS.session, null);
  },
  setSession(session: SessionInfo): void {
    write(KEYS.session, session);
  },
  clearSession(): void {
    localStorage.removeItem(KEYS.session);
  },

  // Cargo
  getCargo(): Cargo[] {
    return read<Cargo[]>(KEYS.cargo, []);
  },
  saveCargo(cargo: Cargo[]): void {
    write(KEYS.cargo, cargo);
  },
  addCargo(cargo: Cargo): void {
    const list = this.getCargo();
    list.unshift(cargo);
    this.saveCargo(list);
  },

  // Routes
  getRoutes(): Route[] {
    return read<Route[]>(KEYS.routes, []);
  },
  saveRoutes(routes: Route[]): void {
    write(KEYS.routes, routes);
  },
  getRouteById(id: string): Route | undefined {
    return this.getRoutes().find((r) => r.id === id);
  },

  // Bookings
  getBookings(): Booking[] {
    return read<Booking[]>(KEYS.bookings, []);
  },
  saveBookings(bookings: Booking[]): void {
    write(KEYS.bookings, bookings);
  },
  addBooking(booking: Booking): void {
    const list = this.getBookings();
    list.unshift(booking);
    this.saveBookings(list);
  },

  // Shipments
  getShipments(): Shipment[] {
    return read<Shipment[]>(KEYS.shipments, []);
  },
  saveShipments(shipments: Shipment[]): void {
    write(KEYS.shipments, shipments);
  },
  addShipment(shipment: Shipment): void {
    const list = this.getShipments();
    list.unshift(shipment);
    this.saveShipments(list);
  },
  getShipmentById(id: string): Shipment | undefined {
    return this.getShipments().find((s) => s.id === id);
  },

  // Notifications
  getNotifications(): AppNotification[] {
    return read<AppNotification[]>(KEYS.notifications, []);
  },
  saveNotifications(notifications: AppNotification[]): void {
    write(KEYS.notifications, notifications);
  },
  addNotification(n: AppNotification): void {
    const list = this.getNotifications();
    list.unshift(n);
    this.saveNotifications(list);
  },
  markNotificationRead(id: string): void {
    const list = this.getNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
    this.saveNotifications(list);
  },
  markAllNotificationsRead(userId: string): void {
    const list = this.getNotifications().map((n) =>
      n.userId === userId ? { ...n, read: true } : n,
    );
    this.saveNotifications(list);
  },

  // Settings
  getSettings(userId: string): UserSettings | undefined {
    return read<UserSettings[]>(KEYS.settings, []).find((s) => s.userId === userId);
  },
  upsertSettings(settings: UserSettings): void {
    const list = read<UserSettings[]>(KEYS.settings, []);
    const i = list.findIndex((s) => s.userId === settings.userId);
    if (i >= 0) list[i] = settings;
    else list.push(settings);
    write(KEYS.settings, list);
  },
};
