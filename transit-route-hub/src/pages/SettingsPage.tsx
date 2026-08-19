import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Save, RefreshCw, AlertTriangle, User as UserIcon, Bell, Shield, Palette, Download, Upload } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { toast } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { storageService } from '../services/storageService';
import { sanitizeText, isPhone } from '../utils/validation';
import type { CargoPartyType, UserSettings } from '../types';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
] as const;

export function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const [active, setActive] = useState<typeof SECTIONS[number]['id']>('profile');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [company, setCompany] = useState(user?.companyName ?? '');
  const [cargoPartyType, setCargoPartyType] = useState<CargoPartyType>(user?.cargoPartyType ?? 'IMPORTER');
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const [prefs, setPrefs] = useState<UserSettings>(() =>
    (user && storageService.getSettings(user.id)) ?? {
      userId: user?.id ?? '',
      emailNotifications: true,
      pushNotifications: true,
      shipmentUpdates: true,
      routeMatches: true,
      darkMode: false,
      currency: 'INR',
    },
  );

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    const n = sanitizeText(name, 80);
    if (!n) return setError('Name is required.');
    if (!isPhone(phone)) return setError('Enter a valid phone number.');
    setError(null);
    updateProfile({ name: n, phone, companyName: company, cargoPartyType: user?.role === 'CARGO_OWNER' ? cargoPartyType : undefined });
    toast({ type: 'success', title: 'Profile updated' });
  }

  function savePrefs(next: Partial<UserSettings>) {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    if (user) {
      storageService.upsertSettings(merged);
      toast({ type: 'success', title: 'Settings saved' });
    }
  }

  function resetDemo() {
    storageService.resetDemoData();
    setResetOpen(false);
    toast({ type: 'info', title: 'Demo data reset', body: 'Reloading…' });
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, preferences and demo data." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <Card className="p-2 lg:p-3">
          <ul className="space-y-1">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${active === s.id ? 'bg-teal/10 text-teal' : 'text-navy hover:bg-background'}`}
                >
                  <s.icon size={16} />
                  {s.label}
                </button>
              </li>
            ))}
            <li className="pt-2 mt-2 border-t border-border">
              <button
                onClick={() => setResetOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-danger hover:bg-danger/10"
              >
                <RefreshCw size={16} /> Reset Demo Data
              </button>
            </li>
          </ul>
        </Card>

        <div className="lg:col-span-3 space-y-5">
          {active === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-6">
                <h3 className="trh-section-title">Profile</h3>
                <p className="text-xs text-muted mt-0.5 mb-5">Update your personal details.</p>
                <form onSubmit={saveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input id="name" label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
                  <Input id="email" label="Email" value={user?.email ?? ''} disabled />
                  <Input id="phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <Input id="company" label="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
                  <div className="md:col-span-2">
                    <Input id="role" label="Role" value={prettyRole(user?.role)} disabled />
                  </div>
                  {user?.role === 'CARGO_OWNER' && (
                    <div className="md:col-span-2">
                      <label className="trh-label">Cargo profile</label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button type="button" onClick={() => setCargoPartyType('IMPORTER')} className={`flex items-center gap-2 rounded-sm border p-3 text-left text-sm transition ${cargoPartyType === 'IMPORTER' ? 'border-orange bg-orange/5' : 'border-border hover:border-orange/40'}`}><Download size={16} className="text-orange" /><span><b className="text-navy">Importer</b><small className="block text-xs text-muted">Inbound cargo</small></span></button>
                        <button type="button" onClick={() => setCargoPartyType('EXPORTER')} className={`flex items-center gap-2 rounded-sm border p-3 text-left text-sm transition ${cargoPartyType === 'EXPORTER' ? 'border-orange bg-orange/5' : 'border-border hover:border-orange/40'}`}><Upload size={16} className="text-orange" /><span><b className="text-navy">Exporter</b><small className="block text-xs text-muted">Outbound cargo</small></span></button>
                      </div>
                    </div>
                  )}
                  {error && <div className="md:col-span-2 text-sm text-danger bg-danger/10 px-3 py-2 rounded-md">{error}</div>}
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit"><Save size={14} /> Save Changes</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}

          {active === 'notifications' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-6">
                <h3 className="trh-section-title">Notifications</h3>
                <p className="text-xs text-muted mt-0.5 mb-5">Choose what you want to be notified about.</p>
                <div className="space-y-4">
                  <Toggle label="Email notifications" value={prefs.emailNotifications} onChange={(v) => savePrefs({ emailNotifications: v })} />
                  <Toggle label="Push notifications" value={prefs.pushNotifications} onChange={(v) => savePrefs({ pushNotifications: v })} />
                  <Toggle label="Shipment updates" value={prefs.shipmentUpdates} onChange={(v) => savePrefs({ shipmentUpdates: v })} />
                  <Toggle label="Route matches" value={prefs.routeMatches} onChange={(v) => savePrefs({ routeMatches: v })} />
                </div>
              </Card>
            </motion.div>
          )}

          {active === 'security' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-6">
                <h3 className="trh-section-title">Security</h3>
                <p className="text-xs text-muted mt-0.5 mb-5">Demo authentication only. Replace with a secure backend in production.</p>
                <div className="p-4 rounded-md bg-warning/10 text-warning text-sm flex items-start gap-2">
                  <Shield size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Demo authentication</p>
                    <p>This app uses browser storage for demonstration. Do not use a real password here.</p>
                  </div>
                </div>
                <Button className="mt-5" variant="secondary">Change Password</Button>
              </Card>
            </motion.div>
          )}

          {active === 'appearance' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-6">
                <h3 className="trh-section-title">Appearance</h3>
                <p className="text-xs text-muted mt-0.5 mb-5">Customize how Transit Route Hub looks.</p>
                <Toggle label="Dark mode" value={prefs.darkMode} onChange={(v) => savePrefs({ darkMode: v })} />
                <div className="mt-5">
                  <label className="trh-label">Currency</label>
                  <select aria-label="Currency" title="Currency" className="trh-input" value={prefs.currency} onChange={(e) => savePrefs({ currency: e.target.value as 'INR' | 'USD' })}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <Drawer open={resetOpen} onClose={() => setResetOpen(false)} title="Reset Demo Data" width="sm">
        <div className="text-sm text-navy space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-md bg-warning/10 text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>This will remove all demo bookings, shipments and notifications. You will be logged out.</p>
          </div>
          <p>This action cannot be undone in this session.</p>
          <div className="flex gap-2 pt-3">
            <Button variant="secondary" block onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="danger" block onClick={resetDemo}>Reset</Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2">
      <span className="text-sm text-navy">{label}</span>
      <button
        type="button"
        aria-label={label}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${value ? 'bg-teal' : 'bg-border'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}

function prettyRole(role?: string) {
  if (role === 'CARGO_OWNER') return 'Cargo Owner';
  if (role === 'TRANSPORT_OPERATOR') return 'Transport Operator';
  if (role === 'ADMIN') return 'Admin';
  return 'Member';
}