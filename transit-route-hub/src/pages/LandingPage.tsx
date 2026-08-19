import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, Search, BarChart3, Truck } from 'lucide-react';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { Button } from '../components/ui/Button';
import { Counter } from '../components/ui/Counter';
import { RouteMap } from '../components/ui/RouteMap';
import { formatINR } from '../utils/format';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.5 },
};

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-background to-[#E8F4F7] -z-10" />
        <div className="absolute inset-0 -z-10 opacity-50" aria-hidden>
          <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
            <defs>
              <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="#E5EAF0" />
              </pattern>
            </defs>
            <rect width="1000" height="600" fill="url(#dots)" />
          </svg>
        </div>

        <div className="mx-auto max-w-7xl px-4 md:px-8 pt-14 md:pt-20 pb-16 md:pb-24">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal/10 text-teal text-xs font-medium border border-teal/20"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
                Smart Cargo Matching
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.05 }}
                className="mt-4 text-4xl md:text-5xl lg:text-6xl font-semibold text-navy tracking-tight leading-[1.05]"
              >
                Turn Empty <span className="text-teal">Cargo Space</span>
                <br />Into Opportunity.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12 }}
                className="mt-5 text-base md:text-lg text-muted max-w-xl"
              >
                Connect available transportation capacity with cargo that needs to move — faster, smarter and more efficiently.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.18 }}
                className="mt-7 flex flex-wrap gap-3"
              >
                <Link to="/role-selection">
                  <Button size="lg" variant="primary">
                    Find Cargo Space
                    <ArrowRight size={18} />
                  </Button>
                </Link>
                <Link to="/role-selection">
                  <Button size="lg" variant="secondary">
                    <Package size={18} />
                    Post Your Cargo
                  </Button>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="mt-10 flex items-center gap-6 text-xs text-muted"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  No setup fees
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal" />
                  Verified operators
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange" />
                  Pay per booking
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative"
              >
                <div className="absolute -top-6 -left-6 w-72 h-72 bg-teal/10 rounded-full blur-3xl -z-10" />
                <div className="trh-card overflow-hidden">
                  <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted">Featured Route</p>
                      <p className="text-lg font-semibold text-navy mt-0.5">Chennai → Bengaluru</p>
                    </div>
                    <div className="trh-pill bg-teal/10 text-teal border border-teal/20">
                      98% Match
                    </div>
                  </div>
                  <RouteMap
                    origin="Chennai"
                    destination="Bengaluru"
                    stops={['Vellore', 'Hosur']}
                    distanceKm={350}
                    eta={new Date(Date.now() + 24 * 3600 * 1000).toISOString()}
                    capacity="2.5 tons"
                  />
                  <div className="px-6 py-4 grid grid-cols-3 gap-4 border-t border-border bg-background/40">
                    <Stat label="Departure" value="7:30 AM" />
                    <Stat label="ETA" value="3:30 PM" />
                    <Stat label="Cost" value={formatINR(8400)} />
                  </div>
                </div>
                <FloatingCard
                  className="absolute -left-3 md:-left-8 top-10"
                  title="Capacity"
                  value="18% Space Available"
                  accent="orange"
                />
                <FloatingCard
                  className="absolute -right-3 md:-right-6 bottom-32"
                  title="ETA"
                  value="Tomorrow · 7:30 AM"
                  accent="navy"
                />
                <FloatingCard
                  className="absolute right-2 -bottom-2"
                  title="Cost"
                  value={formatINR(8400)}
                  accent="teal"
                />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-wider text-teal font-semibold">How it works</p>
            <h2 className="text-3xl md:text-4xl font-semibold text-navy mt-2">Four steps. Zero empty miles.</h2>
            <p className="text-muted mt-3">From posting cargo to delivery confirmation, every step is designed to keep logistics moving.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="trh-card p-6 hover:shadow-md transition group"
              >
                <div className="text-teal font-semibold text-sm">{`0${i + 1}`}</div>
                <div className="mt-3 h-11 w-11 rounded-md bg-teal/10 text-teal flex items-center justify-center group-hover:scale-105 transition">
                  <step.icon size={22} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-navy">{step.title}</h3>
                <p className="text-sm text-muted mt-1.5">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-wider text-teal font-semibold">Features</p>
            <h2 className="text-3xl md:text-4xl font-semibold text-navy mt-2">Built for modern logistics</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className="trh-card p-6 hover:-translate-y-1 hover:shadow-md transition group"
              >
                <div className="h-11 w-11 rounded-md bg-orange/10 text-orange flex items-center justify-center group-hover:scale-110 transition">
                  <f.icon size={22} />
                </div>
                <h3 className="mt-4 text-base font-semibold text-navy">{f.title}</h3>
                <p className="text-sm text-muted mt-1.5">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 md:py-20 bg-deepNavy text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" aria-hidden>
          <svg className="w-full h-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
            <defs>
              <pattern id="dots-dark" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="2" fill="white" />
              </pattern>
            </defs>
            <rect width="1000" height="400" fill="url(#dots-dark)" />
          </svg>
        </div>
        <div className="relative mx-auto max-w-7xl px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-3xl md:text-5xl font-semibold">
                <Counter value={s.value} suffix={s.suffix} prefix={s.prefix} />
              </div>
              <div className="text-white/70 text-sm mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 md:px-8 text-center">
          <h2 className="text-3xl md:text-5xl font-semibold text-navy tracking-tight">
            Ready to optimize your cargo journey?
          </h2>
          <p className="text-muted mt-4 max-w-xl mx-auto">
            Join hundreds of cargo owners and transport operators transforming empty capacity into opportunity.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/role-selection">
              <Button size="lg" variant="primary">
                Get Started
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/role-selection">
              <Button size="lg" variant="secondary">
                Browse Routes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-deepNavy text-white flex items-center justify-center text-xs font-bold">TRH</div>
            <span>Transit Route Hub · Cargo Space Aggregation Platform</span>
          </div>
          <div>© {new Date().getFullYear()} Transit Route Hub. Demo build.</div>
        </div>
      </footer>
    </div>
  );
}

