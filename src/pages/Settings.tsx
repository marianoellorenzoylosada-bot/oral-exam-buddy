import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Building2, Save, Cloud, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "it", label: "Italian" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [defaultLang, setDefaultLang] = useState(() => localStorage.getItem("oralassess-lang") ?? "en");
  const [institution, setInstitution] = useState(() => localStorage.getItem("oralassess-institution") ?? "");

  const handleSave = () => {
    localStorage.setItem("oralassess-lang", defaultLang);
    localStorage.setItem("oralassess-institution", institution);
    toast({ title: "Settings saved", description: "Your preferences have been updated." });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Configure your OralAssess AI preferences.</p>
      </div>

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

      {/* Defaults */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Globe className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="font-display text-lg">Defaults</CardTitle>
              <CardDescription>Set default language and institution for new exams.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default Language</Label>
            <Select value={defaultLang} onValueChange={setDefaultLang}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultInst">Default Institution</Label>
            <Input id="defaultInst" placeholder="e.g. Cambridge Academy" value={institution} onChange={(e) => setInstitution(e.target.value)} />
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
