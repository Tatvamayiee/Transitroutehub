import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, CheckCircle2, Package, MapPin, Truck, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import { cargoService, routeService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import {
  isPositiveNumber,
  isValidDate,
  isDeliveryAfterPickup,
  isFutureDate,
  sanitizeText,
} from '../utils/validation';
import { formatDate } from '../utils/format';
import type { CargoType } from '../types';

interface WizardState {
  // step 1
  type: CargoType;
  description: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  quantity: string;
  fragile: boolean;
  hazardous: boolean;
  // step 2
  origin: string;
  destination: string;
  pickupDate: string;
  deliveryDate: string;
  // step 3
  vehiclePreference: string;
  budget: string;
  specialRequirements: string;
}

const INITIAL: WizardState = {
  type: 'General',
  description: '',
  weight: '',
  length: '',
  width: '',
  height: '',
  quantity: '1',
  fragile: false,
  hazardous: false,
  origin: '',
  destination: '',
  pickupDate: '',
  deliveryDate: '',
  vehiclePreference: '',
  budget: '',
  specialRequirements: '',
};

const STEPS = [
  { key: 'details', label: 'Cargo Details', icon: Package },
  { key: 'pickup', label: 'Pickup & Delivery', icon: MapPin },
  { key: 'prefs', label: 'Preferences', icon: Truck },
] as const;

export function PostCargoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!sanitizeText(state.description, 200)) return 'Cargo description is required.';
      if (!isPositiveNumber(Number(state.weight))) return 'Enter a valid weight (greater than 0).';
      if (Number(state.weight) > 50) return 'Weight above 50 t requires special handling.';
      if (!isPositiveNumber(Number(state.length)) || !isPositiveNumber(Number(state.width)) || !isPositiveNumber(Number(state.height))) {
        return 'Enter valid dimensions (greater than 0).';
      }
      if (Number(state.quantity) < 1) return 'Quantity must be at least 1.';
      if (state.hazardous && state.fragile) return 'Cargo cannot be both hazardous and fragile.';
    }
    if (step === 1) {
      if (!sanitizeText(state.origin, 80)) return 'Pickup location is required.';
      if (!sanitizeText(state.destination, 80)) return 'Destination is required.';
      if (state.origin.toLowerCase() === state.destination.toLowerCase()) return 'Origin and destination must differ.';
      if (!isValidDate(state.pickupDate)) return 'Pickup date is required.';
      if (!isValidDate(state.deliveryDate)) return 'Delivery date is required.';
      if (!isDeliveryAfterPickup(state.pickupDate, state.deliveryDate)) return 'Delivery date must be after pickup date.';
      if (!isFutureDate(state.pickupDate)) return 'Pickup date cannot be in the past.';
    }
    if (step === 2) {
      if (state.budget && Number(state.budget) < 0) return 'Budget cannot be negative.';
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const err = validateStep();
    if (err) { setError(err); return; }
    if (!user) return;
    setSearching(true);
    setTimeout(() => {
      const cargo = cargoService.add({
        ownerId: user.id,
        type: state.type,
        description: sanitizeText(state.description, 200),
        weight: Number(state.weight),
        dimensions: { length: Number(state.length), width: Number(state.width), height: Number(state.height) },
        quantity: Number(state.quantity),
        fragile: state.fragile,
        hazardous: state.hazardous,
        origin: sanitizeText(state.origin, 80),
        destination: sanitizeText(state.destination, 80),
        pickupDate: new Date(state.pickupDate).toISOString(),
        deliveryDate: new Date(state.deliveryDate).toISOString(),
        budget: Number(state.budget) || 0,
        vehiclePreference: state.vehiclePreference || undefined,
        specialRequirements: state.specialRequirements ? sanitizeText(state.specialRequirements, 300) : undefined,
      });
      const matches = routeService.search({
        origin: cargo.origin,
        destination: cargo.destination,
        weight: cargo.weight,
        vehicleType: state.vehiclePreference || undefined,
      });
      toast({
        type: 'success',
        title: 'Cargo posted',
        body: `${matches.length} matching routes found.`,
      });
      setSearching(false);
      navigate(`/find-space?origin=${encodeURIComponent(cargo.origin)}&destination=${encodeURIComponent(cargo.destination)}&weight=${cargo.weight}&cargoType=${encodeURIComponent(cargo.type)}&date=${encodeURIComponent(cargo.pickupDate.slice(0, 10))}`);
    }, 900);
  }

  return (
    <div>
      <PageHeader
        title="Post Cargo"
        subtitle="Tell us about your shipment. We'll match it with available transport."
        actions={
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </Button>
        }
      />

      {/* Stepper */}
      <ol className="grid grid-cols-3 gap-3 mb-5">
        {STEPS.map((s, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li
              key={s.key}
              className={`flex items-center gap-3 p-3 rounded-md border ${active ? 'border-teal bg-teal/5' : done ? 'border-success/40 bg-success/5' : 'border-border bg-white'}`}
            >
              <div className={`h-9 w-9 rounded-md flex items-center justify-center text-sm font-semibold ${active ? 'bg-teal text-white' : done ? 'bg-success text-white' : 'bg-border text-muted'}`}>
                {done ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <div>
                <p className="text-xs text-muted">Step {i + 1}</p>
                <p className={`text-sm font-semibold ${active ? 'text-navy' : done ? 'text-success' : 'text-navy'}`}>{s.label}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <Card className="p-6">
        <form onSubmit={submit}>
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select id="ctype" label="Cargo Type" value={state.type} onChange={(e) => update('type', e.target.value as CargoType)}>
                  {['General', 'Fragile', 'Refrigerated', 'Hazardous', 'Bulk', 'Liquid'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
                <Input id="qty" type="number" min="1" label="Quantity" value={state.quantity} onChange={(e) => update('quantity', e.target.value)} />
                <div className="md:col-span-2">
                  <Input id="desc" label="Description" placeholder="e.g. Palletized FMCG goods" value={state.description} onChange={(e) => update('description', e.target.value)} required />
                </div>
                <Input id="weight" type="number" min="0" step="0.1" label="Weight (tons)" placeholder="2.5" value={state.weight} onChange={(e) => update('weight', e.target.value)} required />
                <div className="grid grid-cols-3 gap-3">
                  <Input id="l" type="number" min="0" label="L (cm)" placeholder="180" value={state.length} onChange={(e) => update('length', e.target.value)} required />
                  <Input id="w" type="number" min="0" label="W (cm)" placeholder="120" value={state.width} onChange={(e) => update('width', e.target.value)} required />
                  <Input id="h" type="number" min="0" label="H (cm)" placeholder="150" value={state.height} onChange={(e) => update('height', e.target.value)} required />
                </div>
                <label className="inline-flex items-center gap-2 mt-2 text-sm text-navy">
                  <input type="checkbox" className="h-4 w-4 rounded border-border text-teal" checked={state.fragile} onChange={(e) => update('fragile', e.target.checked)} />
                  Fragile cargo
                </label>
                <label className="inline-flex items-center gap-2 mt-2 text-sm text-navy">
                  <input type="checkbox" className="h-4 w-4 rounded border-border text-teal" checked={state.hazardous} onChange={(e) => update('hazardous', e.target.checked)} />
                  Hazardous materials
                </label>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input id="origin" label="Pickup Location" placeholder="Chennai" value={state.origin} onChange={(e) => update('origin', e.target.value)} required />
                <Input id="destination" label="Destination" placeholder="Bengaluru" value={state.destination} onChange={(e) => update('destination', e.target.value)} required />
                <Input id="pdate" type="date" label="Pickup Date" value={state.pickupDate} onChange={(e) => update('pickupDate', e.target.value)} required />
                <Input id="ddate" type="date" label="Preferred Delivery Date" value={state.deliveryDate} onChange={(e) => update('deliveryDate', e.target.value)} required />
                <div className="md:col-span-2 text-xs text-muted bg-background px-3 py-2 rounded-md">
                  Selected: <b>{state.pickupDate ? formatDate(state.pickupDate, false) : '—'}</b> → <b>{state.deliveryDate ? formatDate(state.deliveryDate, false) : '—'}</b>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select id="vehicle" label="Vehicle Type" value={state.vehiclePreference} onChange={(e) => update('vehiclePreference', e.target.value)}>
                  <option value="">No preference</option>
                  {['Mini Truck', 'Truck', 'Trailer', 'Container', 'Tanker'].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </Select>
                <Input id="budget" type="number" min="0" label="Budget (₹)" placeholder="10000" value={state.budget} onChange={(e) => update('budget', e.target.value)} />
                <div className="md:col-span-2">
                  <label className="trh-label">Special Requirements</label>
                  <textarea
                    rows={4}
                    placeholder="e.g. Temperature-controlled, security seal, etc."
                    className="trh-input"
                    value={state.specialRequirements}
                    onChange={(e) => update('specialRequirements', e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-danger/10 text-danger text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={back} disabled={step === 0}>
              <ArrowLeft size={14} /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" onClick={next}>
                Continue <ArrowRight size={14} />
              </Button>
            ) : (
              <Button type="submit" variant="primary" loading={searching}>
                Find Matching Routes
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}