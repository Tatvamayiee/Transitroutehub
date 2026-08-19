import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight, Boxes, Download, Upload } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ROLE_CONFIGS } from '../data/roles';
import type { CargoPartyType, UserRole } from '../types';

const ACCENTS = {
  orange: 'bg-orange/10 text-orange border-orange/20 hover:border-orange/50',
  cyan: 'bg-cyan/10 text-teal border-cyan/20 hover:border-cyan/50',
  teal: 'bg-teal/10 text-teal border-teal/20 hover:border-teal/50',
  navy: 'bg-deepNavy/10 text-deepNavy border-deepNavy/15 hover:border-deepNavy/40',
};

export function RoleSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [cargoPartyType, setCargoPartyType] = useState<CargoPartyType>();
  const [selectionError, setSelectionError] = useState<string | null>(null);

  function continueAs(role: UserRole) {
    if (role === 'CARGO_OWNER' && !cargoPartyType) {
      setSelectionError('Choose Importer or Exporter before continuing as a Cargo Owner.');
      return;
    }
    setSelectionError(null);
    navigate('/login/form', { state: { role, cargoPartyType: role === 'CARGO_OWNER' ? cargoPartyType : undefined, from: (location.state as { from?: string } | null)?.from } });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-deepNavy text-sm font-bold tracking-wide text-white">TRH</span>
            <span>
              <span className="block font-semibold leading-none text-navy">Transit Route Hub</span>
              <span className="mt-1 block text-[10px] uppercase tracking-wider text-muted">Cargo marketplace</span>
            </span>
          </button>
          <span className="hidden text-xs text-muted sm:block">One platform. Four ways to move.</span>
        </header>

        <section className="mx-auto max-w-3xl py-14 text-center md:py-20">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Boxes size={24} />
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-teal">Welcome to the network</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-navy md:text-5xl">How will you use Transit Route Hub?</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted md:text-base">Choose the way you use the platform. You can change your capabilities later.</p>
          </motion.div>
        </section>

        <section className="grid gap-5 md:grid-cols-2" aria-label="Choose your role">
          {ROLE_CONFIGS.map((config, index) => {
            const Icon = config.icon;
            return (
              <motion.button
                key={config.role}
                type="button"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.06 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => continueAs(config.role)}
                className={`group rounded-lg border bg-white p-6 text-left shadow-subtle transition hover:shadow-md ${ACCENTS[config.accent]}`}
              >
                <div className="flex items-start justify-between gap-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-current/10 transition group-hover:scale-105">
                    <Icon size={24} />
                  </div>
                  <ArrowRight size={20} className="text-muted transition group-hover:translate-x-1 group-hover:text-navy" />
                </div>
                <h2 className="mt-6 text-lg font-semibold uppercase tracking-wide text-navy">{config.title}</h2>
                <p className="mt-2 text-sm font-medium text-navy">{config.description}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{config.detail}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-navy">{config.selectionTitle} <ArrowRight size={15} /></span>
              </motion.button>
            );
          })}
        </section>

        <section className="mx-auto mt-7 max-w-2xl rounded-lg border border-orange/20 bg-white p-5 shadow-subtle" aria-labelledby="cargo-direction-title">
          <div className="text-center">
            <p id="cargo-direction-title" className="text-sm font-semibold text-navy">Cargo owner profile</p>
            <p className="mt-1 text-xs text-muted">Choose whether you are importing cargo into your market or exporting it to a destination.</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setCargoPartyType('IMPORTER')} className={`flex items-center gap-3 rounded-sm border p-3 text-left transition ${cargoPartyType === 'IMPORTER' ? 'border-orange bg-orange/5 ring-2 ring-orange/10' : 'border-border hover:border-orange/40'}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-orange/10 text-orange"><Download size={17} /></span>
              <span><span className="block text-sm font-semibold text-navy">Importer</span><span className="block text-xs text-muted">Bring cargo into your market</span></span>
            </button>
            <button type="button" onClick={() => setCargoPartyType('EXPORTER')} className={`flex items-center gap-3 rounded-sm border p-3 text-left transition ${cargoPartyType === 'EXPORTER' ? 'border-orange bg-orange/5 ring-2 ring-orange/10' : 'border-border hover:border-orange/40'}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-orange/10 text-orange"><Upload size={17} /></span>
              <span><span className="block text-sm font-semibold text-navy">Exporter</span><span className="block text-xs text-muted">Send cargo to its destination</span></span>
            </button>
          </div>
          {selectionError && <p className="mt-3 text-center text-xs font-medium text-danger" role="alert">{selectionError}</p>}
        </section>

        <p className="mt-10 text-center text-xs text-muted">Demo frontend authentication. Production deployments should use secure server sessions.</p>
      </div>
    </main>
  );
}
