import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Calendar, Truck, Package, Filter, X, Loader2, Sliders } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { RouteCard } from '../components/ui/RouteCard';
import { RouteMap } from '../components/ui/RouteMap';
import { EmptyState } from '../components/ui/Feedback';
import { routeService } from '../services/dataService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate, clamp } from '../utils/format';
import type { CargoType, Route, TransportMode } from '../types';

type SortKey = 'match' | 'price' | 'departure' | 'capacity';

interface Filters {
  origin: string;
  destination: string;
  date: string;
  weight: string;
  cargoType: string;
  vehicleType: string;
  transportMode: string;
  priceMin: number;
  priceMax: number;
  minMatchScore: number;
  minCapacity: number;
}

const DEFAULT_FILTERS: Filters = {
  origin: '',
  destination: '',
  date: '',
  weight: '',
  cargoType: '',
  vehicleType: '',
  transportMode: '',
  priceMin: 0,
  priceMax: 50000,
  minMatchScore: 0,
  minCapacity: 0,
};

export function FindSpacePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    origin: searchParams.get('origin') ?? '',
    destination: searchParams.get('destination') ?? '',
    weight: searchParams.get('weight') ?? '',
    cargoType: searchParams.get('cargoType') ?? '',
    date: searchParams.get('date') ?? '',
  }));
  const [sort, setSort] = useState<SortKey>('match');
  const [results, setResults] = useState<Route[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Route | null>(null);
  const [mobileFilters, setMobileFilters] = useState(false);

  useEffect(() => {
    if (searchParams.get('origin') || searchParams.get('destination') || searchParams.get('weight')) {
      search();
    }
  }, []);

  function search(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setTimeout(() => {
      const matched = routeService.search({
        origin: filters.origin,
        destination: filters.destination,
        departureDate: filters.date,
        weight: filters.weight ? Number(filters.weight) : undefined,
        cargoType: filters.cargoType || undefined,
        vehicleType: filters.vehicleType || undefined,
        transportMode: (filters.transportMode || undefined) as TransportMode | undefined,
      });
      const filtered = matched.filter((r) => {
        if (r.price < filters.priceMin) return false;
        if (r.price > filters.priceMax) return false;
        if (r.matchScore < filters.minMatchScore) return false;
        if (r.availableCapacity < filters.minCapacity) return false;
        return true;
      });
      const sorted = sortRoutes(filtered, sort);
      setResults(sorted);
      setSelected(sorted[0] ?? null);
      setLoading(false);
    }, 700);
  }

  const visibleResults = useMemo(() => results ?? [], [results]);

  function reset() {
    setFilters(DEFAULT_FILTERS);
    setResults(null);
    setSelected(null);
  }

  return (
    <div>
      <PageHeader
        title="Find Available Cargo Space"
        subtitle="Match your shipment with available transportation capacity."
      />

      <Card className="p-5 md:p-6 mb-5">
        <form onSubmit={search} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-2">
            <Input
              id="origin"
              label="From"
              placeholder="Origin city"
              icon={<MapPin size={16} />}
              value={filters.origin}
              onChange={(e) => setFilters({ ...filters, origin: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              id="destination"
              label="To"
              placeholder="Destination city"
              icon={<MapPin size={16} />}
              value={filters.destination}
              onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              id="date"
              type="date"
              label="Departure"
              icon={<Calendar size={16} />}
              value={filters.date}
              onChange={(e) => setFilters({ ...filters, date: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              id="weight"
              type="number"
              step="0.1"
              min="0"
              label="Weight (t)"
              placeholder="0.0"
              icon={<Package size={16} />}
              value={filters.weight}
              onChange={(e) => setFilters({ ...filters, weight: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Select
              id="vtype"
              label="Vehicle"
              value={filters.vehicleType}
              onChange={(e) => setFilters({ ...filters, vehicleType: e.target.value })}
            >
              <option value="">Any</option>
              <option value="Mini Truck">Mini Truck</option>
              <option value="Truck">Truck</option>
              <option value="Trailer">Trailer</option>
              <option value="Container">Container</option>
              <option value="Tanker">Tanker</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select
              id="transportMode"
              label="Transport mode"
              value={filters.transportMode}
              onChange={(e) => setFilters({ ...filters, transportMode: e.target.value })}
            >
              <option value="">All modes</option>
              <option value="ROAD">Road</option>
              <option value="RAIL">Rail</option>
              <option value="AIR">Air</option>
              <option value="SEA">Sea</option>
              <option value="MULTIMODAL">Multimodal</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select
              id="cargoType"
              label="Cargo type"
              value={filters.cargoType}
              onChange={(e) => setFilters({ ...filters, cargoType: e.target.value })}
            >
              <option value="">Any type</option>
              {(['General', 'Fragile', 'Refrigerated', 'Hazardous', 'Bulk', 'Liquid'] as CargoType[]).map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-12 flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="button" variant="secondary" size="sm" onClick={() => setMobileFilters(true)} className="md:hidden">
                <Sliders size={14} /> Filters
              </Button>
              <Select
                id="sort"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="!py-2"
              >
                <option value="match">Best Match</option>
                <option value="price">Lowest Price</option>
                <option value="departure">Earliest Departure</option>
                <option value="capacity">Largest Capacity</option>
              </Select>
              <button type="button" onClick={reset} className="text-xs text-muted hover:text-navy">Reset</button>
            </div>
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              Find Available Space
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Results */}
        <div className="lg:col-span-7 space-y-4">
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="trh-card p-12 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  className="h-10 w-10 mx-auto rounded-full border-4 border-teal/20 border-t-teal"
                />
                <p className="mt-4 text-sm text-muted">Finding the best available cargo space…</p>
              </motion.div>
            )}

            {!loading && results && visibleResults.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card>
                  <EmptyState
                    icon={<Search size={26} />}
                    title="No cargo matches found."
                    description="Try adjusting your filters or changing the origin/destination."
                    action={<Button onClick={reset}>Reset filters</Button>}
                  />
                </Card>
              </motion.div>
            )}

            {!loading && visibleResults.length > 0 && (
              <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <p className="text-xs text-muted">{visibleResults.length} routes matched</p>
                {visibleResults.map((r, idx) => (
                  <div
                    key={r.id}
                    onMouseEnter={() => setSelected(r)}
                    onClick={() => setSelected(r)}
                  >
                    <RouteCard route={r} index={idx} selected={selected?.id === r.id} />
                  </div>
                ))}
              </motion.div>
            )}

            {!loading && results === null && (
              <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card>
                  <EmptyState
                    icon={<Truck size={26} />}
                    title="Find your ideal cargo space."
                    description="Use the search panel above to discover matching routes."
                  />
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Visualization */}
        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20">
            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted">Route Preview</p>
                  <h3 className="font-semibold text-navy">
                    {selected ? `${selected.origin} → ${selected.destination}` : 'Select a route'}
                  </h3>
                </div>
                {selected && (
                  <span className="trh-pill bg-teal/10 text-teal border border-teal/20">
                    {selected.matchScore}% Match
                  </span>
                )}
              </div>
              {selected ? (
                <>
                  <RouteMap
                    origin={selected.origin}
                    destination={selected.destination}
                    stops={selected.stops.slice(1, -1)}
                    distanceKm={selected.distanceKm}
                    eta={selected.eta}
                    capacity={`${selected.availableCapacity} t`}
                  />
                  <div className="px-5 py-4 grid grid-cols-3 gap-3 border-t border-border bg-background/40">
                    <Mini label="Departure" value={formatDate(selected.departure, false)} />
                    <Mini label="ETA" value={formatDate(selected.eta, false)} />
                    <Mini label="Cost" value={selected.price.toLocaleString('en-IN')} />
                  </div>
                  <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/routes/${selected.id}`)}>View Details</Button>
                    <Button variant="primary" size="sm" onClick={() => navigate(`/routes/${selected.id}?book=1`)}>Book Space</Button>
                  </div>
                </>
              ) : (
                <div className="h-56 flex items-center justify-center text-sm text-muted">
                  Run a search to preview a route here.
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile filters drawer */}
      <AnimatePresence>
        {mobileFilters && (
          <FilterDrawer
            filters={filters}
            setFilters={setFilters}
            onClose={() => setMobileFilters(false)}
            onApply={() => { setMobileFilters(false); search(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="font-semibold text-navy text-sm mt-0.5">{value}</div>
    </div>
  );
}

function sortRoutes(routes: Route[], key: SortKey): Route[] {
  const copy = [...routes];
  switch (key) {
    case 'match':
      return copy.sort((a, b) => b.matchScore - a.matchScore);
    case 'price':
      return copy.sort((a, b) => a.price - b.price);
    case 'departure':
      return copy.sort((a, b) => new Date(a.departure).getTime() - new Date(b.departure).getTime());
    case 'capacity':
      return copy.sort((a, b) => b.availableCapacity - a.availableCapacity);
    default:
      return copy;
  }
}

function FilterDrawer({
  filters, setFilters, onClose, onApply,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-deepNavy/40" />
      <motion.div
        initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
        transition={{ duration: 0.25 }}
        className="ml-auto w-full max-w-sm bg-white border-l border-border h-full flex flex-col"
      >
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-navy flex items-center gap-2"><Filter size={16} /> Filters</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded hover:bg-background"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="trh-label">Min price (₹)</label>
            <input
              type="number" min="0" value={filters.priceMin} aria-label="Minimum price"
              onChange={(e) => setFilters({ ...filters, priceMin: clamp(Number(e.target.value) || 0, 0, 1e7) })}
              className="trh-input"
            />
          </div>
          <div>
            <label className="trh-label">Max price (₹)</label>
            <input
              type="number" min="0" value={filters.priceMax} aria-label="Maximum price"
              onChange={(e) => setFilters({ ...filters, priceMax: clamp(Number(e.target.value) || 0, 0, 1e7) })}
              className="trh-input"
            />
          </div>
          <div>
            <label className="trh-label">Min match score</label>
            <input
              type="range" min={0} max={100} step={5} value={filters.minMatchScore} aria-label="Minimum match score"
              onChange={(e) => setFilters({ ...filters, minMatchScore: Number(e.target.value) })}
              className="w-full accent-teal"
            />
            <div className="text-xs text-muted">{filters.minMatchScore}% and above</div>
          </div>
          <div>
            <label className="trh-label">Min capacity (t)</label>
            <input
              type="number" min="0" step="0.1" value={filters.minCapacity} aria-label="Minimum capacity"
              onChange={(e) => setFilters({ ...filters, minCapacity: clamp(Number(e.target.value) || 0, 0, 100) })}
              className="trh-input"
            />
          </div>
        </div>
        <div className="p-5 border-t border-border flex gap-2">
          <Button variant="secondary" block onClick={onClose}>Cancel</Button>
          <Button block onClick={onApply}>Apply</Button>
        </div>
      </motion.div>
    </div>
  );
}