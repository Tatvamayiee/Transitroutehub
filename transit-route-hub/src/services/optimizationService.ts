import type { Booking, Cargo, CargoType, Route } from '../types';

export interface MatchRecommendation {
  cargo: Cargo;
  route: Route;
  score: number;
  estimatedCost: number;
  estimatedSavings: number;
  utilization: number;
  reason: string;
}

export interface ConsolidationOpportunity {
  cargoes: Cargo[];
  origin: string;
  destination: string;
  combinedWeight: number;
  combinedVolume: number;
  vehicleCapacity: number;
  individualCost: number;
  optimizedCost: number;
  savings: number;
  utilization: number;
  route?: Route;
  reasons: string[];
}

export interface OptimizationKpis {
  estimatedSavings: number;
  vehicleUtilization: number;
  cargoConsolidated: number;
  distanceOptimized: number;
  timeSaved: number;
  score: number;
  breakdown: {
    capacity: number;
    cost: number;
    route: number;
    delivery: number;
  };
}

export interface WhatIfResult {
  currentCost: number;
  optimizedCost: number;
  currentDays: number;
  optimizedDays: number;
  currentUtilization: number;
  optimizedUtilization: number;
  savings: number;
}

const SAFE_NUMBER = (value: number): number => (Number.isFinite(value) && value >= 0 ? value : 0);

export function cargoVolume(cargo: Cargo): number {
  const { length, width, height } = cargo.dimensions;
  return SAFE_NUMBER((length * width * height * cargo.quantity) / 1_000_000);
}

export function matchCargoToRoutes(cargos: Cargo[], routes: Route[]): MatchRecommendation[] {
  return cargos.flatMap((cargo) => routes
    .filter((route) => route.status === 'Active' && route.availableCapacity >= cargo.weight)
    .map((route) => {
      const origin = route.origin.toLowerCase() === cargo.origin.toLowerCase();
      const destination = route.destination.toLowerCase() === cargo.destination.toLowerCase();
      const dateCompatible = route.departure.slice(0, 10) === cargo.pickupDate.slice(0, 10) || new Date(route.departure) >= new Date(cargo.pickupDate);
      const vehicleCompatible = !cargo.vehiclePreference || route.vehicleType === cargo.vehiclePreference;
      const cargoCompatible = !route.supportedCargoTypes || route.supportedCargoTypes.includes(cargo.type as CargoType);
      const capacityFit = Math.min(100, (cargo.weight / route.availableCapacity) * 100);
      const score = Math.min(100, Math.round(
        (origin ? 28 : 8) +
        (destination ? 28 : 8) +
        (dateCompatible ? 16 : 5) +
        (vehicleCompatible ? 10 : 5) +
        (cargoCompatible ? 8 : 4) +
        (capacityFit >= 45 && capacityFit <= 85 ? 10 : 5),
      ));
      const estimatedCost = Math.round(route.price * (0.82 + capacityFit / 500));
      const estimatedSavings = Math.max(0, route.price - estimatedCost);
      const utilization = Math.round((cargo.weight / route.totalCapacity) * 100);
      const reason = origin && destination && cargo.weight <= route.availableCapacity
        ? 'High compatibility because the transport follows the requested corridor and has sufficient remaining capacity.'
        : 'Recommended based on available capacity, route proximity and delivery timing.';
      return { cargo, route, score, estimatedCost, estimatedSavings, utilization, reason };
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

export function findConsolidationOpportunities(cargos: Cargo[], routes: Route[]): ConsolidationOpportunity[] {
  const groups = new Map<string, Cargo[]>();
  cargos.filter((cargo) => cargo.status !== 'Cancelled').forEach((cargo) => {
    const key = `${cargo.origin.toLowerCase()}::${cargo.destination.toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), cargo]);
  });

  return Array.from(groups.values())
    .filter((group) => group.length >= 2)
    .map((group) => {
      const origin = group[0].origin;
      const destination = group[0].destination;
      const combinedWeight = group.reduce((sum, cargo) => sum + SAFE_NUMBER(cargo.weight), 0);
      const combinedVolume = group.reduce((sum, cargo) => sum + cargoVolume(cargo), 0);
      const route = routes
        .filter((candidate) => candidate.status === 'Active' && candidate.origin === origin && candidate.destination === destination && candidate.availableCapacity >= combinedWeight)
        .sort((a, b) => a.price - b.price)[0];
      const vehicleCapacity = route?.availableCapacity ?? Math.max(combinedWeight, 1);
      const individualCost = group.reduce((sum) => sum + (route?.price ?? 10000), 0);
      const optimizedCost = route ? Math.round(route.price * 0.92) : Math.round(individualCost * 0.78);
      const savings = Math.max(0, individualCost - optimizedCost);
      return {
        cargoes: group,
        origin,
        destination,
        combinedWeight,
        combinedVolume,
        vehicleCapacity,
        individualCost,
        optimizedCost,
        savings,
        utilization: Math.min(100, Math.round((combinedWeight / vehicleCapacity) * 100)),
        route,
        reasons: ['Same origin and destination corridor', 'Pickup windows are compatible in demo data', 'Combined weight remains within available capacity'],
      };
    });
}

export function calculateKpis(cargos: Cargo[], routes: Route[], bookings: Booking[]): OptimizationKpis {
  const matches = matchCargoToRoutes(cargos, routes);
  const consolidations = findConsolidationOpportunities(cargos, routes);
  const utilization = routes.length ? Math.round(routes.reduce((sum, route) => sum + ((route.totalCapacity - route.availableCapacity) / route.totalCapacity) * 100, 0) / routes.length) : 0;
  const estimatedSavings = Math.round(matches.reduce((sum, match) => sum + match.estimatedSavings, 0) + consolidations.reduce((sum, opportunity) => sum + opportunity.savings, 0));
  const distanceOptimized = Math.round(matches.reduce((sum, match) => sum + match.route.distanceKm * 0.08, 0));
  const score = Math.min(100, Math.round((utilization + (matches[0]?.score ?? 0) + (consolidations.length ? 88 : 70) + (bookings.length ? 90 : 75)) / 4));
  return {
    estimatedSavings,
    vehicleUtilization: utilization,
    cargoConsolidated: consolidations.reduce((sum, opportunity) => sum + opportunity.cargoes.length, 0),
    distanceOptimized,
    timeSaved: matches.length ? Math.max(1, Math.round(matches.length * 0.7)) : 0,
    score,
    breakdown: { capacity: utilization, cost: Math.min(100, 76 + matches.length * 2), route: matches[0]?.score ?? 0, delivery: matches.length ? 90 : 70 },
  };
}

export function calculateWhatIf(route: Route | undefined, weight: number, budget: number): WhatIfResult {
  const currentCost = route?.price ?? budget;
  const utilization = route && route.totalCapacity > 0 ? Math.round((weight / route.totalCapacity) * 100) : 0;
  const optimizedCost = Math.max(0, Math.round(currentCost * (weight > 0 && route ? Math.max(0.72, 1 - Math.min(0.2, weight / route.totalCapacity / 5)) : 1)));
  const currentDays = route ? Math.max(1, Math.ceil((new Date(route.eta).getTime() - new Date(route.departure).getTime()) / 86_400_000)) : 3;
  return {
    currentCost,
    optimizedCost,
    currentDays,
    optimizedDays: currentDays,
    currentUtilization: utilization,
    optimizedUtilization: Math.min(100, Math.round(utilization + 18)),
    savings: Math.max(0, currentCost - optimizedCost),
  };
}
