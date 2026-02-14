import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Lock } from "lucide-react";

const VALID_CODE = "EDUCATOR2026";

interface TeacherAuthGateProps {
  children: React.ReactNode;
}

export function TeacherAuthGate({ children }: TeacherAuthGateProps) {
  const [authorized, setAuthorized] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().toUpperCase() === VALID_CODE) {
      setAuthorized(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (authorized) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-md items-start justify-center pt-16">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="font-display text-xl">Teacher Authorization</CardTitle>
          <CardDescription>Enter your authorization code to begin a new exam session.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-code">Authorization Code</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="auth-code"
                  type="password"
                  placeholder="Enter code…"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setError(false); }}
                  className="pl-10"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">Invalid authorization code. Please try again.</p>
              )}
            </div>
            <Button type="submit" className="w-full gap-2">
              <ShieldCheck className="h-4 w-4" /> Verify & Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
