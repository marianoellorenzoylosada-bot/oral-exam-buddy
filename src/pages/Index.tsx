import { Plus, Mic, FileText, TrendingUp, Clock, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stats = [
  { label: "Total Exams", value: "24", icon: Mic, trend: "+3 this week" },
  { label: "Students Assessed", value: "72", icon: Users, trend: "+12 this month" },
  { label: "Reports Generated", value: "18", icon: FileText, trend: "6 pending" },
  { label: "Avg. Score", value: "74%", icon: TrendingUp, trend: "+2% vs last month" },
];

const recentExams = [
  { id: 1, title: "B2 Speaking Part 3", institution: "Cambridge Academy", group: "Group A", date: "2026-02-12", candidates: 3, status: "completed" as const },
  { id: 2, title: "DELE B1 Oral", institution: "Instituto Cervantes", group: "Afternoon", date: "2026-02-11", candidates: 3, status: "pending_review" as const },
  { id: 3, title: "DELF A2 Production Orale", institution: "Alliance Française", group: "Beginners", date: "2026-02-10", candidates: 2, status: "completed" as const },
  { id: 4, title: "Goethe B1 Mündlich", institution: "Goethe-Institut", group: "Intensive", date: "2026-02-09", candidates: 3, status: "in_progress" as const },
];

const statusConfig = {
  completed: { label: "Completed", className: "bg-success/10 text-success border-success/20" },
  pending_review: { label: "Pending Review", className: "bg-warning/10 text-warning border-warning/20" },
  in_progress: { label: "In Progress", className: "bg-primary/10 text-primary border-primary/20" },
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Welcome back. Here's your exam overview.</p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link to="/new-exam">
            <Plus className="h-4 w-4" />
            Start New Exam
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
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
          <CardDescription>Your latest oral examination sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentExams.map((exam) => {
              const status = statusConfig[exam.status];
              return (
                <div
                  key={exam.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{exam.title}</h3>
                      <Badge variant="outline" className={status.className}>
                        {status.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {exam.institution} · {exam.group}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {exam.candidates}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {exam.date}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
