import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Configure your OralAssess AI preferences.</p>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <SettingsIcon className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display mt-4">Settings</CardTitle>
          <CardDescription>Profile, language defaults, institution details, and integrations.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
