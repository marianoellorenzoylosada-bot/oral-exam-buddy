import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { FileText, CheckCircle2, AlertTriangle, RotateCcw, Download } from "lucide-react";

export interface AssessmentResult {
  overallBand: string;
  overallScore: number;
  criteria: { name: string; score: number; maxScore: number; feedback: string }[];
  strengths: string[];
  areasForImprovement: string[];
  transcript: string;
  examinerNotes: string;
}

interface DraftReportProps {
  result: AssessmentResult;
  level: string;
  language: string;
  onReset: () => void;
}

function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = (score / max) * 100;
  const color = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-destructive";
  return <span className={`font-display text-2xl font-bold ${color}`}>{score}/{max}</span>;
}

export function DraftReport({ result, level, language, onReset }: DraftReportProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Draft Assessment Report</h1>
          <p className="mt-1 text-muted-foreground">AI-generated preliminary evaluation · Review before finalizing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> New Exam
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-6 pt-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <span className="font-display text-3xl font-bold">{result.overallBand}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">Overall CEFR Band</p>
            <p className="font-display text-2xl font-bold">{result.overallBand} — Score: {result.overallScore.toFixed(1)}/5.0</p>
            <div className="mt-2 flex gap-2">
              <Badge variant="secondary">Level: {level}</Badge>
              <Badge variant="outline">{language}</Badge>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
                <AlertTriangle className="mr-1 h-3 w-3" /> Draft — Needs Review
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criteria Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Assessment Criteria</CardTitle>
          <CardDescription>Scores based on CEFR descriptors for {level}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {result.criteria.map((c, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{c.name}</span>
                <ScoreBadge score={c.score} max={c.maxScore} />
              </div>
              <Progress value={(c.score / c.maxScore) * 100} className="h-2 mb-2" />
              <p className="text-sm text-muted-foreground">{c.feedback}</p>
              {i < result.criteria.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Strengths & Improvements */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.areasForImprovement.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Examiner Notes */}
      {result.examinerNotes && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" /> Examiner Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.examinerNotes}</p>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {result.transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Transcript</CardTitle>
            <CardDescription>AI-generated approximate transcription</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {result.transcript}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
