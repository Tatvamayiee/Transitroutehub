import { storageService } from './storageService';
import { hashPassword, verifyPassword } from '../utils/hash';
import { sanitizeText, isEmail, isPhone, passwordStrength } from '../utils/validation';
import { shortId } from '../utils/format';
import { getCapabilities } from '../data/roles';
import type { CargoPartyType, User, UserRole, SessionInfo } from '../types';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8h

export const authService = {
  async register(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    role: UserRole;
    cargoPartyType?: CargoPartyType;
    companyName?: string;
  }): Promise<User> {
    const name = sanitizeText(input.name, 80);
    const email = sanitizeText(input.email, 120).toLowerCase();
    const phone = sanitizeText(input.phone, 20);
    if (!name) throw new Error('Name is required.');
    if (!isEmail(email)) throw new Error('Please enter a valid email address.');
    if (!isPhone(phone)) throw new Error('Please enter a valid phone number.');
    if (passwordStrength(input.password).ok !== true) {
      throw new Error('Password must be at least 8 characters and include letters and numbers.');
    }
    if (input.password !== input.confirmPassword) throw new Error('Passwords do not match.');
    if (!['CARGO_OWNER', 'BOOKER', 'INTERMEDIARY', 'TRANSPORT_OPERATOR'].includes(input.role)) {
      throw new Error('Invalid account type.');
    }
    if (storageService.findUserByEmail(email)) {
      throw new Error('An account with this email already exists.');
    }
    const passwordHash = await hashPassword(input.password);
    const user: User = {
      id: shortId('USR'),
      name,
      email,
      phone,
      role: input.role,
      cargoPartyType: input.role === 'CARGO_OWNER' ? input.cargoPartyType : undefined,
      capabilities: getCapabilities(input.role),
      companyName: sanitizeText(input.companyName || '', 80) || undefined,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    storageService.upsertUser(user);
    this.createSession(user.id);
    return user;
  },

  async login(email: string, password: string, expectedRole?: UserRole, cargoPartyType?: CargoPartyType): Promise<User> {
    const safeEmail = sanitizeText(email, 120).toLowerCase();
    if (!isEmail(safeEmail)) throw new Error('Please enter a valid email address.');
    const user = storageService.findUserByEmail(safeEmail);
    if (!user) throw new Error('Invalid email or password.');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new Error('Invalid email or password.');
    if (expectedRole && user.role !== expectedRole) {
      throw new Error(`This account is set up as ${user.role.replace(/_/g, ' ').toLowerCase()}. Choose that role to continue.`);
    }
    const capabilities = Array.from(new Set([...getCapabilities(user.role), ...(user.capabilities ?? [])]));
    const authenticatedUser = { ...user, capabilities, cargoPartyType: user.role === 'CARGO_OWNER' ? cargoPartyType ?? user.cargoPartyType : undefined };
    if (JSON.stringify(user.capabilities ?? []) !== JSON.stringify(capabilities)) storageService.upsertUser(authenticatedUser);
    this.createSession(user.id);
    return authenticatedUser;
  },

  createSession(userId: string): void {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + SESSION_DURATION_MS);
    const session: SessionInfo = {
      userId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    storageService.setSession(session);
  },

  logout(): void {
    storageService.clearSession();
  },

  currentUser(): User | null {
    const session = storageService.getSession();
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      storageService.clearSession();
      return null;
    }
    const user = storageService.findUserById(session.userId);
    if (!user) return null;
    const capabilities = Array.from(new Set([...getCapabilities(user.role), ...(user.capabilities ?? [])]));
    if (JSON.stringify(user.capabilities ?? []) !== JSON.stringify(capabilities)) {
      const updated = { ...user, capabilities };
      storageService.upsertUser(updated);
      return updated;
    }
    return { ...user, capabilities };
  },

  updateProfile(userId: string, patch: Partial<Pick<User, 'name' | 'phone' | 'companyName' | 'cargoPartyType'>>): User {
    const user = storageService.findUserById(userId);
    if (!user) throw new Error('User not found.');
    const updated: User = {
      ...user,
      name: patch.name ? sanitizeText(patch.name, 80) : user.name,
      phone: patch.phone ? sanitizeText(patch.phone, 20) : user.phone,
      companyName: patch.companyName !== undefined ? sanitizeText(patch.companyName, 80) : user.companyName,
      cargoPartyType: patch.cargoPartyType ?? user.cargoPartyType,
    };
    storageService.upsertUser(updated);
    return updated;
  },
};
