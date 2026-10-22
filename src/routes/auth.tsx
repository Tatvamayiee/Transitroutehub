import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { registerUser, loginUser, ROLE_LABELS, type UserRole } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In or Register — Transit Route Hub" },
      {
        name: "description",
        content:
          "Secure login and registration for traders, logistics providers and administrators on Transit Route Hub.",
      },
      { property: "og:title", content: "Sign In or Register — Transit Route Hub" },
      {
        property: "og:description",
        content: "Role-based access for traders, logistics providers and platform administrators.",
      },
    ],
  }),
  component: AuthPage,
});

const ROLES: UserRole[] = ["trader", "provider", "admin"];

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState<UserRole>("trader");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  async function signIn(email: string, password: string) {
    setBusy(true);
    const res = await loginUser(email, password);
    setBusy(false);
    if (!res.ok) {
      toast.error(mapAuthError(res));
      return;
    }
    toast.success(`Welcome back, ${res.value.user.name}`);
    navigate({ to: "/dashboard" });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await signIn(loginEmail, loginPassword);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await registerUser({ name, email, company, role, password, confirm });
    setBusy(false);
    if (!res.ok) {
      toast.error(mapAuthError(res));
      return;
    }
    toast.success("Account created — you are signed in.");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="font-display text-2xl font-bold tracking-tight">Account access</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Secure registration and role-based login. Credentials are verified on the server and never
        stored on this device.
      </p>

      <Tabs defaultValue="login" className="mt-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Sign in</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Access your dashboard for bookings and listings.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleLogin}>
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    maxLength={255}
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    maxLength={128}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? "Checking…" : "Sign in"}
                </Button>
                <Link
                  to="/forgot-password"
                  className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </form>

              <div className="mt-6 rounded-lg border border-dashed border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Demo accounts · password demo1234
                </p>
                <div className="mt-2 grid gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void signIn("trader@trh.demo", "demo1234")}
                  >
                    Sign in as trader
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void signIn("provider@trh.demo", "demo1234")}
                  >
                    Sign in as provider
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void signIn("admin@trh.demo", "demo1234")}
                  >
                    Sign in as administrator
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Create account</CardTitle>
              <CardDescription>Choose the role that matches how you use the hub.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleRegister}>
                <div className="grid gap-2">
                  <Label htmlFor="reg-name">Full name</Label>
                  <Input
                    id="reg-name"
                    maxLength={100}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    maxLength={255}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-company">Company</Label>
                  <Input
                    id="reg-company"
                    maxLength={120}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <RadioGroup
                    value={role}
                    onValueChange={(v) => setRole(v as UserRole)}
                    className="grid gap-2"
                  >
                    {ROLES.map((r) => (
                      <label
                        key={r}
                        className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 text-sm"
                      >
                        <RadioGroupItem value={r} id={`role-${r}`} />
                        {ROLE_LABELS[r]}
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-confirm">Confirm password</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    autoComplete="new-password"
                    maxLength={128}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function mapAuthError(res: { ok: false; code?: string; message: string }) {
  // Map stable server error codes to friendly messages, but keep them generic
  // enough to avoid user enumeration.
  return res.message;
}
