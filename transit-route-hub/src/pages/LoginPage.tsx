import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { toast } from '../components/ui/Toast';
import { isEmail } from '../utils/validation';
import { getRoleConfig } from '../data/roles';
import type { CargoPartyType, UserRole } from '../types';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const selectedRole = (location.state as { role?: UserRole } | null)?.role;
  const initialCargoPartyType = (location.state as { cargoPartyType?: CargoPartyType } | null)?.cargoPartyType;
  const [cargoPartyType, setCargoPartyType] = useState<CargoPartyType | undefined>(initialCargoPartyType);
  const roleConfig = getRoleConfig(selectedRole);
  const RoleIcon = roleConfig.icon;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 4) {
      setError('Please enter your password.');
      return;
    }
    try {
      setLoading(true);
      if (roleConfig.role === 'CARGO_OWNER' && !cargoPartyType) {
        setError('Choose Importer or Exporter to continue.');
        return;
      }
      await login(email, password, selectedRole, cargoPartyType);
      toast({ type: 'success', title: 'Welcome back!' });
      const redirect = (location.state as { from?: string } | null)?.from ?? roleLandingPath(roleConfig.role);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    const demoEmails: Record<UserRole, string> = {
      CARGO_OWNER: 'demo@trh.app',
      BOOKER: 'booker@trh.app',
      INTERMEDIARY: 'intermediary@trh.app',
      TRANSPORT_OPERATOR: 'operator@trh.demo',
      ADMIN: 'demo@trh.app',
    };
    setEmail(demoEmails[roleConfig.role]);
    setPassword('Demo@1234');
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-deepNavy text-white p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20" aria-hidden>
          <svg className="w-full h-full" viewBox="0 0 600 800" preserveAspectRatio="none">
            <defs>
              <pattern id="dots-login" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#08A6A6" />
              </pattern>
            </defs>
            <rect width="600" height="800" fill="url(#dots-login)" />
          </svg>
        </div>
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-teal/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-10 w-96 h-96 bg-orange/20 rounded-full blur-3xl" />

        <Link to="/" className="relative flex items-center gap-3 z-10">
          <div className="h-10 w-10 rounded-md bg-white/10 backdrop-blur flex items-center justify-center font-bold">
            TRH
          </div>
          <div>
            <div className="font-semibold">Transit Route Hub</div>
            <div className="text-xs text-white/70">Cargo Space Aggregation Platform</div>
          </div>
        </Link>

        <div className="relative z-10 max-w-md">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-semibold leading-tight tracking-tight"
          >
            {roleConfig.loginTitle}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-white/70 mt-4"
          >
            {roleConfig.loginSubtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-12 relative h-32"
          >
            <svg viewBox="0 0 400 120" className="absolute inset-0 w-full h-full" aria-hidden>
              <path d="M 20 80 Q 100 20, 200 70 T 380 60" stroke="#08A6A6" strokeWidth="2" fill="none" />
              <circle cx="20" cy="80" r="5" fill="#14C8C8" />
              <circle cx="380" cy="60" r="5" fill="#FF8A34" />
            </svg>
            <motion.div
              className="absolute"
              animate={{ left: ['5%', '85%'] }}
              transition={{ duration: 6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
              style={{ top: 36 }}
            >
              <div className="px-2 py-1 rounded-sm bg-white text-deepNavy text-xs font-semibold">TRH · MATCH</div>
            </motion.div>
          </motion.div>
        </div>

        <div className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} Transit Route Hub. Demo build.
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 lg:hidden">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-md bg-deepNavy text-white font-bold flex items-center justify-center text-sm">TRH</div>
              <span className="font-semibold text-navy">Transit Route Hub</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-sm bg-teal/10 text-teal flex items-center justify-center"><RoleIcon size={20} /></div>
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold text-navy tracking-tight">{cargoPartyType === 'IMPORTER' ? 'Move imported cargo smarter.' : cargoPartyType === 'EXPORTER' ? 'Export your cargo with confidence.' : roleConfig.loginTitle}</h2>
              <p className="text-muted mt-1.5 text-sm">{roleConfig.loginSubtitle}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
            {roleConfig.role === 'CARGO_OWNER' && (
              <div className="rounded-sm border border-orange/20 bg-orange/5 p-4">
                <p className="text-sm font-semibold text-navy">Are you importing or exporting?</p>
                <p className="mt-1 text-xs text-muted">Choose the cargo direction for this account.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(['IMPORTER', 'EXPORTER'] as CargoPartyType[]).map((type) => (
                    <button key={type} type="button" onClick={() => setCargoPartyType(type)} className={`rounded-sm border px-3 py-2 text-xs font-semibold transition ${cargoPartyType === type ? 'border-orange bg-orange text-white' : 'border-border bg-white text-navy hover:border-orange/50'}`}>
                      {type === 'IMPORTER' ? 'Importer' : 'Exporter'}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Input
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              placeholder="you@company.com"
              icon={<Mail size={16} />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              placeholder="Enter your password"
              icon={<Lock size={16} />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-between text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-teal focus:ring-teal"
                />
                <span className="text-muted">Remember me</span>
              </label>
              <button type="button" className="text-teal hover:underline font-medium">Forgot password?</button>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-danger/10 text-danger text-sm" role="alert">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" variant="primary" block loading={loading}>
              {loading ? <Loader2 className="animate-spin" size={16} /> : null}
              {roleConfig.primaryAction}
            </Button>

            <button
              type="button"
              onClick={fillDemo}
              className="text-xs text-teal hover:underline w-full text-center"
            >
              Use demo credentials
            </button>

            <p className="text-sm text-center text-muted">
              Don't have an account?{' '}
              <Link to="/register" state={{ role: roleConfig.role, cargoPartyType }} className="text-teal font-semibold hover:underline">
                {roleConfig.registerAction}
              </Link>
            </p>
            <Link to="/role-selection" className="block text-center text-xs text-muted hover:text-navy">Back to role selection</Link>
          </form>
        </motion.div>
      </div>
    </div>
  );
}

function roleLandingPath(role: UserRole): string {
  if (role === 'INTERMEDIARY') return '/matching-center';
  if (role === 'TRANSPORT_OPERATOR') return '/routes';
  if (role === 'BOOKER') return '/find-space';
  return '/dashboard';
}