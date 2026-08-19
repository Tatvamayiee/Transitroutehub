import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, CheckCircle2, MapPin, Package, Route as RouteIcon, Truck, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { toast } from '../components/ui/Toast';
import { bookingService, cargoService, routeService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatINR } from '../utils/format';
import type { Cargo, Route } from '../types';

export function MatchingCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cargos = cargoService.list().filter((cargo) => cargo.status !== 'Cancelled');
  const routes = routeService.list().filter((route) => route.status === 'Active');
  const [cargoId, setCargoId] = useState(cargos[0]?.id ?? '');
  const [routeId, setRouteId] = useState(routes[0]?.id ?? '');
  const [matching, setMatching] = useState(false);
  const selectedCargo = cargos.find((cargo) => cargo.id === cargoId) ?? cargos[0];
  const selectedRoute = routes.find((route) => route.id === routeId) ?? routes[0];
  const compatibleRoutes = useMemo(() => selectedCargo ? routes.filter((route) => route.origin === selectedCargo.origin && route.destination === selectedCargo.destination && route.availableCapacity >= selectedCargo.weight) : routes, [routes, selectedCargo]);
  const compatible = Boolean(selectedCargo && selectedRoute && selectedRoute.availableCapacity >= selectedCargo.weight);

  function createMatch() {
    if (!selectedCargo || !selectedRoute || !user || !compatible) return;
    setMatching(true);
    window.setTimeout(() => {
      try {
        const { id: _sourceId, status: _sourceStatus, createdAt: _sourceCreatedAt, ...cargoInput } = selectedCargo;
        const cargo: Cargo = cargoService.add({ ...cargoInput, ownerId: user.id });
        const result = bookingService.create(cargo, selectedRoute, user.id);
        toast({ type: 'success', title: 'Compatibility match created', body: `${result.booking.id} is now tracking.` });
        navigate(`/shipments/${result.shipment.id}`);
      } catch (error) {
        toast({ type: 'error', title: 'Match could not be created', body: error instanceof Error ? error.message : 'Try another route.' });
      } finally {
        setMatching(false);
      }
    }, 500);
  }

  return (
    <div>
      <PageHeader title="Matching Center" subtitle="Connect cargo demand with available transportation capacity." />

      <div className="grid gap-5 xl:grid-cols-[1fr_auto_1fr] items-stretch">
        <RequestPanel cargos={cargos} selected={selectedCargo} onSelect={(id) => setCargoId(id)} />
        <div className="flex flex-col items-center justify-center gap-3 py-2 text-center">
          <motion.div
            animate={matching ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.6, repeat: matching ? Infinity : 0 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white shadow-lg shadow-teal/20"
          >
            <Zap size={26} />
          </motion.div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal">Smart Match</p>
            <p className="mt-1 text-3xl font-semibold text-navy">{compatible ? '98%' : '—'}</p>
            <p className="text-xs text-muted">Compatibility score</p>
          </div>
          <motion.div animate={compatible ? { opacity: [0.35, 1, 0.35] } : { opacity: 0.2 }} transition={{ duration: 1.4, repeat: Infinity }} className="hidden h-20 w-px bg-teal xl:block" />
          <ArrowDown className="text-teal xl:hidden" size={20} />
        </div>
        <CapacityPanel routes={compatibleRoutes.length ? compatibleRoutes : routes} selected={selectedRoute} onSelect={(id) => setRouteId(id)} />
      </div>

      <Card className="mt-5 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Match summary</p>
            <p className="mt-1 text-sm text-navy">{selectedCargo?.origin ?? 'Origin'} → {selectedCargo?.destination ?? 'Destination'} · {selectedCargo?.weight ?? 0} tons requested</p>
            <p className="mt-1 text-xs text-muted">Rule-based compatibility using route, capacity and timing data. Demo mode.</p>
          </div>
          <Button onClick={createMatch} disabled={!compatible || matching} loading={matching}>
            <CheckCircle2 size={16} /> Create Match
          </Button>
        </div>
      </Card>
    </div>
  );
}

function RequestPanel({ cargos, selected, onSelect }: { cargos: Cargo[]; selected?: Cargo; onSelect: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4"><p className="text-xs uppercase tracking-wider text-muted">Demand</p><h2 className="mt-1 text-lg font-semibold text-navy">Cargo Requests</h2></div>
      <div className="space-y-3 p-4">
        {cargos.slice(0, 5).map((cargo) => (
          <button key={cargo.id} type="button" onClick={() => onSelect(cargo.id)} className={`w-full rounded-sm border p-4 text-left transition ${selected?.id === cargo.id ? 'border-teal bg-teal/5 ring-2 ring-teal/10' : 'border-border hover:border-teal/40'}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-navy">{cargo.origin} → {cargo.destination}</span><StatusBadge status={cargo.status} /></div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted"><span className="flex items-center gap-1"><Package size={12} />{cargo.weight} tons</span><span className="flex items-center gap-1"><MapPin size={12} />Pickup {formatDate(cargo.pickupDate, false)}</span></div>
          </button>
        ))}
        {cargos.length === 0 && <p className="py-8 text-center text-sm text-muted">No cargo requests available.</p>}
      </div>
    </Card>
  );
}

function CapacityPanel({ routes, selected, onSelect }: { routes: Route[]; selected?: Route; onSelect: (id: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-5 py-4"><p className="text-xs uppercase tracking-wider text-muted">Supply</p><h2 className="mt-1 text-lg font-semibold text-navy">Available Capacity</h2></div>
      <div className="space-y-3 p-4">
        {routes.slice(0, 5).map((route) => (
          <button key={route.id} type="button" onClick={() => onSelect(route.id)} className={`w-full rounded-sm border p-4 text-left transition ${selected?.id === route.id ? 'border-teal bg-teal/5 ring-2 ring-teal/10' : 'border-border hover:border-teal/40'}`}>
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-navy">{route.origin} → {route.destination}</span><span className="text-xs font-semibold text-teal">{route.matchScore}%</span></div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted"><span className="flex items-center gap-1"><Truck size={12} />{route.availableCapacity} t available</span><span className="flex items-center gap-1"><RouteIcon size={12} />{route.vehicleType}</span></div>
            <div className="mt-2 text-xs text-muted">{formatINR(route.price)} · ETA {formatDate(route.eta, false)} · {route.operatorName}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}
