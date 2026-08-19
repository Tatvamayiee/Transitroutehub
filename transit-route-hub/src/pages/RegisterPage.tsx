import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User as UserIcon, Mail, Phone, Lock, AlertCircle, Loader2, Truck, Package } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { toast } from '../components/ui/Toast';
import {
  isEmail,
  isPhone,
  passwordStrength,
  matchPassword,
  sanitizeText,
} from '../utils/validation';
import type { CargoPartyType, UserRole } from '../types';
import { getRoleConfig } from '../data/roles';

interface FormState {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  companyName: string;
}

const INITIAL: FormState = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  role: 'CARGO_OWNER',
  companyName: '',
};

export function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const selectedRole = (location.state as { role?: UserRole } | null)?.role;
  const cargoPartyType = (location.state as { cargoPartyType?: CargoPartyType } | null)?.cargoPartyType;
  const roleConfig = getRoleConfig(selectedRole);
  const [form, setForm] = useState<FormState>({ ...INITIAL, role: selectedRole ?? INITIAL.role });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const name = sanitizeText(form.name, 80);
    const email = sanitizeText(form.email, 120);
    const phone = sanitizeText(form.phone, 20);
    if (!name) return setError('Name is required.');
    if (!isEmail(email)) return setError('Please enter a valid email address.');
    if (!isPhone(phone)) return setError('Please enter a valid phone number.');
    if (!strength.ok) return setError('Password must be at least 8 characters and include letters and numbers.');
    if (!matchPassword(form.password, form.confirmPassword)) return setError('Passwords do not match.');
    try {
      setLoading(true);
      await register({
        name,
        email,
        phone,
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role,
        cargoPartyType: form.role === 'CARGO_OWNER' ? cargoPartyType : undefined,
        companyName: form.companyName,
      });
      toast({ type: 'success', title: 'Account created!', body: 'Welcome to Transit Route Hub.' });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl"
      >
        <Link to="/" className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-md bg-deepNavy text-white font-bold flex items-center justify-center text-sm">TRH</div>
          <span className="font-semibold text-navy">Transit Route Hub</span>
        </Link>
        <div className="trh-card p-7 md:p-8">
          <h2 className="text-2xl font-semibold text-navy tracking-tight">Create your {roleConfig.title.toLowerCase()} account</h2>
          <p className="text-muted mt-1 text-sm">Set up your role on the cargo space aggregation platform.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                id="name"
                label="Full Name"
                placeholder="Jane Doe"
                icon={<UserIcon size={16} />}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                required
              />
              <Input
                id="phone"
                label="Phone"
                placeholder="+91 98765 43210"
                icon={<Phone size={16} />}
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                required
              />
            </div>
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="you@company.com"
              icon={<Mail size={16} />}
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              required
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                id="password"
                type="password"
                label="Password"
                placeholder="Create a password"
                icon={<Lock size={16} />}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
              />
              <Input
                id="confirm"
                type="password"
                label="Confirm Password"
                placeholder="Repeat password"
                icon={<Lock size={16} />}
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                required
              />
            </div>
            {form.password && (
              <div className="text-xs text-muted">
                {strength.ok ? (
                  <span className="text-success font-medium">Strong password.</span>
                ) : (
                  <span>Needs: {strength.issues.join(', ')}.</span>
                )}
              </div>
            )}

            <Select
              id="role"
              label="Account Type"
              value={form.role}
              onChange={(e) => update('role', e.target.value as UserRole)}
            >
              <option value="CARGO_OWNER">Cargo Owner</option>
              <option value="BOOKER">Cargo Booker</option>
              <option value="INTERMEDIARY">Intermediary</option>
              <option value="TRANSPORT_OPERATOR">Transport Operator</option>
            </Select>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => update('role', 'CARGO_OWNER')}
                className={`text-left p-4 rounded-md border transition ${form.role === 'CARGO_OWNER' ? 'border-teal bg-teal/5' : 'border-border bg-white hover:bg-background'}`}
              >
                <div className="flex items-center gap-2 text-navy font-semibold text-sm">
                  <Package size={16} className="text-teal" /> Cargo Owner
                </div>
                <p className="text-xs text-muted mt-1">Find space for your cargo.</p>
              </button>
              <button
                type="button"
                onClick={() => update('role', 'TRANSPORT_OPERATOR')}
                className={`text-left p-4 rounded-md border transition ${form.role === 'TRANSPORT_OPERATOR' ? 'border-teal bg-teal/5' : 'border-border bg-white hover:bg-background'}`}
              >
                <div className="flex items-center gap-2 text-navy font-semibold text-sm">
                  <Truck size={16} className="text-orange" /> Transport Operator
                </div>
                <p className="text-xs text-muted mt-1">Publish routes & fill space.</p>
              </button>
            </div>

            <Input
              id="company"
              label="Company Name (optional)"
              placeholder="Your company"
              value={form.companyName}
              onChange={(e) => update('companyName', e.target.value)}
            />

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-danger/10 text-danger text-sm" role="alert">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" block loading={loading}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              Create Account
            </Button>

            <p className="text-sm text-center text-muted">
              Already have an account?{' '}
              <Link to="/login" className="text-teal font-semibold hover:underline">Sign In</Link>
            </p>
            <Link to="/role-selection" className="block text-center text-xs text-muted hover:text-navy">Back to role selection</Link>
          </form>
        </div>
      </motion.div>
    </div>
  );
}