const STEPS = [
  { title: 'Post Cargo', description: 'Tell us about your cargo, origin and destination.', icon: Package },
  { title: 'Find Available Space', description: 'Browse real-time availability from verified operators.', icon: Search },
  { title: 'Compare Routes', description: 'Match scores, prices, ETAs — side by side.', icon: BarChart3 },
  { title: 'Confirm Shipment', description: 'Book securely and track the entire journey.', icon: Truck },
];

const FEATURES = [
  { title: 'Smart Route Matching', description: 'Intelligent matching scores rank the best routes for your cargo.', icon: Search },
  { title: 'Cargo Space Optimization', description: 'Fill empty capacity and reduce wasted trips.', icon: Package },
  { title: 'Real-Time Availability', description: 'See live vehicle capacity and ETAs across operators.', icon: BarChart3 },
  { title: 'Cost Comparison', description: 'Compare price, ETA and capacity across multiple routes.', icon: BarChart3 },
  { title: 'Shipment Tracking', description: 'Follow your cargo from pickup to delivery.', icon: Truck },
  { title: 'Analytics Dashboard', description: 'Track savings, utilization and match performance.', icon: BarChart3 },
];

const STATS = [
  { value: 1280, suffix: '+', label: 'Available Routes' },
  { value: 4820, suffix: '+', label: 'Cargo Matches' },
  { value: 18, prefix: '₹', suffix: '.4L', label: 'Estimated Savings' },
  { value: 96, suffix: '%', label: 'Successful Matches' },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold text-navy mt-0.5">{value}</div>
    </div>
  );
}

function FloatingCard({
  className,
  title,
  value,
  accent,
}: {
  className?: string;
  title: string;
  value: string;
  accent: 'orange' | 'teal' | 'navy';
}) {
  const accents = {
    orange: 'bg-orange text-white',
    teal: 'bg-teal text-white',
    navy: 'bg-deepNavy text-white',
  } as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: [0, -6, 0] }}
      transition={{
        opacity: { duration: 0.6, delay: 0.4 },
        y: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
      }}
      className={`trh-card px-3 py-2 hidden sm:block shadow-md ${className ?? ''}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted">{title}</div>
      <div className={`mt-0.5 px-2 py-1 rounded-md text-xs font-semibold inline-block ${accents[accent]}`}>
        {value}
      </div>
    </motion.div>
  );
}