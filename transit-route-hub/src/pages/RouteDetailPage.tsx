import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Star, CheckCircle2, Calendar, MapPin, Package, Wallet } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { RouteMap } from '../components/ui/RouteMap';
import { Drawer } from '../components/ui/Drawer';
import { Input } from '../components/ui/Input';
import { toast } from '../components/ui/Toast';
import { routeService, cargoService, bookingService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { formatINR, formatDate } from '../utils/format';
import { isPositiveNumber, isValidDate } from '../utils/validation';
import type { Cargo, Route } from '../types';

export function RouteDetailPage() {
  const { id = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const route = routeService.get(id);
  const alternatives = useMemo(() => routeService.list().filter((r) => r.id !== id).slice(0, 3), [id]);
  const [bookingOpen, setBookingOpen] = useState(search.get('book') === '1');
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState<{ bookingId: string; shipmentId: string } | null>(null);

  useEffect(() => {
    if (search.get('book') === '1' && route) setBookingOpen(true);
  }, [search, route]);

  if (!route) {
    return (
      <div>
        <PageHeader title="Route not found" subtitle="This route may have been removed." />
        <Link to="/find-space"><Button>Back to search</Button></Link>
      </div>
    );
  }

  function handleConfirm(payload: { cargo: Cargo }) {
    if (!user) return;
    setConfirming(true);
    setTimeout(() => {
      try {
        const { booking, shipment } = bookingService.create(payload.cargo, route!, user.id);
        setSuccess({ bookingId: booking.id, shipmentId: shipment.id });
        toast({ type: 'success', title: 'Booking confirmed', body: booking.id });
      } catch (error) {
        toast({
          type: 'error',
          title: 'Booking unavailable',
          body: error instanceof Error ? error.message : 'Please choose another route.',
        });
      } finally {
        setConfirming(false);
      }
    }, 800);
  }

  return (
    <div>
      <Link to="/find-space" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-navy mb-3">
        <ArrowLeft size={14} /> Back to search
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <span className="trh-pill bg-teal/10 text-teal border border-teal/20 mb-2 inline-flex">
            {route.matchScore}% MATCH
          </span>
          <h1 className="text-2xl md:text-3xl font-semibold text-navy tracking-tight">
            {route.origin} → {route.destination}
          </h1>
          <p className="text-sm text-muted mt-1">{route.operatorName} · {route.vehicleType} · {route.distanceKm} km</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/find-space')}>Compare</Button>
          <Button variant="primary" onClick={() => setBookingOpen(true)}>Book Cargo Space</Button>
        </div>
      </div>

      <Card className="overflow-hidden mb-5">
        <RouteMap
          origin={route.origin}
          destination={route.destination}
          stops={route.stops.slice(1, -1)}
          distanceKm={route.distanceKm}
          eta={route.eta}
          capacity={`${route.availableCapacity} t available`}
        />
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat icon={Wallet} label="Estimated Cost" value={formatINR(route.price)} />
        <Stat icon={Package} label="Available Capacity" value={`${route.availableCapacity} t`} />
        <Stat icon={Calendar} label="Departure" value={formatDate(route.departure)} />
        <Stat icon={MapPin} label="ETA" value={formatDate(route.eta)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-1">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="trh-section-title">Operator</h3>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-deepNavy text-white flex items-center justify-center font-semibold">
                {route.operatorName.split(' ').map((n) => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <p className="font-semibold text-navy">{route.operatorName}</p>
                <p className="text-xs text-muted flex items-center gap-1">
                  <Star size={12} className="text-warning fill-warning" /> {route.operatorRating} · {route.operatorCompletedShipments} shipments
                </p>
              </div>
            </div>
            <div className="mt-4 text-sm text-muted">Verified operator with consistent on-time delivery performance.</div>
            <Button variant="secondary" block className="mt-5">View Operator Profile</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="trh-section-title">Cost Comparison</h3>
          </div>
          <div className="p-5 space-y-3">
            <CompareRow title={route.operatorName} subtitle={`${route.origin} → ${route.destination}`} price={route.price} eta={route.eta} capacity={`${route.availableCapacity} t`} match={route.matchScore} highlight />
            {alternatives.map((alt) => (
              <CompareRow
                key={alt.id}
                title={alt.operatorName}
                subtitle={`${alt.origin} → ${alt.destination}`}
                price={alt.price}
                eta={alt.eta}
                capacity={`${alt.availableCapacity} t`}
                match={alt.matchScore}
                onView={() => navigate(`/routes/${alt.id}`)}
              />
            ))}
          </div>
        </Card>
      </div>

      <Drawer open={bookingOpen} onClose={() => { setBookingOpen(false); setSuccess(null); }} title="Confirm Booking" width="md">
        <AnimatePresence mode="wait">
          {!success ? (
            <BookingForm
              route={route}
              initialWeight={search.get('weight') ?? ''}
              initialCargoType={search.get('cargoType') ?? 'General'}
              initialPickupDate={search.get('date') ?? route.departure.slice(0, 10)}
              onConfirm={handleConfirm}
              loading={confirming}
            />
          ) : (
            <BookingSuccess
              bookingId={success.bookingId}
              shipmentId={success.shipmentId}
              onClose={() => { setBookingOpen(false); setSuccess(null); navigate(`/shipments/${success.shipmentId}`); }}
            />
          )}
        </AnimatePresence>
      </Drawer>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted text-xs">
        <Icon size={14} />
        {label}
      </div>
      <div className="text-lg font-semibold text-navy mt-1.5">{value}</div>
    </Card>
  );
}

function CompareRow({
  title, subtitle, price, eta, capacity, match, highlight, onView,
}: {
  title: string;
  subtitle: string;
  price: number;
  eta: string;
  capacity: string;
  match: number;
  highlight?: boolean;
  onView?: () => void;
}) {
  return (
    <div className={`p-4 rounded-md border ${highlight ? 'border-teal/40 bg-teal/5' : 'border-border'} flex items-center justify-between gap-3 flex-wrap`}>
      <div>
        <p className="font-semibold text-navy text-sm">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-5 text-sm">
        <div><span className="text-xs text-muted">Match</span><div className="font-semibold text-teal">{match}%</div></div>
        <div><span className="text-xs text-muted">ETA</span><div className="font-semibold text-navy">{formatDate(eta, false)}</div></div>
        <div><span className="text-xs text-muted">Capacity</span><div className="font-semibold text-navy">{capacity}</div></div>
        <div><span className="text-xs text-muted">Price</span><div className="font-semibold text-navy">{formatINR(price)}</div></div>
        {onView && <Button size="sm" variant="secondary" onClick={onView}>View</Button>}
      </div>
    </div>
  );
}

interface FormState {
  weight: string;
  cargoType: string;
  pickupDate: string;
  description: string;
}

function BookingForm({
  route,
  initialWeight,
  initialCargoType,
  initialPickupDate,
  onConfirm,
  loading,
}: {
  route: Route;
  initialWeight?: string;
  initialCargoType?: string;
  initialPickupDate?: string;
  onConfirm: (payload: { cargo: Cargo }) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormState>({
    weight: initialWeight ?? '',
    cargoType: initialCargoType ?? 'General',
    pickupDate: initialPickupDate ?? route.departure.slice(0, 10),
    description: '',
  });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = Number(form.weight);
    if (!isPositiveNumber(w)) return setError('Enter a valid cargo weight.');
    if (w > route.availableCapacity) return setError(`Capacity available is ${route.availableCapacity} t.`);
    if (!isValidDate(form.pickupDate)) return setError('Pick a valid pickup date.');
    setError(null);
    const cargo: Cargo = {
      id: 'tmp',
      ownerId: 'tmp',
      type: form.cargoType as Cargo['type'],
      description: form.description || 'Quick booking',
      weight: w,
      dimensions: { length: 100, width: 100, height: 100 },
      quantity: 1,
      fragile: false,
      hazardous: false,
      origin: route.origin,
      destination: route.destination,
      pickupDate: new Date(form.pickupDate).toISOString(),
      deliveryDate: route.eta,
      budget: route.price,
      status: 'Searching',
      createdAt: new Date().toISOString(),
    };
    const saved = cargoService.add(cargo);
    onConfirm({ cargo: saved });
  }

  return (
    <motion.form
      key="form"
      onSubmit={handleSubmit}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      <Card className="p-4 bg-background/60">
        <div className="text-xs text-muted">Route</div>
        <div className="font-semibold text-navy">{route.origin} → {route.destination}</div>
        <div className="text-xs text-muted mt-1">{formatDate(route.departure)} · {formatINR(route.price)}</div>
      </Card>

      <Input
        id="weight"
        type="number"
        step="0.1"
        min="0.1"
        max={route.availableCapacity}
        label={`Cargo Weight (t) — max ${route.availableCapacity} t`}
        value={form.weight}
        onChange={(e) => setForm({ ...form, weight: e.target.value })}
      />
      <div>
        <label htmlFor="ctype" className="trh-label">Cargo Type</label>
        <select
          id="ctype"
          title="Cargo Type"
          aria-label="Cargo Type"
          className="trh-input"
          value={form.cargoType}
          onChange={(e) => setForm({ ...form, cargoType: e.target.value })}
        >
          {['General', 'Fragile', 'Refrigerated', 'Hazardous', 'Bulk', 'Liquid'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      <Input
        id="pdate"
        type="date"
        label="Pickup Date"
        value={form.pickupDate}
        onChange={(e) => setForm({ ...form, pickupDate: e.target.value })}
      />
      <Input
        id="desc"
        label="Cargo Description (optional)"
        placeholder="e.g. Palletized FMCG"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />

      {error && (
        <div className="text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>
      )}

      <div className="flex items-center justify-between pt-2">
        <span className="text-sm text-muted">Total: <b className="text-navy">{formatINR(route.price)}</b></span>
        <Button type="submit" variant="primary" loading={loading}>
          <CheckCircle2 size={16} /> Confirm Booking
        </Button>
      </div>
    </motion.form>
  );
}

function BookingSuccess({
  bookingId,
  shipmentId,
  onClose,
}: {
  bookingId: string;
  shipmentId: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      key="success"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-6"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
        className="mx-auto h-16 w-16 rounded-full bg-success/15 text-success flex items-center justify-center"
      >
        <CheckCircle2 size={36} />
      </motion.div>
      <h3 className="mt-4 text-xl font-semibold text-navy">Shipment Confirmed</h3>
      <p className="text-sm text-muted mt-1">Booking ID</p>
      <p className="font-mono text-base text-navy mt-1">{bookingId}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Link to={`/shipments/${shipmentId}`}><Button block>View Shipment</Button></Link>
        <Button block variant="secondary" onClick={onClose}>Return to Dashboard</Button>
      </div>
    </motion.div>
  );
}