import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Cloud, CheckCircle2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [institution, setInstitution] = useState(() => localStorage.getItem("oralassess-institution") ?? "");
  const [examinerName, setExaminerName] = useState(() => localStorage.getItem("oralassess-examiner") ?? "");

  const handleSave = () => {
    localStorage.setItem("oralassess-institution", institution);
    localStorage.setItem("oralassess-examiner", examinerName);
    toast({ title: "Settings saved", description: "Defaults will apply to new exams you start from now on." });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Configure your International Oral Exam Assistant preferences.</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-display text-lg">Profile</CardTitle>
              <CardDescription>Your name and institution appear on all signed reports.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="examinerName">Examiner Name</Label>
            <Input id="examinerName" placeholder="e.g. Dr. María López" value={examinerName} onChange={(e) => setExaminerName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileInst">Institution Name</Label>
            <Input id="profileInst" placeholder="e.g. Cambridge Academy" value={institution} onChange={(e) => setInstitution(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* AI Status */}
      <Card className="border-accent/20 bg-accent/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Cloud className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="font-display text-lg">AI Engine</CardTitle>
              <CardDescription>Powered by Lovable Cloud — no API key required.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-accent" />
            <span className="text-foreground font-medium">Connected</span>
            <span className="text-muted-foreground">— AI analysis for oral exams is ready to use.</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" className="gap-2" onClick={handleSave}>
          <Save className="h-4 w-4" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
