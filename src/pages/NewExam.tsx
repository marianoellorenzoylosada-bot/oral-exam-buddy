import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic } from "lucide-react";

export default function NewExamPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">New Exam</h1>
        <p className="mt-1 text-muted-foreground">Configure and start a new oral examination session.</p>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Mic className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display mt-4">Exam Setup Wizard</CardTitle>
          <CardDescription>Coming in Phase 2 — set title, upload booklet & rubric, configure candidates.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
