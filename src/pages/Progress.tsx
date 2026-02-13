import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Progress</h1>
        <p className="mt-1 text-muted-foreground">Track student performance over time.</p>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <TrendingUp className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display mt-4">Progress Tracking</CardTitle>
          <CardDescription>Coming in Phase 8 — radar charts and trend lines for longitudinal analysis.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
