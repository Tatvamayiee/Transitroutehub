import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, Search, Package, Activity, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cargoService, routeService, shipmentService } from '../services/dataService';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { RouteMap } from '../components/ui/RouteMap';
import { formatINR, formatDate } from '../utils/format';

export function DashboardPage() {
  const { user } = useAuth();
  const routes = routeService.list();
  const shipments = shipmentService.list(user?.id);
  const ownedCargo = cargoService.list(user?.id);
  const greeting = greet();
  const role = user?.role ?? 'CARGO_OWNER';
  const isIntermediary = role === 'INTERMEDIARY';
  const isOperator = role === 'TRANSPORT_OPERATOR';
  const isBooker = role === 'BOOKER';
  const isImporter = user?.cargoPartyType === 'IMPORTER';
  const isExporter = user?.cargoPartyType === 'EXPORTER';
  const primaryAction = isIntermediary ? '/delivery-desk' : isOperator ? '/routes' : isBooker ? '/find-space' : '/post-cargo';
  const primaryTitle = isIntermediary ? 'Open Delivery Desk' : isOperator ? 'Manage Available Space' : isBooker ? 'Find Cargo Space' : 'Post Cargo';

  return (
    <div>
      <PageHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] ?? 'there'} 👋`}
        subtitle={isIntermediary ? 'Connect cargo demand with available transportation capacity.' : isOperator ? 'Turn your available capacity into productive routes.' : isBooker ? 'Find and compare the right space for your next shipment.' : isImporter ? 'Bring your inbound cargo from port to destination with confidence.' : isExporter ? 'Move your outbound cargo from origin to its destination.' : 'Manage your cargo and find the best transportation options.'}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={isIntermediary ? 'Cargo Requests' : isOperator ? 'Available Capacity' : isBooker ? 'Available Routes' : 'Active Cargo'} value={`${isOperator ? routes.reduce((sum, route) => sum + route.availableCapacity, 0).toFixed(1) + ' t' : isBooker ? routes.length : isIntermediary ? routes.length : ownedCargo.filter((cargo) => cargo.status !== 'Cancelled' && cargo.status !== 'Booked').length}`} icon={isOperator ? Truck : Package} trend="+12%" trendUp accent="teal" hint="Last 7 days" />
        <StatCard label={isIntermediary ? 'Active Matches' : isOperator ? 'Active Routes' : isBooker ? 'Best Matches' : 'Matched Shipments'} value={`${shipments.filter((s) => s.status !== 'Delivered' && s.status !== 'Cancelled').length}`} icon={Activity} trend="+8%" trendUp accent="orange" />
        <StatCard label={isIntermediary ? 'Potential Savings' : isOperator ? 'Utilization' : isBooker ? 'Active Bookings' : 'In Transit'} value={isOperator ? '76%' : isBooker ? `${shipments.length}` : formatINR(84000)} icon={Search} trend="+18%" trendUp accent="cyan" />
        <StatCard label={isIntermediary ? 'Operators' : isOperator ? 'Cargo Matches' : isBooker ? 'Estimated Savings' : 'Delivered'} value={isOperator ? `${routes.length}` : isBooker ? formatINR(84000) : `${shipments.filter((s) => s.status === 'Delivered').length}`} icon={CheckCircle2} trend="+2%" trendUp accent="navy" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <QuickAction to={primaryAction} title={primaryTitle} description={isIntermediary ? 'Pick up, move, and deliver shipments.' : isOperator ? 'Manage your published space.' : isBooker ? 'Browse matching routes.' : 'Tell us your requirements.'} icon={isIntermediary ? Truck : isOperator ? Truck : isBooker ? Search : Package} variant="primary" />
        <QuickAction to={isOperator ? '/routes' : '/find-space'} title={isOperator ? 'Manage Available Space' : 'Find Cargo Space'} description="Compare capacity, price and ETA." icon={isOperator ? Truck : Search} variant="secondary" />
        <QuickAction to="/shipments" title="Track Shipment" description="Follow every journey." icon={Truck} variant="secondary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <Card>
            <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-border">
              <div>
                <h3 className="trh-section-title">{isIntermediary ? 'Operator Capacity' : isOperator ? 'Available Routes' : 'Recommended Cargo Space'}</h3>
                <p className="text-xs text-muted mt-0.5">Best matches based on your recent activity.</p>
              </div>
              <Link to={isIntermediary || isOperator ? '/routes' : '/find-space'} className="text-xs text-teal font-semibold hover:underline">View all</Link>
            </div>
            <div className="p-5 space-y-4">
              {routes.slice(0, 3).map((r, idx) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.06 }}
                  className="border border-border rounded-md p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="trh-pill bg-teal/10 text-teal border border-teal/20 mb-2 inline-flex">
                        {r.matchScore}% MATCH
                      </span>
                      <p className="text-base font-semibold text-navy mt-1">
                        {r.origin} <span className="text-muted mx-1">→</span> {r.destination}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-navy">{formatINR(r.price)}</div>
                      <div className="text-xs text-muted">{r.operatorName}</div>
                    </div>
                  </div>
                  <RouteMap
                    origin={r.origin}
                    destination={r.destination}
                    stops={r.stops.slice(1, -1)}
                    distanceKm={r.distanceKm}
                    eta={r.eta}
                    capacity={`${r.availableCapacity} t`}
                    compact
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span><b className="text-navy">{r.availableCapacity} t</b> available</span>
                      <span>{r.vehicleType}</span>
                      <span>{formatDate(r.departure)}</span>
                    </div>
                    <Link to={`/routes/${r.id}`}>
                      <Button size="sm" variant="secondary">View Route <ArrowRight size={14} /></Button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <h3 className="trh-section-title">Active Shipments</h3>
            </div>
            <div className="p-4 space-y-3">
              {shipments.length === 0 && (
                <p className="text-sm text-muted text-center py-6">No active shipments.</p>
              )}
              {shipments.slice(0, 4).map((s) => {
                const r = routes.find((rt) => rt.id === s.routeId);
                return (
                  <Link key={s.id} to={`/shipments/${s.id}`} className="block p-3 rounded-md hover:bg-background transition">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-navy">{s.id}</div>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="text-xs text-muted mt-1">{r ? `${r.origin} → ${r.destination}` : '—'}</div>
                    <div className="text-xs text-muted mt-0.5 flex items-center gap-1">
                      <Clock size={12} /> ETA {formatDate(s.estimatedArrival)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card>
            <div className="px-6 pt-5 pb-4 border-b border-border">
              <h3 className="trh-section-title">Recent Activity</h3>
            </div>
            <ul className="p-4 space-y-3 text-sm">
              {[
                { t: 'Booking confirmed', b: 'TRH-2026-00124 confirmed', at: new Date().toISOString() },
                { t: 'New route matched', b: '98% match on Chennai → Bengaluru', at: new Date(Date.now() - 3600 * 1000).toISOString() },
                { t: 'Shipment picked up', b: 'Cargo en route to destination', at: new Date(Date.now() - 7200 * 1000).toISOString() },
                { t: 'Cargo posted', b: 'Your latest cargo requirement is live', at: new Date(Date.now() - 86400 * 1000).toISOString() },
              ].map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-teal shrink-0" aria-hidden />
                  <div>
                    <p className="text-navy font-medium">{a.t}</p>
                    <p className="text-xs text-muted">{a.b}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {!isIntermediary && !isOperator && !isBooker && (
        <OwnerCargoQueue cargo={ownedCargo} />
      )}
    </div>
  );
}

function OwnerCargoQueue({ cargo }: { cargo: ReturnType<typeof cargoService.list> }) {
  return (
    <Card className="mt-5 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-5">
        <div>
          <h3 className="trh-section-title">My Cargo</h3>
          <p className="mt-0.5 text-xs text-muted">Your import/export requirements and their next step.</p>
        </div>
        <Link to="/post-cargo" className="text-xs font-semibold text-teal hover:underline">Post new cargo</Link>
      </div>
      <div className="grid gap-3 p-5 md:grid-cols-3">
        {cargo.slice(0, 3).map((item) => (
          <div key={item.id} className="rounded-sm border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted">{item.id}</span>
              <StatusBadge status={item.status} />
            </div>
            <p className="mt-3 text-sm font-semibold text-navy">{item.origin} → {item.destination}</p>
            <p className="mt-1 text-xs text-muted">{item.type} · {item.weight} t · Pickup {formatDate(item.pickupDate, false)}</p>
            <Link to={`/find-space?origin=${encodeURIComponent(item.origin)}&destination=${encodeURIComponent(item.destination)}&weight=${item.weight}&cargoType=${encodeURIComponent(item.type)}&date=${encodeURIComponent(item.pickupDate.slice(0, 10))}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal hover:underline">Find space <ArrowRight size={12} /></Link>
          </div>
        ))}
        {cargo.length === 0 && <div className="md:col-span-3"><p className="py-5 text-center text-sm text-muted">No cargo posted yet. Start by creating your first shipment requirement.</p></div>}
      </div>
    </Card>
  );
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function QuickAction({
  to, title, description, icon: Icon, variant,
}: {
  to: string;
  title: string;
  description: string;
  icon: typeof Search;
  variant: 'primary' | 'secondary';
}) {
  return (
    <Link to={to}>
      <motion.div whileHover={{ y: -3 }} className="trh-card p-5 flex items-center gap-4 hover:shadow-md transition">
        <div className={`h-12 w-12 rounded-md flex items-center justify-center ${variant === 'primary' ? 'bg-orange text-white' : 'bg-teal/10 text-teal'}`}>
          <Icon size={22} />
        </div>
        <div className="flex-1">
          <p className="text-base font-semibold text-navy">{title}</p>
          <p className="text-xs text-muted">{description}</p>
        </div>
        <ArrowRight size={18} className="text-muted" />
      </motion.div>
    </Link>
  );
}