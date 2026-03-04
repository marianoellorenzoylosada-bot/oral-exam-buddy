import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  FileText, Search, Filter, Clock, ShieldCheck, EyeOff,
  FolderTree, List, CalendarIcon, Users, Building2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportDetail, type Exam } from "@/components/ReportDetail";
import { format } from "date-fns";

const LEVELS = ["All", "A1", "A2", "B1", "B2", "C1", "C2"];
const LANGUAGES = ["All", "en", "es", "fr", "de", "pt", "it"];

const langLabel: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", pt: "Portuguese", it: "Italian",
};

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("All");
  const [langFilter, setLangFilter] = useState("All");
  const [selected, setSelected] = useState<Exam | null>(null);
  const [anonymize, setAnonymize] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

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

  const filtered = useMemo(() => exams.filter((e) => {
    if (levelFilter !== "All" && e.level_code !== levelFilter) return false;
    if (langFilter !== "All" && e.language !== langFilter) return false;
    if (dateFrom && new Date(e.created_at) < dateFrom) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(e.created_at) > end) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (
        !e.title.toLowerCase().includes(q) &&
        !(e.institution || "").toLowerCase().includes(q) &&
        !(e.group || "").toLowerCase().includes(q) &&
        !(e.candidate_name || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }), [exams, levelFilter, langFilter, dateFrom, dateTo, search]);

  // Group by institution → group
  const groupedData = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, Map<string, Exam[]>>();
    for (const e of filtered) {
      const inst = e.institution || "No Institution";
      const grp = e.group || "No Group";
      if (!map.has(inst)) map.set(inst, new Map());
      const inner = map.get(inst)!;
      if (!inner.has(grp)) inner.set(grp, []);
      inner.get(grp)!.push(e);
    }
    return map;
  }, [filtered, grouped]);

  const mask = (t: string | null) => anonymize ? "██████" : (t || "—");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-muted-foreground">View, search and review all signed assessment reports.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="anonymize" checked={anonymize} onCheckedChange={setAnonymize} />
            <Label htmlFor="anonymize" className="flex items-center gap-1.5 text-sm cursor-pointer">
              <EyeOff className="h-3.5 w-3.5" /> Anonymize
            </Label>
          </div>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button variant={grouped ? "ghost" : "secondary"} size="icon" className="h-7 w-7" onClick={() => setGrouped(false)}>
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button variant={grouped ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setGrouped(true)}>
              <FolderTree className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title, institution, group or candidate…"
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

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-sm">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM") : "From"} – {dateTo ? format(dateTo, "dd/MM") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-3" align="end">
            <div className="text-xs font-medium text-muted-foreground">Date Range</div>
            <div className="flex gap-2">
              <div>
                <Label className="text-xs">From</Label>
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="rounded-md border" />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="rounded-md border" />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                Clear dates
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">
            {filtered.length} Report{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
          <CardDescription>
            {grouped ? "Organized by Institution → Group." : "Click any report to view full details."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading reports…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No reports match your filters.</p>
          ) : grouped && groupedData ? (
            <div className="space-y-6">
              {Array.from(groupedData.entries()).map(([inst, groups]) => (
                <div key={inst}>
                  <h3 className="font-display font-semibold text-sm flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" /> {anonymize ? "██████" : inst}
                  </h3>
                  {Array.from(groups.entries()).map(([grp, items]) => (
                    <div key={grp} className="ml-4 mb-4">
                      <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                        <Users className="h-3.5 w-3.5" /> {anonymize ? "██████" : grp}
                        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                      </h4>
                      <div className="space-y-1.5 ml-2">
                        {items.map((exam) => (
                          <ExamRow key={exam.id} exam={exam} anonymize={anonymize} onClick={() => setSelected(exam)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((exam) => (
                <ExamRow key={exam.id} exam={exam} anonymize={anonymize} onClick={() => setSelected(exam)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && <ReportDetail exam={selected} anonymize={anonymize} onClose={() => setSelected(null)} />}
      </Dialog>
    </div>
  );
}

function ExamRow({ exam, anonymize, onClick }: { exam: Exam; anonymize: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
          {exam.candidate_name ? (
            <span className="font-medium text-foreground">
              {anonymize ? "██████" : exam.candidate_name} ·{" "}
            </span>
          ) : null}
          {anonymize ? "██████" : (exam.institution || "—")} · {anonymize ? "██████" : (exam.group || "—")}
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
  );
}
