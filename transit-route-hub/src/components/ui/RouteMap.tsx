import { motion } from 'framer-motion';
import { Truck } from 'lucide-react';

interface RouteMapProps {
  origin: string;
  destination: string;
  stops?: string[];
  distanceKm?: number;
  eta?: string;
  capacity?: string;
  movingTruck?: boolean;
  compact?: boolean;
}

export function RouteMap({
  origin,
  destination,
  stops = [],
  distanceKm,
  eta,
  capacity,
  movingTruck = true,
  compact = false,
}: RouteMapProps) {
  const all = [origin, ...stops, destination];
  const unique = all.filter((s, i) => all.indexOf(s) === i);
  const heightClass = compact ? 'h-[180px]' : 'h-[260px]';
  return (
    <div className={`relative w-full ${heightClass} rounded-md overflow-hidden border border-border bg-gradient-to-br from-[#F7FBFC] via-white to-[#F0F8FA]`}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 800 260"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#E5EAF0" />
          </pattern>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#08A6A6" />
            <stop offset="100%" stopColor="#14C8C8" />
          </linearGradient>
        </defs>
        <rect width="800" height="260" fill="url(#dot-grid)" />
        <motion.path
          d="M 60 200 C 200 100, 380 240, 540 120 S 740 60, 760 80"
          stroke="url(#route-grad)"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, ease: 'easeInOut' }}
        />
        {unique.map((stop, i) => {
          const x = 60 + (700 * i) / Math.max(unique.length - 1, 1);
          const y = i % 2 === 0 ? 200 : 120;
          return (
            <g key={`${stop}-${i}`}>
              <circle cx={x} cy={y} r={6} fill="#FFFFFF" stroke="#08A6A6" strokeWidth={3} />
              <text x={x} y={y - 14} textAnchor="middle" fill="#102A43" fontSize={12} fontWeight={600}>
                {stop}
              </text>
            </g>
          );
        })}
      </svg>
      {movingTruck && <MovingTruck />}
      {(distanceKm || eta || capacity) && (
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
          {distanceKm !== undefined && <InfoPill label="Distance" value={`${distanceKm} km`} />}
          {eta && <InfoPill label="ETA" value={new Date(eta).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} />}
          {capacity && <InfoPill label="Capacity" value={capacity} />}
        </div>
      )}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-1.5 rounded-md bg-white/90 backdrop-blur border border-border text-xs">
      <span className="text-muted">{label}: </span>
      <span className="font-semibold text-navy">{value}</span>
    </div>
  );
}

function MovingTruck() {
  return (
    <motion.div
      className="absolute"
      style={{ top: 'calc(50% - 18px)' }}
      initial={{ left: '5%' }}
      animate={{ left: '85%' }}
      transition={{ duration: 7, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
    >
      <div className="px-2.5 py-1 rounded-sm bg-deepNavy text-white text-xs font-semibold shadow-subtle flex items-center gap-1.5">
        <Truck size={13} aria-hidden />
        En route
      </div>
    </motion.div>
  );
}
