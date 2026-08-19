import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Truck, ArrowRight, MapPin, Clock } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { RouteMap } from './RouteMap';
import { formatINR, formatDate } from '../../utils/format';
import { cn } from '../../lib/utils';
import type { Route } from '../../types';

interface RouteCardProps {
  route: Route;
  index?: number;
  selected?: boolean;
}

export function RouteCard({ route, index = 0, selected = false }: RouteCardProps) {
  const capacityPercent = Math.min(100, Math.max(0, (route.availableCapacity / route.totalCapacity) * 100));
  const capacityClass = capacityPercent >= 75 ? 'w-full' : capacityPercent >= 50 ? 'w-3/4' : capacityPercent >= 25 ? 'w-1/2' : 'w-1/4';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Card className={cn(
        'overflow-hidden transition hover:shadow-md',
        selected && 'border-teal ring-2 ring-teal/15 shadow-md',
      )}>
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div>
            <span className={cn(
              'trh-pill',
              route.matchScore >= 90 ? 'bg-teal/10 text-teal border border-teal/20' :
              route.matchScore >= 75 ? 'bg-cyan/15 text-teal border border-cyan/30' :
              'bg-warning/15 text-warning border border-warning/30'
            )}>
              {route.matchScore}% MATCH
              <span className="text-muted ml-1 font-normal">· {matchLabel(route.matchScore)}</span>
            </span>
            <h3 className="mt-2 text-lg font-semibold text-navy flex items-center gap-2">
              {route.origin}
              <ArrowRight size={16} className="text-muted" />
              {route.destination}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted mt-1">
              <span className="flex items-center gap-1"><Truck size={12} /> {route.vehicleType}</span>
              <span className="text-teal">{transportModeLabel(route.transportMode)}</span>
              <span className="flex items-center gap-1"><MapPin size={12} /> {route.distanceKm} km</span>
              <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(route.departure)}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-navy">{formatINR(route.price)}</div>
            <div className="text-xs text-muted">{route.operatorName}</div>
          </div>
        </div>

        <div className="px-5">
          <RouteMap
            origin={route.origin}
            destination={route.destination}
            stops={route.stops.slice(1, -1)}
            distanceKm={route.distanceKm}
            eta={route.eta}
            capacity={`${route.availableCapacity} t available`}
            compact
          />
        </div>

        <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-[170px] flex-1 max-w-xs">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted">Available capacity</span>
              <span className="font-semibold text-navy">{route.availableCapacity} t <span className="text-muted font-normal">of {route.totalCapacity} t</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden" aria-label={`${route.availableCapacity} tons available out of ${route.totalCapacity} tons`} role="img">
              <div className={cn('h-full rounded-full bg-teal transition-all', capacityClass)} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <StatusBadge status={route.status === 'Active' ? 'In Transit' : route.status === 'Full' ? 'Booked' : 'Delivered'} />
          </div>
          <Link to={`/routes/${route.id}`}>
            <Button variant="primary" size="sm">
              View Route <ArrowRight size={14} />
            </Button>
          </Link>
        </div>
      </Card>
    </motion.div>
  );
}

function transportModeLabel(mode?: Route['transportMode']) {
  if (mode === 'RAIL') return 'Rail';
  if (mode === 'AIR') return 'Air';
  if (mode === 'SEA') return 'Sea';
  if (mode === 'MULTIMODAL') return 'Multimodal';
  return 'Road';
}

function matchLabel(score: number) {
  if (score >= 90) return 'Highly compatible';
  if (score >= 75) return 'Good match';
  return 'Possible match';
}