import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings as SettingsIcon, Key, Globe, Building2, Save, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("oralassess-api-key") ?? "");
  const [showKey, setShowKey] = useState(false);
  const [defaultLang, setDefaultLang] = useState(() => localStorage.getItem("oralassess-lang") ?? "en");
  const [institution, setInstitution] = useState(() => localStorage.getItem("oralassess-institution") ?? "");

  const handleSave = () => {
    localStorage.setItem("oralassess-api-key", apiKey);
    localStorage.setItem("oralassess-lang", defaultLang);
    localStorage.setItem("oralassess-institution", institution);
    toast({ title: "Settings saved", description: "Your preferences have been updated." });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Configure your OralAssess AI preferences and API access.</p>
      </div>

      {/* API Key */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Key className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="font-display text-lg">API Configuration</CardTitle>
              <CardDescription>Your ElevenLabs API key for speech-to-text services.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">ElevenLabs API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                placeholder="sk_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your key from{" "}
              <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent/80">
                elevenlabs.io
              </a>
            </p>
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
