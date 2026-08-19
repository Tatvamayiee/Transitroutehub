import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, CheckCircle2, Gauge, Layers3, Map, Package, Route as RouteIcon, Sparkles, Target, Timer, Truck, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/Feedback';
import { Drawer } from '../components/ui/Drawer';
import { useAuth } from '../context/AuthContext';
import { cargoService, routeService } from '../services/dataService';
import { storageService } from '../services/storageService';
import { formatDate, formatINR } from '../utils/format';
import { calculateKpis, calculateWhatIf, findConsolidationOpportunities, matchCargoToRoutes, type ConsolidationOpportunity, type MatchRecommendation } from '../services/optimizationService';
import type { Cargo, Route } from '../types';

export function OptimizationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const allCargo = cargoService.list();
  const cargos = user?.role === 'CARGO_OWNER' ? cargoService.list(user.id) : allCargo;
  const routes = routeService.list();
  const bookings = storageService.getBookings();
  const kpis = useMemo(() => calculateKpis(cargos, routes, bookings), [cargos, routes, bookings]);
  const matches = useMemo(() => matchCargoToRoutes(cargos, routes), [cargos, routes]);
  const consolidations = useMemo(() => findConsolidationOpportunities(cargos, routes), [cargos, routes]);
  const selectedCargo = cargos[0];
  const selectedRoute = matches[0]?.route ?? routes[0];
  const [selectedConsolidation, setSelectedConsolidation] = useState<ConsolidationOpportunity | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transit AI Optimization Center"
        subtitle="Optimize cargo, capacity, routes, cost, and delivery time."
        actions={<span className="trh-pill border border-teal/20 bg-teal/10 text-teal"><Sparkles size={13} /> AI-assisted optimization · Demo rules</span>}
      />

      <Recommendation matches={matches} onBook={(match) => navigate(`/routes/${match.route.id}?book=1&weight=${match.cargo.weight}&cargoType=${encodeURIComponent(match.cargo.type)}&date=${match.cargo.pickupDate.slice(0, 10)}`)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Estimated Savings" value={formatINR(kpis.estimatedSavings)} icon={Wallet} trend="Rule estimate" trendUp accent="orange" />
        <StatCard label="Vehicle Utilization" value={`${kpis.vehicleUtilization}%`} icon={Gauge} trend="Across active routes" trendUp accent="teal" />
        <StatCard label="Cargo Consolidated" value={`${kpis.cargoConsolidated}`} icon={Layers3} trend="Compatible loads" trendUp accent="cyan" />
        <StatCard label="Distance Optimized" value={`${kpis.distanceOptimized} km`} icon={Map} trend="Potential reduction" trendUp accent="navy" />
        <StatCard label="Time Saved" value={`${kpis.timeSaved} hrs`} icon={Timer} trend="Estimated" trendUp accent="teal" />
      </div>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="overflow-hidden">
          <SectionHeader icon={Target} title="Smart Cargo Matching" subtitle="Compatibility recommendations from your local cargo and route data." />
          <div className="space-y-3 p-5">
            {matches.length ? matches.slice(0, 4).map((match, index) => <MatchCard key={`${match.cargo.id}-${match.route.id}`} match={match} index={index} onBook={() => navigate(`/routes/${match.route.id}?book=1&weight=${match.cargo.weight}&cargoType=${encodeURIComponent(match.cargo.type)}&date=${match.cargo.pickupDate.slice(0, 10)}`)} />) : <EmptyState icon={<Target size={26} />} title="No compatible transport found" description="Add cargo or active transport capacity to generate recommendations." action={<Button onClick={() => navigate('/post-cargo')}>Post Cargo</Button>} />}
          </div>
        </Card>

        <ScoreCard kpis={kpis} />
      </section>

      <section>
        <SectionHeader icon={Layers3} title="Cargo Consolidation Opportunities" subtitle="Potential shared transport based on corridor and capacity compatibility." />
        {consolidations.length ? (
          <div className="mt-3 grid gap-4 lg:grid-cols-2">{consolidations.map((opportunity) => <ConsolidationCard key={`${opportunity.origin}-${opportunity.destination}`} opportunity={opportunity} onView={() => setSelectedConsolidation(opportunity)} />)}</div>
        ) : (
          <Card className="mt-3"><EmptyState icon={<Layers3 size={26} />} title="No consolidation opportunities available" description="Add more cargo on the same corridor to identify shared transport savings." /></Card>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <RouteOptimization routes={routes} selectedCargo={selectedCargo} selectedRoute={selectedRoute} onBook={(route) => selectedCargo && navigate(`/routes/${route.id}?book=1&weight=${selectedCargo.weight}&cargoType=${encodeURIComponent(selectedCargo.type)}&date=${selectedCargo.pickupDate.slice(0, 10)}`)} />
        <WhatIfPanel cargo={selectedCargo} route={selectedRoute} />
      </section>

      <Drawer open={Boolean(selectedConsolidation)} onClose={() => setSelectedConsolidation(null)} title="Consolidation Opportunity" width="md">
        {selectedConsolidation && <ConsolidationDetail opportunity={selectedConsolidation} onCreate={() => {
          if (selectedConsolidation.route) navigate(`/routes/${selectedConsolidation.route.id}?book=1&weight=${selectedConsolidation.combinedWeight}&date=${selectedConsolidation.cargoes[0].pickupDate.slice(0, 10)}`);
        }} />}
      </Drawer>
    </div>
  );
}

function Recommendation({ matches, onBook }: { matches: MatchRecommendation[]; onBook: (match: MatchRecommendation) => void }) {
  const match = matches[0];
  return (
    <Card className="overflow-hidden border-teal/20 bg-gradient-to-br from-white via-white to-teal/5">
      <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:p-7">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal"><Sparkles size={15} /> Optimization recommendation</div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-navy">{match ? 'Use the highest-fit capacity for this cargo.' : 'Build a better transport plan.'}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{match ? `Match ${match.cargo.id} with ${match.route.operatorName} on ${match.route.origin} → ${match.route.destination}. ${match.reason}` : 'The optimization engine will compare route, capacity, timing and cost once cargo is available.'}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted"><Reason label="Route compatible" /><Reason label="Capacity checked" /><Reason label="Estimated locally" /></div>
        </div>
        {match && <div className="flex min-w-[160px] flex-col items-start justify-center rounded-lg border border-teal/20 bg-white p-4 md:items-end"><span className="text-xs uppercase tracking-wider text-muted">Best match</span><span className="mt-1 text-4xl font-semibold text-teal">{match.score}%</span><span className="text-xs text-muted">{formatINR(match.estimatedSavings)} potential savings</span><Button className="mt-4" size="sm" onClick={() => onBook(match)}>Book Recommended Transport <ArrowRight size={14} /></Button></div>}
      </div>
    </Card>
  );
}

function MatchCard({ match, index, onBook }: { match: MatchRecommendation; index: number; onBook: () => void }) {
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-sm border border-border p-4 transition hover:border-teal/40 hover:shadow-subtle">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><span className="trh-pill border border-teal/20 bg-teal/10 text-teal">{match.score}% MATCH</span><h3 className="mt-2 text-base font-semibold text-navy">{match.route.origin} → {match.route.destination}</h3><p className="mt-1 text-xs text-muted">Cargo {match.cargo.id} · {match.cargo.weight} t · {match.route.operatorName}</p></div><div className="text-right"><p className="text-lg font-semibold text-navy">{formatINR(match.estimatedCost)}</p><p className="text-xs text-success">{formatINR(match.estimatedSavings)} potential savings</p></div></div>
    <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-4"><span className="flex items-center gap-1"><Truck size={13} />{match.route.availableCapacity} t available</span><span className="flex items-center gap-1"><RouteIcon size={13} />{transportModeLabel(match.route.transportMode)}</span><span className="flex items-center gap-1"><CalendarClock size={13} />{formatDate(match.route.eta, false)}</span><span className="flex items-center gap-1"><Gauge size={13} />{match.utilization}% utilization</span></div>
    <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs leading-5 text-muted">{match.reason}</p><Button size="sm" variant="secondary" onClick={onBook}>Use Plan</Button></div>
  </motion.div>;
}

function ConsolidationCard({ opportunity, onView }: { opportunity: ConsolidationOpportunity; onView: () => void }) {
  return <Card className="p-5"><div className="flex items-start justify-between gap-3"><div><span className="trh-pill bg-orange/10 text-orange">CONSOLIDATION OPPORTUNITY</span><h3 className="mt-3 text-lg font-semibold text-navy">{opportunity.origin} → {opportunity.destination}</h3><p className="mt-1 text-sm text-muted">{opportunity.cargoes.length} compatible shipments · {opportunity.combinedWeight} t combined</p></div><Layers3 className="text-orange" size={22} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Metric label="Individual estimate" value={formatINR(opportunity.individualCost)} /><Metric label="Optimized estimate" value={formatINR(opportunity.optimizedCost)} /><Metric label="Potential savings" value={formatINR(opportunity.savings)} accent="text-success" /><Metric label="Vehicle utilization" value={`${opportunity.utilization}%`} accent="text-teal" /></div><Button className="mt-5" variant="secondary" onClick={onView}>View Consolidation <ArrowRight size={14} /></Button></Card>;
}

function ConsolidationDetail({ opportunity, onCreate }: { opportunity: ConsolidationOpportunity; onCreate: () => void }) {
  return <div className="space-y-5"><div><p className="text-xs uppercase tracking-wider text-muted">Combined corridor</p><h3 className="mt-1 text-xl font-semibold text-navy">{opportunity.origin} → {opportunity.destination}</h3></div><div className="space-y-2">{opportunity.cargoes.map((cargo, index) => <div key={cargo.id} className="flex items-center justify-between rounded-sm border border-border p-3 text-sm"><span className="flex items-center gap-2 text-navy"><Package size={15} className="text-teal" /> Cargo {index + 1} · {cargo.id}</span><span className="text-muted">{cargo.weight} t · {cargo.type}</span></div>)}</div><div className="grid grid-cols-2 gap-3"><Metric label="Combined weight" value={`${opportunity.combinedWeight} t`} /><Metric label="Combined volume" value={`${opportunity.combinedVolume.toFixed(1)} m³`} /><Metric label="Vehicle capacity" value={`${opportunity.vehicleCapacity} t`} /><Metric label="Estimated savings" value={formatINR(opportunity.savings)} accent="text-success" /></div><div className="rounded-sm bg-teal/5 p-4 text-sm text-muted"><p className="font-semibold text-navy">Compatibility reasons</p>{opportunity.reasons.map((reason) => <p key={reason} className="mt-2 flex items-start gap-2"><CheckCircle2 size={15} className="mt-0.5 text-success" />{reason}</p>)}</div><Button block disabled={!opportunity.route} onClick={onCreate}>Create Combined Shipment <ArrowRight size={15} /></Button></div>;
}

function RouteOptimization({ routes, selectedCargo, selectedRoute, onBook }: { routes: Route[]; selectedCargo?: Cargo; selectedRoute?: Route; onBook: (route: Route) => void }) {
  const candidates = routes.filter((route) => selectedCargo ? route.availableCapacity >= selectedCargo.weight : true);
  const lowest = [...candidates].sort((a, b) => a.price - b.price)[0];
  const fastest = [...candidates].sort((a, b) => new Date(a.eta).getTime() - new Date(b.eta).getTime())[0];
  const balanced = [...candidates].sort((a, b) => (a.price + a.distanceKm) - (b.price + b.distanceKm))[0];
  const options = [
    balanced && { route: balanced, label: 'BEST BALANCE', tone: 'bg-teal/10 text-teal' },
    lowest && lowest.id !== balanced?.id && { route: lowest, label: 'LOWEST COST', tone: 'bg-orange/10 text-orange' },
    fastest && ![balanced?.id, lowest?.id].includes(fastest.id) && { route: fastest, label: 'FASTEST', tone: 'bg-deepNavy/10 text-deepNavy' },
  ].filter(Boolean) as Array<{ route: Route; label: string; tone: string }>;
  return <Card className="overflow-hidden"><SectionHeader icon={RouteIcon} title="Route Optimization" subtitle="Estimated route analysis using offline demo data." /><div className="space-y-3 p-5">{options.map(({ route, label, tone }) => <div key={route.id} className={`rounded-sm border p-4 ${selectedRoute?.id === route.id ? 'border-teal bg-teal/5' : 'border-border'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`trh-pill ${tone}`}>{label}</span><h3 className="mt-2 text-sm font-semibold text-navy">{route.origin} → {route.destination}</h3><p className="mt-1 text-xs text-muted">{route.stops.slice(1, -1).join(' · ') || 'Direct route'}</p></div><p className="text-lg font-semibold text-navy">{formatINR(route.price)}</p></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted"><Metric label="Distance" value={`${route.distanceKm} km`} /><Metric label="ETA" value={formatDate(route.eta, false)} /><Metric label="Capacity" value={`${route.availableCapacity} t`} /></div><Button className="mt-3" size="sm" variant="secondary" onClick={() => onBook(route)}>Select Route</Button></div>)}{!options.length && <EmptyState icon={<RouteIcon size={24} />} title="No route options" description="Add compatible capacity to compare route plans." />}</div></Card>;
}

function WhatIfPanel({ cargo, route }: { cargo?: Cargo; route?: Route }) {
  const [weight, setWeight] = useState(String(cargo?.weight ?? 2.5));
  const [budget, setBudget] = useState(String(cargo?.budget ?? route?.price ?? 10000));
  const result = calculateWhatIf(route, Number(weight) || 0, Number(budget) || 0);
  return <Card className="overflow-hidden"><SectionHeader icon={Gauge} title="What-If Simulator" subtitle="Adjust the plan and see deterministic optimization impact." /><div className="grid gap-5 p-5 md:grid-cols-2"><div className="space-y-4"><label className="block text-sm font-medium text-navy">Cargo weight (tons)<input aria-label="What-if cargo weight" type="number" min="0.1" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} className="trh-input mt-1.5" /></label><label className="block text-sm font-medium text-navy">Budget preference<input aria-label="What-if budget preference" type="number" min="0" step="100" value={budget} onChange={(event) => setBudget(event.target.value)} className="trh-input mt-1.5" /></label></div><div className="rounded-sm bg-background p-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted">Optimization impact</p><div className="mt-3 space-y-3"><Metric label="Current plan" value={formatINR(result.currentCost)} /><Metric label="Optimized plan" value={formatINR(result.optimizedCost)} accent="text-teal" /><Metric label="Potential savings" value={formatINR(result.savings)} accent="text-success" /><Metric label="Utilization" value={`${result.currentUtilization}% → ${result.optimizedUtilization}%`} accent="text-teal" /></div></div></div></Card>;
}

function ScoreCard({ kpis }: { kpis: ReturnType<typeof calculateKpis> }) {
  const scoreClass = kpis.score >= 85 ? 'bg-teal' : kpis.score >= 70 ? 'bg-orange' : 'bg-warning';
  return <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted">Optimization Score</p><p className="mt-1 text-3xl font-semibold text-navy">{kpis.score}<span className="text-base text-muted">/100</span></p></div><div className="flex h-16 w-16 items-center justify-center rounded-full border-8 border-border"><div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold text-white ${scoreClass}`}>{kpis.score}</div></div></div><div className="mt-5 space-y-3"><ScoreLine label="Capacity utilization" value={kpis.breakdown.capacity} /><ScoreLine label="Cost efficiency" value={kpis.breakdown.cost} /><ScoreLine label="Route efficiency" value={kpis.breakdown.route} /><ScoreLine label="Delivery feasibility" value={kpis.breakdown.delivery} /></div></Card>;
}

function ScoreLine({ label, value }: { label: string; value: number }) { return <div><div className="flex justify-between text-xs"><span className="text-muted">{label}</span><span className="font-semibold text-navy">{value}</span></div><div className="mt-1 h-1.5 rounded-full bg-border"><div className="h-full w-3/4 rounded-full bg-teal" /></div></div>; }
function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Target; title: string; subtitle: string }) { return <div className="flex items-start gap-3 border-b border-border px-5 py-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-teal/10 text-teal"><Icon size={18} /></div><div><h2 className="text-lg font-semibold text-navy">{title}</h2><p className="mt-0.5 text-xs text-muted">{subtitle}</p></div></div>; }
function Metric({ label, value, accent = 'text-navy' }: { label: string; value: string; accent?: string }) { return <div><p className="text-[11px] text-muted">{label}</p><p className={`mt-0.5 text-sm font-semibold ${accent}`}>{value}</p></div>; }
function Reason({ label }: { label: string }) { return <span className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1"><CheckCircle2 size={12} className="text-success" />{label}</span>; }
function transportModeLabel(mode?: Route['transportMode']) { return mode === 'RAIL' ? 'Rail' : mode === 'AIR' ? 'Air' : mode === 'SEA' ? 'Sea' : mode === 'MULTIMODAL' ? 'Multimodal' : 'Road'; }
