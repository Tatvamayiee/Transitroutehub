/**
 * Navigation model for the platform modules.
 *
 * `roles` is the set of roles that actually get value from the page — it mirrors
 * the gate each route renders ("traders book space instead", "providers only",
 * "administrators only"). Navigation and the dashboard show only the modules for
 * the signed-in role, so nobody is offered a page that will just turn them away.
 * Permissions are still enforced on the server for every request; this list only
 * decides what is worth showing.
 *
 * Kept out of module-kit.tsx so that file stays component-only (fast refresh).
 */

import {
  BadgeCheck,
  BarChart3,
  Boxes,
  Camera,
  ClipboardList,
  Layers,
  MessagesSquare,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import type { UserRole } from "@/domain/types";

export const MODULE_NAV = [
  {
    to: "/catalog",
    label: "Cargo Search & Booking",
    short: "Search & book",
    icon: Search,
    roles: ["trader", "admin"],
  },
  {
    to: "/routes",
    label: "Container & Route Management",
    short: "Routes & containers",
    icon: RouteIcon,
    roles: ["provider", "admin"],
  },
  {
    to: "/verification",
    label: "Provider Verification",
    short: "Verification",
    icon: BadgeCheck,
    roles: ["provider", "admin"],
  },
  {
    to: "/bookings",
    label: "Booking Management",
    short: "Bookings",
    icon: ClipboardList,
    roles: ["trader", "provider", "admin"],
  },
  {
    to: "/cargo-review",
    label: "Cargo Photo Review",
    short: "Cargo review",
    icon: Camera,
    roles: ["provider", "admin"],
  },
  {
    to: "/loading",
    label: "3D Load Planner",
    short: "Load planner",
    icon: Boxes,
    roles: ["trader", "provider", "admin"],
  },
  {
    to: "/payments",
    label: "Payment & Escrow",
    short: "Payments",
    icon: Wallet,
    roles: ["trader", "provider", "admin"],
  },
  {
    to: "/messages",
    label: "Communication & Notifications",
    short: "Messages",
    icon: MessagesSquare,
    roles: ["trader", "provider", "admin"],
  },
  {
    to: "/aggregation",
    label: "Cargo Space Aggregation",
    short: "Capacity",
    icon: Layers,
    roles: ["trader", "provider", "admin"],
  },
  {
    to: "/reports",
    label: "Reports & AI Enhancements",
    short: "Reports",
    icon: BarChart3,
    roles: ["provider", "admin"],
  },
  {
    to: "/admin",
    label: "Admin Dashboard",
    short: "Admin",
    icon: ShieldAlert,
    roles: ["admin"],
  },
] as const;

export type ModuleNavItem = (typeof MODULE_NAV)[number];

/** Modules worth showing for a role; signed-out visitors get none. */
export function modulesForRole(role: UserRole | null): ModuleNavItem[] {
  if (!role) return [];
  return MODULE_NAV.filter((item) => (item.roles as readonly UserRole[]).includes(role));
}
