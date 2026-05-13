import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Loader2 } from "lucide-react";
import { useRoles, type AppRole } from "@/hooks/useRoles";

interface RoleGateProps {
  role: AppRole;
  children: React.ReactNode;
}

export function RoleGate({ role, children }: RoleGateProps) {
  const { roles, loading } = useRoles();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking permissions…
      </div>
    );
  }

  if (!roles.includes(role)) {
    return (
      <div className="mx-auto flex max-w-md items-start justify-center pt-16">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="font-display text-xl">Access restricted</CardTitle>
            <CardDescription>
              You need the <span className="font-semibold">{role}</span> role to access this area.
              Ask an administrator to grant you access from Settings → Team.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
