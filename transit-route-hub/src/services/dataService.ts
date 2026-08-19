import { storageService } from './storageService';
import { shortId } from '../utils/format';
import type { Booking, Cargo, CargoType, Route, Shipment, ShipmentStatus, TimelineEntry, AppNotification, TransportMode } from '../types';

const SHIPMENT_FLOW: ShipmentStatus[] = [
  'Searching',
  'Matched',
  'Booked',
  'Pickup Scheduled',
  'Picked Up',
  'In Transit',
  'Delivered',
];

export const cargoService = {
  list(userId?: string): Cargo[] {
    const all = storageService.getCargo();
    if (!userId) return all;
    return all.filter((c) => c.ownerId === userId);
  },
  get(id: string): Cargo | undefined {
    return storageService.getCargo().find((c) => c.id === id);
  },
  add(cargo: Omit<Cargo, 'id' | 'createdAt' | 'status'>): Cargo {
    const newCargo: Cargo = {
      ...cargo,
      id: shortId('CG'),
      status: 'Searching',
      createdAt: new Date().toISOString(),
    };
    storageService.addCargo(newCargo);
    return newCargo;
  },
};

export const routeService = {
  list(): Route[] {
    return storageService.getRoutes().map((route) => ({ ...route, transportMode: route.transportMode ?? 'ROAD' }));
  },
  get(id: string): Route | undefined {
    return this.list().find((route) => route.id === id);
  },
  search(opts: {
    origin?: string;
    destination?: string;
    departureDate?: string;
    weight?: number;
    cargoType?: string;
    vehicleType?: string;
    transportMode?: TransportMode;
  }): Route[] {
    const all = this.list();
    return all
      .filter((r) => r.status === 'Active')
      .filter((r) => !opts.origin || r.origin.toLowerCase().includes(opts.origin.toLowerCase()))
      .filter((r) => !opts.destination || r.destination.toLowerCase().includes(opts.destination.toLowerCase()))
      .filter((r) => !opts.departureDate || r.departure.slice(0, 10) === opts.departureDate)
      .filter((r) => !opts.weight || opts.weight <= r.availableCapacity)
      .filter((r) => !opts.cargoType || !r.supportedCargoTypes || r.supportedCargoTypes.includes(opts.cargoType as CargoType))
      .filter((r) => !opts.vehicleType || r.vehicleType === opts.vehicleType)
      .filter((r) => !opts.transportMode || (r.transportMode ?? 'ROAD') === opts.transportMode)
      .map((r) => ({
        route: r,
        score: computeMatchScore(r, opts),
      }))
      .filter((x) => x.score >= 50)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.route);
  },
};

function computeMatchScore(route: Route, opts: { origin?: string; destination?: string; departureDate?: string; weight?: number; cargoType?: string; vehicleType?: string }): number {
  let score = route.matchScore;
  if (opts.origin && route.origin.toLowerCase().includes(opts.origin.toLowerCase())) score += 2;
  if (opts.destination && route.destination.toLowerCase().includes(opts.destination.toLowerCase())) score += 2;
  if (opts.weight && opts.weight > 0) {
    if (opts.weight <= route.availableCapacity) score += 2;
  }
  if (opts.vehicleType && route.vehicleType === opts.vehicleType) score += 2;
  return Math.max(0, Math.min(100, score));
}

