import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Search, Filter, Clock, Printer, CheckCircle2, AlertTriangle, ShieldCheck, BookOpen, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getRecommendations } from "@/lib/practiceData";

const LEVELS = ["All", "A1", "A2", "B1", "B2", "C1", "C2"];
const LANGUAGES = ["All", "en", "es", "fr", "de", "pt", "it"];

const langLabel: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian",
};

type Exam = {
  id: string;
  title: string;
  level_code: string;
  language: string;
  institution: string | null;
  group: string | null;
  candidates: number | null;
  overall_band: string;
  overall_score: number;
  criteria: any;
  strengths: any;
  areas_for_improvement: any;
  transcript: string | null;
  examiner_notes: string | null;
  status: string;
  created_at: string;
};

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [langFilter, setLangFilter] = useState("All");
  const [selected, setSelected] = useState<Exam | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Exam[];
    },
  });

  const filtered = exams.filter((e) => {
    if (levelFilter !== "All" && e.level_code !== levelFilter) return false;
    if (langFilter !== "All" && e.language !== langFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.title.toLowerCase().includes(q) &&
        !(e.institution || "").toLowerCase().includes(q) &&
        !(e.group || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">View, search and review all signed assessment reports.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, institution or group…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[120px]">
            <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEVELS.map((l) => (
              <SelectItem key={l} value={l}>{l === "All" ? "All Levels" : l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={langFilter} onValueChange={setLangFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l} value={l}>{l === "All" ? "All Languages" : langLabel[l] || l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">
            {filtered.length} Report{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>Click any report to view full details.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading reports…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No reports match your filters.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((exam) => (
                <button
                  key={exam.id}
                  onClick={() => setSelected(exam)}
                  className="flex w-full flex-col gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h3 className="font-medium">{exam.title}</h3>
                      <Badge variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-xs">
                        <ShieldCheck className="h-3 w-3" /> Official
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {exam.institution || "—"} · {exam.group || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Badge variant="secondary">{exam.level_code}</Badge>
                    <Badge variant="outline">{langLabel[exam.language] || exam.language}</Badge>
                    <span className="font-display font-bold text-foreground">{Number(exam.overall_score).toFixed(1)}/5</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(exam.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && <ReportDetail exam={selected} onClose={() => setSelected(null)} />}
      </Dialog>
    </div>
  );
}

function ReportDetail({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const criteria = Array.isArray(exam.criteria) ? exam.criteria as { name: string; score: number; maxScore: number; feedback: string }[] : [];
  const strengths = Array.isArray(exam.strengths) ? exam.strengths as string[] : [];
  const improvements = Array.isArray(exam.areas_for_improvement) ? exam.areas_for_improvement as string[] : [];
  const recommendations = getRecommendations(criteria, exam.level_code, 2);

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display text-xl flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          {exam.title}
        </DialogTitle>
        <DialogDescription>
          {exam.institution || "—"} · {exam.group || "—"} · {new Date(exam.created_at).toLocaleDateString()}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 mt-2">
        {/* Overall */}
        <div className="flex items-center gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="font-display text-2xl font-bold">{exam.overall_band}</span>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <p className="font-display text-xl font-bold">{Number(exam.overall_score).toFixed(1)}/5.0</p>
            <div className="flex gap-2 mt-1">
              <Badge variant="secondary">{exam.level_code}</Badge>
              <Badge variant="outline">{langLabel[exam.language] || exam.language}</Badge>
            </div>
          </div>
        </div>

        {/* Criteria */}
        {criteria.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm">Assessment Criteria</h3>
            {criteria.map((c, i) => {
              const pct = (c.score / c.maxScore) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{c.name}</span>
                    <span className={`font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-destructive"}`}>
                      {c.score}/{c.maxScore}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2 mb-1" />
                  <p className="text-xs text-muted-foreground">{c.feedback}</p>
                  {i < criteria.length - 1 && <Separator className="mt-3" />}
                </div>
              );
            })}
          </div>
        )}

        {/* Strengths & Improvements */}
        <div className="grid gap-4 sm:grid-cols-2">
          {strengths.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-sm flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Strengths
              </h3>
              <ul className="space-y-1">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-sm flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Areas for Improvement
              </h3>
              <ul className="space-y-1">
                {improvements.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Examiner Notes */}
        {exam.examiner_notes && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-1">Examiner Notes</h3>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/50 p-3">{exam.examiner_notes}</p>
          </div>
        )}

        {/* Transcript */}
        {exam.transcript && (
          <div>
            <h3 className="font-display font-semibold text-sm mb-1">Transcript</h3>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap rounded-lg bg-muted/50 p-3 max-h-40 overflow-y-auto">
              {exam.transcript}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-sm flex items-center gap-1.5 mb-2">
              <BookOpen className="h-4 w-4 text-primary" /> Recommended Practice
            </h3>
            {recommendations.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2 mb-1.5 text-xs transition-colors hover:bg-muted/40">
                <div>
                  <p className="font-medium">{link.title}</p>
                  <p className="text-muted-foreground">{link.source} · {link.skill} · {link.level}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        )}

        {/* Print */}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
