import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">View and export assessment reports.</p>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display mt-4">Reports</CardTitle>
          <CardDescription>Coming in Phase 6 — interactive reports with color-coded evidence and PDF export.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
