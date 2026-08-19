import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { storageService } from '../services/storageService';
import type { Capability, CargoPartyType, User, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  login: (email: string, password: string, role?: UserRole, cargoPartyType?: CargoPartyType) => Promise<User>;
  register: (input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirmPassword: string;
    role: UserRole;
    cargoPartyType?: CargoPartyType;
    companyName?: string;
  }) => Promise<User>;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'phone' | 'companyName' | 'cargoPartyType'>>) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  hasCapability: (capability: Capability) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    storageService.init();
    setUser(authService.currentUser());
    setInitializing(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      async login(email, password, role, cargoPartyType) {
        const u = await authService.login(email, password, role, cargoPartyType);
        setUser(u);
        return u;
      },
      async register(input) {
        const u = await authService.register(input);
        setUser(u);
        return u;
      },
      logout() {
        authService.logout();
        setUser(null);
      },
      updateProfile(patch) {
        if (!user) return;
        const updated = authService.updateProfile(user.id, patch);
        setUser(updated);
      },
      hasRole(...roles) {
        return user ? roles.includes(user.role) : false;
      },
      hasCapability(capability) {
        return user?.capabilities?.includes(capability) ?? false;
      },
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}