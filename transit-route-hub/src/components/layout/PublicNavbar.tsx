import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  { label: 'Find Space', href: '/#find-space' },
  { label: 'How It Works', href: '/#how' },
  { label: 'Features', href: '/#features' },
  { label: 'About', href: '/#about' },
];

export function PublicNavbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-border">
      <nav className="mx-auto max-w-7xl px-4 md:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: -6 }}
            className="h-9 w-9 rounded-md bg-deepNavy text-white font-bold flex items-center justify-center text-sm tracking-wider"
          >
            TRH
          </motion.div>
          <div>
            <div className="text-navy font-semibold leading-none">Transit Route Hub</div>
            <div className="text-[10px] text-muted mt-0.5 tracking-wide uppercase">Cargo Marketplace</div>
          </div>
        </Link>
        <ul className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="px-3 py-2 text-sm text-navy hover:text-teal transition">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="hidden md:flex items-center gap-2">
          <Link to="/login" className="trh-btn-ghost text-sm">Sign In</Link>
          <Link to="/role-selection" className="trh-btn-primary text-sm">Get Started</Link>
        </div>
        <button
          aria-label="Toggle menu"
          className="md:hidden p-2 rounded-md hover:bg-background"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="md:hidden border-t border-border bg-white overflow-hidden"
        >
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-sm rounded-md hover:bg-background text-navy"
              >
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 mt-2">
              <Link to="/login" className="trh-btn-secondary flex-1">Sign In</Link>
              <Link to="/role-selection" className="trh-btn-primary flex-1">Get Started</Link>
            </div>
          </div>
        </motion.div>
      )}
    </header>
  );
}