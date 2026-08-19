import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, Package, MapPin, Wallet, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { RouteMap } from '../components/ui/RouteMap';
import { shipmentService, routeService, cargoService } from '../services/dataService';
import { formatDate, formatINR } from '../utils/format';

export function ShipmentDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const shipment = shipmentService.get(id);
  if (!shipment) {
    return (
      <div>
        <PageHeader title="Shipment not found" />
        <Link to="/shipments"><Button>Back</Button></Link>
      </div>
    );
  }
  const route = routeService.get(shipment.routeId);
  const cargo = cargoService.get(shipment.cargoId);

  function advance() {
    shipmentService.advanceStatus(shipment!.id);
    window.location.reload();
  }

  return (
    <div>
      <Link to="/shipments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-navy mb-3">
        <ArrowLeft size={14} /> Back to shipments
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs text-muted">Shipment</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-navy tracking-tight">{shipment.id}</h1>
          <p className="text-sm text-muted mt-1">{route ? `${route.origin} → ${route.destination}` : '—'}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={shipment.status} />
          {shipment.status !== 'Delivered' && shipment.status !== 'Cancelled' && (
            <Button variant="secondary" size="sm" onClick={advance}>Advance Status</Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/shipments')}>All Shipments</Button>
        </div>
      </div>

      <Card className="overflow-hidden mb-5">
        {route && (
          <RouteMap
            origin={route.origin}
            destination={route.destination}
            stops={route.stops.slice(1, -1)}
            distanceKm={route.distanceKm}
            eta={shipment.estimatedArrival}
            capacity={`${route.availableCapacity} t`}
          />
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="trh-section-title">Shipment Timeline</h3>
            </div>
            <div className="p-5">
              <div className="space-y-4" role="region" aria-label="Shipment progress">
                {shipment.timeline.map((t, idx) => (
                  <motion.div
                    key={t.status}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                          t.completed
                            ? 'bg-success/15 text-success'
                            : t.active
                            ? 'bg-orange/15 text-orange ring-4 ring-orange/10'
                            : 'bg-border text-muted'
                        }`}
                        aria-label={t.status}
                      >
                        {t.completed ? '✓' : t.active ? '•' : (idx + 1)}
                      </div>
                      {idx < shipment.timeline.length - 1 && (
                        <div className={`w-0.5 flex-1 mt-1 ${t.completed ? 'bg-success/40' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={`font-semibold text-sm ${t.active ? 'text-orange' : 'text-navy'}`}>{t.status}</p>
                      {t.note && <p className="text-xs text-muted mt-0.5">{t.note}</p>}
                      {t.at && <p className="text-[11px] text-muted mt-0.5">{formatDate(t.at)}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="trh-section-title">Cargo Information</h3>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <Row icon={Package} label="Type" value={cargo?.type ?? '—'} />
              <Row icon={Package} label="Weight" value={cargo ? `${cargo.weight} t` : '—'} />
              <Row icon={Package} label="Quantity" value={String(cargo?.quantity ?? '—')} />
              <Row icon={MapPin} label="Route" value={route ? `${route.origin} → ${route.destination}` : '—'} />
            </div>
          </Card>
          <Card>
            <div className="px-5 py-4 border-b border-border">
              <h3 className="trh-section-title">Operator</h3>
            </div>
            <div className="p-5 space-y-2 text-sm">
              <p className="font-semibold text-navy">{route?.operatorName ?? '—'}</p>
              <Row icon={Truck} label="Vehicle" value={route?.vehicleType ?? '—'} />
              <Row icon={Calendar} label="Departure" value={route ? formatDate(route.departure) : '—'} />
              <Row icon={Wallet} label="Cost" value={route ? formatINR(route.price) : '—'} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted text-xs">
        <Icon size={12} /> {label}
      </div>
      <div className="font-medium text-navy">{value}</div>
    </div>
  );
}