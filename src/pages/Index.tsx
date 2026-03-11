import { Plus, Mic, TrendingUp, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardSkeleton } from "@/components/PageSkeleton";

const statusConfig = {
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
  pending_review: { label: "Pending Review", className: "bg-warning/10 text-warning border-warning/20" },
  in_progress: { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" },
};

export default function DashboardPage() {
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <DashboardSkeleton />;

  const totalExams = exams.length;
  const avgScore = totalExams > 0
    ? (exams.reduce((s, e) => s + Number(e.overall_score), 0) / totalExams).toFixed(1)
    : "—";

  const stats = [
    { label: "Total Exams", value: String(totalExams), icon: Mic, trend: "Signed reports" },
    { label: "Avg. Score", value: totalExams > 0 ? `${avgScore}/5` : "—", icon: TrendingUp, trend: "Overall average" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Here's your exam overview.</p>
        </div>
        <Button asChild size="lg" className="gap-2 w-full sm:w-auto">
          <Link to="/new-exam">
            <Plus className="h-4 w-4" /> Start New Exam
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {stats.map((stat) => (
          <Card key={stat.label} className="transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-3">
                <p className="font-display text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Exams */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Recent Exams</CardTitle>
          <CardDescription>Your latest signed examination reports</CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No exams yet. Start your first exam session!</p>
              <Button asChild variant="outline" className="mt-3 gap-2">
                <Link to="/new-exam"><Plus className="h-4 w-4" /> New Exam</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => {
                const status = statusConfig[exam.status as keyof typeof statusConfig] || statusConfig.completed;
                return (
                  <div
                    key={exam.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium truncate">{exam.title}</h3>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {exam.institution || "—"} · {exam.group || "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <Badge variant="secondary">{exam.level_code}</Badge>
                      <Badge variant="outline">{exam.language}</Badge>
                      <span className="font-display font-bold text-foreground">{Number(exam.overall_score).toFixed(1)}/5</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {new Date(exam.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
