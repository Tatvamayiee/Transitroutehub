import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Truck, Calendar, ArrowRight, Filter } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { shipmentService, routeService } from '../services/dataService';
import { formatDate } from '../utils/format';
import type { ShipmentStatus } from '../types';

const STATUSES: (ShipmentStatus | 'All')[] = ['All', 'Searching', 'Matched', 'Booked', 'In Transit', 'Delivered', 'Cancelled'];

export function ShipmentsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ShipmentStatus | 'All'>('All');
  const [query, setQuery] = useState('');
  const shipments = shipmentService.list(user?.id);
  const routes = useMemo(() => routeService.list(), []);

  const filtered = shipments.filter((s) => {
    const r = routes.find((rt) => rt.id === s.routeId);
    const text = `${s.id} ${r?.origin ?? ''} ${r?.destination ?? ''}`.toLowerCase();
    if (status !== 'All' && s.status !== status) return false;
    if (query && !text.includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="My Shipments"
        subtitle="Track and manage every shipment end-to-end."
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by shipment ID or city…"
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-muted" />
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${status === s ? 'bg-teal text-white border-teal' : 'bg-white text-navy border-border hover:bg-background'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Truck size={26} />}
            title="No shipments to show."
            description="Once you book cargo space, your shipments appear here."
            action={<Link to="/find-space"><Button>Find Cargo Space</Button></Link>}
          />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-background text-muted text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-6 py-3">Shipment ID</th>
                  <th className="text-left px-6 py-3">Route</th>
                  <th className="text-left px-6 py-3">Operator</th>
                  <th className="text-left px-6 py-3">Departure</th>
                  <th className="text-left px-6 py-3">ETA</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-right px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const r = routes.find((rt) => rt.id === s.routeId);
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-t border-border hover:bg-background/50"
                    >
                      <td className="px-6 py-3 font-mono text-navy">{s.id}</td>
                      <td className="px-6 py-3">{r ? `${r.origin} → ${r.destination}` : '—'}</td>
                      <td className="px-6 py-3">{r?.operatorName ?? '—'}</td>
                      <td className="px-6 py-3 text-muted">{r ? formatDate(r.departure, false) : '—'}</td>
                      <td className="px-6 py-3 text-muted">{formatDate(s.estimatedArrival, false)}</td>
                      <td className="px-6 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-6 py-3 text-right">
                        <Link to={`/shipments/${s.id}`} className="text-teal font-semibold hover:underline text-sm">Details <ArrowRight size={12} className="inline" /></Link>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((s) => {
              const r = routes.find((rt) => rt.id === s.routeId);
              return (
                <Link key={s.id} to={`/shipments/${s.id}`}>
                  <Card className="p-4 hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-sm text-navy">{s.id}</div>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="mt-1 text-sm font-semibold text-navy">{r ? `${r.origin} → ${r.destination}` : '—'}</div>
                    <div className="text-xs text-muted mt-1">{r?.operatorName}</div>
                    <div className="text-xs text-muted mt-2 flex items-center gap-2">
                      <Calendar size={12} /> ETA {formatDate(s.estimatedArrival, false)}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}