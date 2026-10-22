import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPassword } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Transit Route Hub" },
      {
        name: "description",
        content:
          "Password recovery for Transit Route Hub accounts using your registered email address.",
      },
      { property: "og:title", content: "Reset Password — Transit Route Hub" },
      {
        property: "og:description",
        content: "Set a new password for your trader, provider or admin account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await resetPassword(email, password, confirm);
    setBusy(false);
    if (!res.ok) {
      toast.error(mapResetError(res));
      return;
    }
    toast.success("If that email exists, a new password has been set. Please sign in.");
    navigate({ to: "/auth" });
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <h1 className="font-display text-2xl font-bold tracking-tight">Forgot password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Verify your registered email and set a new password. If the email exists, any active
        sessions for that account are ended.
      </p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            The new password is hashed on the server before it is saved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <Label htmlFor="fp-email">Registered email</Label>
              <Input
                id="fp-email"
                type="email"
                maxLength={255}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fp-password">New password</Label>
              <Input
                id="fp-password"
                type="password"
                autoComplete="new-password"
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fp-confirm">Confirm new password</Label>
              <Input
                id="fp-confirm"
                type="password"
                autoComplete="new-password"
                maxLength={128}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function mapResetError(res: { ok: false; code?: string; message: string }) {
  return res.message;
}
