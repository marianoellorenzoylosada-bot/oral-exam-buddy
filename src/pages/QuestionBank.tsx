import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function QuestionBankPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Question Bank</h1>
        <p className="mt-1 text-muted-foreground">Manage your exam booklets and rubric templates.</p>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display mt-4">Question Bank</CardTitle>
          <CardDescription>Coming in Phase 2 — upload and manage booklets, rubrics, and templates.</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </div>
  );
}
