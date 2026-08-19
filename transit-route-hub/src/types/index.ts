export type UserRole = 'CARGO_OWNER' | 'BOOKER' | 'INTERMEDIARY' | 'TRANSPORT_OPERATOR' | 'ADMIN';
export type CargoPartyType = 'IMPORTER' | 'EXPORTER';

export type Capability =
  | 'POST_CARGO'
  | 'FIND_SPACE'
  | 'BOOK'
  | 'TRACK'
  | 'MATCH'
  | 'POST_CAPACITY'
  | 'MANAGE_ROUTES'
  | 'UPDATE_SHIPMENT'
  | 'VIEW_ANALYTICS'
  | 'OPTIMIZE';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  cargoPartyType?: CargoPartyType;
  capabilities?: Capability[];
  passwordHash: string;
  createdAt: string;
  companyName?: string;
}

export type CargoType = 'General' | 'Fragile' | 'Refrigerated' | 'Hazardous' | 'Bulk' | 'Liquid';

export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export type CargoStatus = 'Posted' | 'Searching' | 'Matched' | 'Booked' | 'Cancelled';

export interface Cargo {
  id: string;
  ownerId: string;
  type: CargoType;
  description: string;
  weight: number;
  dimensions: Dimensions;
  quantity: number;
  fragile: boolean;
  hazardous: boolean;
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  budget: number;
  vehiclePreference?: string;
  specialRequirements?: string;
  status: CargoStatus;
  createdAt: string;
}

export type VehicleType = 'Mini Truck' | 'Truck' | 'Trailer' | 'Container' | 'Tanker';
export type TransportMode = 'ROAD' | 'RAIL' | 'AIR' | 'SEA' | 'MULTIMODAL';

export interface Route {
  id: string;
  operatorId: string;
  operatorName: string;
  operatorRating: number;
  operatorCompletedShipments: number;
  origin: string;
  destination: string;
  departure: string;
  eta: string;
  distanceKm: number;
  availableCapacity: number;
  totalCapacity: number;
  vehicleType: VehicleType;
  transportMode?: TransportMode;
  supportedCargoTypes?: CargoType[];
  price: number;
  status: 'Active' | 'Full' | 'Completed';
  matchScore: number;
  stops: string[];
  createdAt: string;
}

export type BookingStatus = 'Confirmed' | 'Pending' | 'Cancelled';

export interface Booking {
  id: string;
  cargoId: string;
  routeId: string;
  userId: string;
  price: number;
  status: BookingStatus;
  createdAt: string;
}

export type ShipmentStatus =
  | 'Searching'
  | 'Matched'
  | 'Booked'
  | 'Pickup Scheduled'
  | 'Picked Up'
  | 'In Transit'
  | 'Delivered'
  | 'Cancelled';

export interface TimelineEntry {
  status: ShipmentStatus;
  at: string;
  note?: string;
  completed: boolean;
  active: boolean;
}

export interface Shipment {
  id: string;
  bookingId: string;
  cargoId: string;
  routeId: string;
  userId: string;
  status: ShipmentStatus;
  timeline: TimelineEntry[];
  estimatedArrival: string;
  createdAt: string;
}

export type NotificationType = 'match' | 'booking' | 'shipment' | 'route' | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  shipmentUpdates: boolean;
  routeMatches: boolean;
  darkMode: boolean;
  currency: 'INR' | 'USD';
}

export interface SessionInfo {
  userId: string;
  issuedAt: string;
  expiresAt: string;
}
