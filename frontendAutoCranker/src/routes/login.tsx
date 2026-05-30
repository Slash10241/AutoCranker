import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/owner" });
  };

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Brand />
        <Link to="/" className="font-mono text-xs uppercase text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 inline h-3 w-3" /> Back
        </Link>
      </header>

      <main className="mx-auto grid max-w-md px-6 py-12">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber">// Garage access</p>
        <h1 className="mt-3 text-3xl font-bold">
          {mode === "login" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage your shop and your team.
          <span className="ml-1 italic">(Demo — any details work.)</span>
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border border-border bg-surface p-6">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Garage name</Label>
              <Input id="name" defaultValue="Iron & Oil Garage" className="mt-1" />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="demo@autocranker.app" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" defaultValue="••••••••" className="mt-1" />
          </div>
          <Button type="submit" className="w-full bg-amber text-[color:var(--amber-foreground)] hover:bg-amber/90">
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            className="w-full text-center font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-amber"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Need an account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
