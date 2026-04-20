import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus, Users, Trash2, Pencil, Building2, GraduationCap, Search, UserPlus, Loader2,
} from "lucide-react";
import {
  useGroups, useStudents, useCreateGroup, useUpdateGroup, useDeleteGroup,
  useCreateStudent, useBulkCreateStudents, useUpdateStudent, useDeleteStudent, type Group, type Student,
} from "@/hooks/useRoster";
import { useToast } from "@/hooks/use-toast";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "fr", label: "French" },
  { value: "it", label: "Italian" },
];

const LEVELS = ["A2", "B1", "B2", "C1", "C2"];

function GroupDialog({
  trigger, group, onSubmit,
}: {
  trigger: React.ReactNode;
  group?: Group;
  onSubmit: (data: { institution: string; name: string; level_code: string; language: string; notes: string }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState(group?.institution ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [levelCode, setLevelCode] = useState(group?.level_code ?? "");
  const [language, setLanguage] = useState(group?.language ?? "en");
  const [notes, setNotes] = useState(group?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ institution: institution.trim(), name: name.trim(), level_code: levelCode, language, notes: notes.trim() });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">{group ? "Edit Group" : "New Group"}</DialogTitle>
          <DialogDescription>Define a class so you can pick students by name during exams.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Institution</Label>
            <Input placeholder="e.g. Cambridge Academy" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Group name *</Label>
            <Input placeholder="e.g. B2 Morning · Group A" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Default level</Label>
              <Select value={levelCode || undefined} onValueChange={setLevelCode}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea rows={2} placeholder="Optional notes about this class…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkAddDialog({ groupId, onClose }: { groupId: string; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const bulk = useBulkCreateStudents();
  const { toast } = useToast();

  const names = useMemo(
    () => text.split(/\r?\n|,/).map((n) => n.trim()).filter(Boolean),
    [text],
  );

  const handleSubmit = async () => {
    try {
      const created = await bulk.mutateAsync({ group_id: groupId, names });
      toast({ title: "Students added", description: `${created.length} student${created.length === 1 ? "" : "s"} added to roster.` });
      setText("");
      setOpen(false);
      onClose?.();
    } catch (err: any) {
      toast({ title: "Could not add students", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <UserPlus className="h-3.5 w-3.5" /> Bulk add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Bulk add students</DialogTitle>
          <DialogDescription>One name per line, or comma-separated. Duplicates inside this batch are kept; existing roster entries are not touched.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={8}
          placeholder={"María García\nJoão Silva\nAnna Müller"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{names.length} name{names.length === 1 ? "" : "s"} detected</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={names.length === 0 || bulk.isPending}>
            {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Add ${names.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentRow({ student }: { student: Student }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(student.full_name);
  const updateStudent = useUpdateStudent();
  const deleteStudent = useDeleteStudent();
  const { toast } = useToast();

  const save = async () => {
    if (!name.trim() || name.trim() === student.full_name) {
      setEditing(false);
      setName(student.full_name);
      return;
    }
    try {
      await updateStudent.mutateAsync({ id: student.id, full_name: name.trim() });
      setEditing(false);
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-2.5 hover:bg-muted/30">
      {editing ? (
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setName(student.full_name); } }}
          autoFocus
          className="h-8"
        />
      ) : (
        <span className="text-sm font-medium">{student.full_name}</span>
      )}
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {student.full_name}?</AlertDialogTitle>
              <AlertDialogDescription>This only removes the student from the roster. Existing exam reports are unaffected.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteStudent.mutate(student.id)}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default function RosterPage() {
  const { data: groups = [], isLoading: groupsLoading } = useGroups();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();
  const createStudent = useCreateStudent();
  const { toast } = useToast();

  const selectedGroup = groups.find((g) => g.id === selectedId) ?? null;
  const { data: students = [], isLoading: studentsLoading } = useStudents(selectedId);

  const filteredGroups = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(s) ||
        g.institution.toLowerCase().includes(s) ||
        g.level_code.toLowerCase().includes(s),
    );
  }, [groups, search]);

  // Auto-pick first group on load
  if (!selectedId && groups.length > 0) {
    setSelectedId(groups[0].id);
  }

  const handleAddStudent = async () => {
    if (!selectedId || !newStudentName.trim()) return;
    try {
      await createStudent.mutateAsync({ group_id: selectedId, full_name: newStudentName.trim() });
      setNewStudentName("");
    } catch (err: any) {
      toast({ title: "Could not add student", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Class Roster</h1>
          <p className="mt-1 text-muted-foreground">Manage your institutions, groups and students. Pre-load names so the Progress view stays consistent.</p>
        </div>
        <GroupDialog
          trigger={<Button className="gap-2"><Plus className="h-4 w-4" /> New Group</Button>}
          onSubmit={async (d) => {
            const g = await createGroup.mutateAsync(d);
            setSelectedId(g.id);
            toast({ title: "Group created", description: `${g.name} is ready.` });
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Groups list ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Groups ({groups.length})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 h-9" placeholder="Search groups…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {groupsLoading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
            ) : filteredGroups.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                <p className="text-sm text-muted-foreground">{groups.length === 0 ? "No groups yet" : "No matches"}</p>
              </div>
            ) : (
              filteredGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedId(g.id)}
                  className={`w-full text-left rounded-md border p-2.5 transition-colors ${
                    selectedId === g.id ? "border-accent bg-accent/10" : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{g.name}</span>
                    {g.level_code && <Badge variant="outline" className="text-[10px]">{g.level_code}</Badge>}
                  </div>
                  {g.institution && <p className="text-xs text-muted-foreground truncate">{g.institution}</p>}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* ── Selected group detail ── */}
        <Card>
          {!selectedGroup ? (
            <CardContent className="py-16 text-center space-y-3">
              <GraduationCap className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <p className="text-muted-foreground">Select or create a group to manage its students.</p>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <CardTitle className="font-display">{selectedGroup.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {selectedGroup.institution || "No institution"} · {selectedGroup.level_code || "No level"} · {LANGUAGES.find(l => l.value === selectedGroup.language)?.label}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <GroupDialog
                      group={selectedGroup}
                      trigger={<Button variant="outline" size="sm" className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>}
                      onSubmit={async (d) => {
                        await updateGroup.mutateAsync({ id: selectedGroup.id, ...d });
                        toast({ title: "Group updated" });
                      }}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {selectedGroup.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This deletes the group and all {students.length} student{students.length === 1 ? "" : "s"}. Existing exam reports remain.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={async () => {
                              await deleteGroup.mutateAsync(selectedGroup.id);
                              setSelectedId(null);
                              toast({ title: "Group deleted" });
                            }}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{students.length} student{students.length === 1 ? "" : "s"}</span>
                  </div>
                  <BulkAddDialog groupId={selectedGroup.id} />
                </div>

                {/* Quick add */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a student name…"
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddStudent(); }}
                  />
                  <Button onClick={handleAddStudent} disabled={!newStudentName.trim() || createStudent.isPending} className="gap-1">
                    {createStudent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>

                {/* Students list */}
                <div className="space-y-2">
                  {studentsLoading ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Loading students…</p>
                  ) : students.length === 0 ? (
                    <div className="py-8 text-center space-y-2 rounded-lg border-2 border-dashed">
                      <UserPlus className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                      <p className="text-sm text-muted-foreground">No students in this group yet.</p>
                    </div>
                  ) : (
                    students.map((s) => <StudentRow key={s.id} student={s} />)
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
