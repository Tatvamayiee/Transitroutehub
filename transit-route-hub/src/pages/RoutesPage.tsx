import { useMemo, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { RouteCard } from '../components/ui/RouteCard';
import { routeService } from '../services/dataService';

export function RoutesPage() {
  const routes = routeService.list();
  const [query, setQuery] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => routes.filter((r) => {
    const q = query.toLowerCase();
    if (q && !`${r.origin} ${r.destination} ${r.operatorName}`.toLowerCase().includes(q)) return false;
    if (vehicle && r.vehicleType !== vehicle) return false;
    if (mode && (r.transportMode ?? 'ROAD') !== mode) return false;
    if (status && r.status !== status) return false;
    return true;
  }), [routes, query, vehicle, status]);

  return (
    <div>
      <PageHeader
        title="Available Routes"
        subtitle="All published transport routes with live capacity."
      />

      <Card className="p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search routes…"
            className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <Filter size={14} className="text-muted" />
          <select aria-label="Filter by vehicle" className="trh-input !py-2" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="">All Vehicles</option>
            {['Mini Truck', 'Truck', 'Trailer', 'Container', 'Tanker'].map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
          <select aria-label="Filter by route status" className="trh-input !py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {['Active', 'Full', 'Completed'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select aria-label="Filter by transport mode" title="Transport mode" className="trh-input !py-2" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="">All Modes</option>
            <option value="ROAD">Road</option>
            <option value="RAIL">Rail</option>
            <option value="AIR">Air</option>
            <option value="SEA">Sea</option>
            <option value="MULTIMODAL">Multimodal</option>
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((r, i) => (
          <RouteCard key={r.id} route={r} index={i} />
        ))}
      </div>
    </div>
  );
}