export const bookingService = {
  create(cargo: Cargo, route: Route, userId: string): { booking: Booking; shipment: Shipment; notification: AppNotification } {
    const currentRoute = storageService.getRouteById(route.id);
    if (!currentRoute || currentRoute.status !== 'Active') {
      throw new Error('This route is no longer available. Please choose another route.');
    }
    if (storageService.getBookings().some((booking) => booking.cargoId === cargo.id && booking.status !== 'Cancelled')) {
      throw new Error('This cargo already has an active booking.');
    }
    if (cargo.weight > currentRoute.availableCapacity) {
      throw new Error(`Only ${currentRoute.availableCapacity} t remains on this route.`);
    }
    const now = new Date().toISOString();
    const booking: Booking = {
      id: shortId('TRH'),
      cargoId: cargo.id,
      routeId: route.id,
      userId,
      price: currentRoute.price,
      status: 'Confirmed',
      createdAt: now,
    };
    storageService.addBooking(booking);

    const shipment: Shipment = {
      id: shortId('SH'),
      bookingId: booking.id,
      cargoId: cargo.id,
      routeId: route.id,
      userId,
      status: 'Booked',
      estimatedArrival: currentRoute.eta,
      createdAt: now,
      timeline: buildTimeline(booking.createdAt, route.eta),
    };
    storageService.addShipment(shipment);

    const updatedCargo: Cargo = { ...cargo, status: 'Booked' };
    storageService.saveCargo(
      storageService.getCargo().map((c) => (c.id === cargo.id ? updatedCargo : c)),
    );

    const remainingCapacity = currentRoute.availableCapacity - cargo.weight;
    storageService.saveRoutes(
      storageService.getRoutes().map((r) =>
        r.id === currentRoute.id
          ? { ...r, availableCapacity: remainingCapacity, status: remainingCapacity <= 0 ? 'Full' : r.status }
          : r,
      ),
    );

    const notification: AppNotification = {
      id: shortId('N'),
      userId,
      type: 'booking',
      title: 'Booking confirmed',
      body: `${booking.id} has been confirmed with ${route.operatorName}.`,
      read: false,
      createdAt: now,
    };
    storageService.addNotification(notification);

    return { booking, shipment, notification };
  },

  cancel(bookingId: string): void {
    const bookings = storageService.getBookings();
    const i = bookings.findIndex((b) => b.id === bookingId);
    if (i < 0) return;
    bookings[i] = { ...bookings[i], status: 'Cancelled' };
    storageService.saveBookings(bookings);
    const shipment = storageService.getShipments().find((s) => s.bookingId === bookingId);
    if (shipment) {
      storageService.saveShipments(
        storageService.getShipments().map((s) =>
          s.id === shipment.id ? { ...s, status: 'Cancelled' } : s,
        ),
      );
    }
  },
};

function buildTimeline(start: string, eta: string): TimelineEntry[] {
  const startTime = new Date(start).getTime();
  const etaTime = new Date(eta).getTime();
  const span = Math.max(etaTime - startTime, 60 * 60 * 1000);
  const step = span / (SHIPMENT_FLOW.length - 1);
  return SHIPMENT_FLOW.map((status, idx) => {
    const at = new Date(startTime + step * idx).toISOString();
    const completed = idx <= 3;
    const active = idx === 4;
    return {
      status,
      at,
      note: noteFor(status),
      completed,
      active,
    };
  });
}

function noteFor(status: ShipmentStatus): string {
  switch (status) {
    case 'Searching':
      return 'Cargo posted';
    case 'Matched':
      return 'Route matched';
    case 'Booked':
      return 'Booking confirmed';
    case 'Pickup Scheduled':
      return 'Pickup scheduled';
    case 'Picked Up':
      return 'Cargo picked up';
    case 'In Transit':
      return 'En route to destination';
    case 'Delivered':
      return 'Shipment delivered';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}

export const shipmentService = {
  list(userId?: string): Shipment[] {
    const all = storageService.getShipments();
    if (!userId) return all;
    return all.filter((s) => s.userId === userId);
  },
  get(id: string): Shipment | undefined {
    return storageService.getShipmentById(id);
  },
  advanceStatus(id: string): void {
    const shipments = storageService.getShipments();
    const i = shipments.findIndex((s) => s.id === id);
    if (i < 0) return;
    const current = shipments[i];
    const order = SHIPMENT_FLOW;
    const idx = order.indexOf(current.status);
    if (idx < 0 || idx >= order.length - 1) return;
    const nextStatus = order[idx + 1];
    const timeline = current.timeline.map((t, k) => {
      if (k === idx) return { ...t, completed: true, active: false };
      if (k === idx + 1) return { ...t, completed: false, active: true, at: new Date().toISOString() };
      return t;
    });
    shipments[i] = { ...current, status: nextStatus, timeline };
    storageService.saveShipments(shipments);
  },
};
