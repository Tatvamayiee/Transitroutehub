import type { LucideIcon } from 'lucide-react';
import { Handshake, Package, Search, Truck } from 'lucide-react';
import type { Capability, UserRole } from '../types';

export interface RoleConfig {
  role: Exclude<UserRole, 'ADMIN'>;
  title: string;
  selectionTitle: string;
  description: string;
  detail: string;
  loginTitle: string;
  loginSubtitle: string;
  primaryAction: string;
  registerAction: string;
  icon: LucideIcon;
  accent: 'orange' | 'cyan' | 'teal' | 'navy';
  capabilities: Capability[];
}

export const ROLE_CONFIGS: RoleConfig[] = [
  {
    role: 'CARGO_OWNER',
    title: 'Move My Cargo',
    selectionTitle: 'Continue as Cargo Owner',
    description: 'I have cargo that needs transportation.',
    detail: 'Post cargo, find available space and track shipments.',
    loginTitle: 'Move your cargo smarter.',
    loginSubtitle: 'Post your shipment, find available space and track it from pickup to delivery.',
    primaryAction: 'Sign In',
    registerAction: 'Create Cargo Account',
    icon: Package,
    accent: 'orange',
    capabilities: ['POST_CARGO', 'FIND_SPACE', 'BOOK', 'TRACK', 'OPTIMIZE'],
  },
  {
    role: 'BOOKER',
    title: 'Find & Book',
    selectionTitle: 'Continue as Booker',
    description: 'I want to find and book transportation space.',
    detail: 'Compare routes, prices, capacity and ETAs.',
    loginTitle: 'Find the right space for your shipment.',
    loginSubtitle: 'Compare available capacity, prices and ETAs before you book.',
    primaryAction: 'Find Available Space',
    registerAction: 'Create Booking Account',
    icon: Search,
    accent: 'cyan',
    capabilities: ['FIND_SPACE', 'BOOK', 'TRACK', 'OPTIMIZE'],
  },
  {
    role: 'INTERMEDIARY',
    title: 'Connect Cargo & Capacity',
    selectionTitle: 'Continue as Intermediary',
    description: 'I connect cargo with available transportation.',
    detail: 'Match cargo requests with transport operators.',
    loginTitle: 'Connect cargo with capacity.',
    loginSubtitle: 'Match transportation demand with available capacity and build better routes.',
    primaryAction: 'Open Matching Center',
    registerAction: 'Create Intermediary Account',
    icon: Handshake,
    accent: 'teal',
    capabilities: ['FIND_SPACE', 'BOOK', 'TRACK', 'MATCH', 'UPDATE_SHIPMENT', 'VIEW_ANALYTICS', 'OPTIMIZE'],
  },
  {
    role: 'TRANSPORT_OPERATOR',
    title: 'Offer Cargo Space',
    selectionTitle: 'Continue as Transport Operator',
    description: 'I have available transportation capacity.',
    detail: 'Publish routes, manage capacity and accept bookings.',
    loginTitle: 'Turn available capacity into opportunity.',
    loginSubtitle: 'Publish your available space, receive cargo matches and manage your fleet.',
    primaryAction: 'Manage Available Space',
    registerAction: 'Create Transport Account',
    icon: Truck,
    accent: 'navy',
    capabilities: ['POST_CAPACITY', 'MANAGE_ROUTES', 'MATCH', 'TRACK', 'UPDATE_SHIPMENT', 'VIEW_ANALYTICS', 'OPTIMIZE'],
  },
];

export function getRoleConfig(role?: UserRole): RoleConfig {
  return ROLE_CONFIGS.find((config) => config.role === role) ?? ROLE_CONFIGS[0];
}

export function getCapabilities(role: UserRole): Capability[] {
  if (role === 'ADMIN') return ['POST_CARGO', 'FIND_SPACE', 'BOOK', 'TRACK', 'MATCH', 'POST_CAPACITY', 'MANAGE_ROUTES', 'UPDATE_SHIPMENT', 'VIEW_ANALYTICS', 'OPTIMIZE'];
  return getRoleConfig(role).capabilities;
}
