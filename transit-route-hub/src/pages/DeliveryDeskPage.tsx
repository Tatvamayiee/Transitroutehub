import { useMemo } from 'react';
import { CalendarDays, CheckCircle2, ChevronRight, MapPin, Package, Phone, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/Feedback';
import { cargoService, routeService, shipmentService } from '../services/dataService';
import { formatDate, formatINR } from '../utils/format';
import type { Shipment } from '../types';

export function DeliveryDeskPage() {
  const shipments = shipmentService.list();
  const routes = routeService.list();
  const activeRuns = useMemo(() => shipments.filter((shipment) => shipment.status !== 'Delivered' && shipment.status !== 'Cancelled'), [shipments]);
  const delivered = shipments.filter((shipment) => shipment.status === 'Delivered').length;

  return (
    <div>
      <PageHeader title="Delivery Desk" subtitle="Pick up, move, and deliver every assigned shipment with confidence." actions={<span className="trh-pill border border-orange/20 bg-orange/10 text-orange"><Truck size={14} /> Connector mode</span>} />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <RunStat label="Active runs" value={String(activeRuns.length)} icon={Truck} />
        <RunStat label="Pickups today" value={String(activeRuns.filter((shipment) => shipment.status === 'Pickup Scheduled').length)} icon={MapPin} />
        <RunStat label="In transit" value={String(activeRuns.filter((shipment) => shipment.status === 'In Transit' || shipment.status === 'Picked Up').length)} icon={ChevronRight} />
        <RunStat label="Delivered" value={String(delivered)} icon={CheckCircle2} />
      </div>

      <Card className="mb-6 overflow-hidden border-deepNavy/10 bg-deepNavy text-white">
        <div className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-cyan">Today’s delivery focus</p><h2 className="mt-2 text-2xl font-semibold">Keep every parcel moving.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/70">This is a demo delivery workspace. Update each shipment as you collect cargo, start the journey, and complete the drop.</p></div>
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-white/10 text-center"><span className="text-xl font-semibold">{activeRuns.length}</span></div>
        </div>
      </Card>

      <div className="space-y-4">
        {activeRuns.length ? activeRuns.map((shipment) => {
          const route = routes.find((candidate) => candidate.id === shipment.routeId);
          const cargo = cargoService.get(shipment.cargoId);
          return <DeliveryRun key={shipment.id} shipment={shipment} route={route} cargo={cargo} />;
        }) : <Card><EmptyState icon={<Truck size={26} />} title="No active delivery runs" description="New matched shipments will appear here when they are ready for pickup." action={<Link to="/matching-center"><Button>Open Matching Center</Button></Link>} /></Card>}
      </div>
    </div>
  );
}

function DeliveryRun({ shipment, route, cargo }: { shipment: Shipment; route?: ReturnType<typeof routeService.get>; cargo?: ReturnType<typeof cargoService.get> }) {
  const nextAction = shipment.status === 'Booked' ? 'Confirm pickup' : shipment.status === 'Pickup Scheduled' ? 'Mark picked up' : shipment.status === 'Picked Up' ? 'Start delivery' : shipment.status === 'In Transit' ? 'Complete delivery' : 'Advance run';
  function advance() {
    shipmentService.advanceStatus(shipment.id);
    window.location.reload();
  }
  return <Card className="overflow-hidden"><div className="border-b border-border p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-mono text-sm font-semibold text-navy">{shipment.id}</span><StatusBadge status={shipment.status} /></div><h2 className="mt-2 text-xl font-semibold text-navy">{route ? `${route.origin} → ${route.destination}` : 'Assigned delivery'}</h2><p className="mt-1 text-xs text-muted">{route?.operatorName ?? 'Transit Route Hub'} · {route?.vehicleType ?? 'Delivery vehicle'}</p></div><Button onClick={advance} disabled={shipment.status === 'Delivered' || shipment.status === 'Cancelled'}><CheckCircle2 size={15} />{nextAction}</Button></div></div><div className="grid gap-4 p-5 md:grid-cols-[1fr_auto_1fr] md:items-center"><Stop icon={MapPin} label="Pickup" value={route?.origin ?? cargo?.origin ?? '—'} detail={cargo ? `${cargo.type} · ${cargo.weight} t` : 'Cargo details unavailable'} /><div className="hidden h-px bg-border md:block" /><Stop icon={Package} label="Drop-off" value={route?.destination ?? cargo?.destination ?? '—'} detail={`ETA ${formatDate(shipment.estimatedArrival, false)}`} /></div><div className="grid gap-3 border-t border-border bg-background/50 p-5 text-sm sm:grid-cols-4"><RunDetail icon={CalendarDays} label="Departure" value={route ? formatDate(route.departure, false) : '—'} /><RunDetail icon={Truck} label="Capacity" value={route ? `${route.availableCapacity.toFixed(1)} t available` : '—'} /><RunDetail icon={Phone} label="Contact" value="Demo consignee" /><RunDetail icon={Package} label="Estimated cost" value={route ? formatINR(route.price) : '—'} /></div><div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3"><Link className="text-sm font-semibold text-teal hover:underline" to={`/shipments/${shipment.id}`}>Open full tracking</Link><span className="text-xs text-muted">Use the timeline for full delivery history.</span></div></Card>;
}

function Stop({ icon: Icon, label, value, detail }: { icon: typeof MapPin; label: string; value: string; detail: string }) { return <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-sm bg-teal/10 text-teal"><Icon size={18} /></div><div><p className="text-xs uppercase tracking-wider text-muted">{label}</p><p className="mt-1 font-semibold text-navy">{value}</p><p className="mt-0.5 text-xs text-muted">{detail}</p></div></div>; }
function RunDetail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="flex items-center gap-2"><Icon size={15} className="text-muted" /><div><p className="text-[11px] text-muted">{label}</p><p className="font-semibold text-navy">{value}</p></div></div>; }
function RunStat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Truck }) { return <Card className="p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted">{label}</span><Icon size={16} className="text-teal" /></div><p className="mt-2 text-2xl font-semibold text-navy">{value}</p></Card>; }
