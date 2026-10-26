import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { modulesForRole } from "@/lib/module-nav";
import { cn } from "@/lib/utils";
import { logout, useCurrentUser, useToken } from "@/lib/auth";
import { CARGO_CHANGED_EVENT, cargoPendingCount } from "@/lib/api";
import { ROLE_LABELS } from "@/domain/types";
import logoUrl from "@/assets/transitroutehub-logo.png";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
] as const;

/** The Transit Route Hub mark, served from the local bundle so it never depends on a CDN. */
function BrandMark() {
  return (
    <img
      src={logoUrl}
      alt="Transit Route Hub logo"
      width={36}
      height={36}
      className="size-9 rounded-md object-cover ring-1 ring-border/60"
    />
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const user = useCurrentUser();
  const navigate = useNavigate();
  // Only the modules that serve this role: a trader never sees route management
  // or the review queue, a provider never sees cargo search, and visitors see no
  // module list at all until they sign in.
  const modules = modulesForRole(user?.role ?? null);
  const token = useToken();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [pendingReviews, setPendingReviews] = useState(0);

  // Providers see how many cargo photos are waiting for them. One indexed count
  // per navigation, refreshed immediately when the workflow changes something.
  useEffect(() => {
    if (!token || (user?.role !== "provider" && user?.role !== "admin")) {
      setPendingReviews(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      void cargoPendingCount(token).then((result) => {
        if (!cancelled && result.ok) setPendingReviews(result.value);
      });
    };
    load();
    window.addEventListener(CARGO_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(CARGO_CHANGED_EVENT, load);
    };
  }, [token, user?.role, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-[linear-gradient(120deg,oklch(1_0_0_/_0.7),oklch(0.93_0.045_205_/_0.85)_45%,oklch(1_0_0_/_0.6))] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <BrandMark />
          <span className="font-display text-lg font-bold tracking-tight">Transit Route Hub</span>
        </Link>

        <nav aria-label="Primary" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {user ? (
          <div className="ml-auto flex items-center gap-2 md:ml-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name.split(" ")[0]}
              <span className="ml-1 hidden text-xs text-muted-foreground/80 lg:inline">
                · {ROLE_LABELS[user.role]}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                logout();
                navigate({ to: "/auth", replace: true });
              }}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <Button asChild size="sm" className="ml-auto md:ml-2">
            <Link to="/auth">Sign in</Link>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <Menu className="size-5" />
        </Button>
      </div>

      {modules.length > 0 ? (
        <div className="border-t border-border/60 bg-[oklch(1_0_0_/_0.35)]">
          <nav
            aria-label="Modules"
            className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span className="mr-1 hidden shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70 lg:inline">
              Your modules
            </span>
            {modules.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className="whitespace-nowrap rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "border-primary/50 bg-secondary text-foreground" }}
              >
                {item.short}
                {item.to === "/cargo-review" && pendingReviews > 0 ? (
                  <span
                    className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground"
                    aria-label={`${pendingReviews} awaiting review`}
                  >
                    {pendingReviews}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}

      <div
        id="mobile-nav"
        className={cn("border-t border-border md:hidden", open ? "block" : "hidden")}
      >
        <nav aria-label="Primary" className="mx-auto grid max-w-6xl gap-1 px-4 py-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
          {modules.length > 0 ? (
            <p className="mt-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
              {user ? `${ROLE_LABELS[user.role]} modules` : "Modules"}
            </p>
          ) : null}
          {modules.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              <item.icon className="size-4 shrink-0 text-primary/80" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
