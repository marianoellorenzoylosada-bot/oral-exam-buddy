import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mic, Loader2, ExternalLink, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useToast } from "@/hooks/use-toast";



export default function Auth() {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch {
      // Some browsers throw when cross-origin iframe is detected.
      setInIframe(true);
    }
  }, []);

  const openInOwnTab = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  const friendlyOAuthError = (message: string): string => {
    const m = message.toLowerCase();
    if (m.includes("state") || m.includes("invalid_request")) {
      return "The login session was lost. This usually happens when the app is opened inside another page (preview iframe) or when cookies are blocked. Open the app in its own tab and try again.";
    }
    if (m.includes("popup") || m.includes("blocked") || m.includes("closed")) {
      return "The popup or redirect was blocked. Allow popups for this site or use the 'Open in own tab' option.";
    }
    if (m.includes("redirect_uri")) {
      return "This login URL is not authorized. Use the published app link (oralexamassistant.lovable.app) instead of a preview link.";
    }
    return message;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      return;
    }

    if (data.session) {
      // Auto-confirm is enabled; account is ready immediately.
      toast({ title: "Account created", description: "Welcome! Redirecting you to the app." });
      navigate("/");
      return;
    }

    if (data.user?.identities && data.user.identities.length === 0) {
      // Supabase returns a placeholder user with no identities when the email already exists.
      toast({
        title: "Email already registered",
        description: "That email already has an account. Sign in below, or reset your password if you forgot it.",
        variant: "destructive",
      });
      setTab("login");
      return;
    }

    // Email confirmation is required.
    toast({
      title: "Check your email",
      description: "We sent a confirmation link. If you don't see it, check your spam folder. Contact your colleague for the published app link if the link doesn't open.",
    });
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Enter your email", description: "Please enter your email address first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset sent", description: "Check your email for a reset link." });
    }
  };

  const handleGoogle = async () => {
    if (inIframe) {
      openInOwnTab();
      return;
    }
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        const description = friendlyOAuthError(result.error.message ?? "Please try again.");
        toast({ title: "Google sign-in failed", description, variant: "destructive" });
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate("/");
    } catch (err: any) {
      const description = friendlyOAuthError(err?.message ?? "Please try again.");
      toast({ title: "Google sign-in failed", description, variant: "destructive" });
      setLoading(false);
    }
  };



  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-primary">
            <Mic className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="font-display text-xl">Int'l Oral Exam Assistant</CardTitle>
          <CardDescription>Sign in to manage your oral assessments</CardDescription>
          {inIframe && (
            <Alert variant="destructive" className="mt-3 text-left">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You seem to be inside a preview/editor frame. Google sign-in usually fails here.{" "}
                <Button type="button" variant="link" className="h-auto p-0 text-xs font-semibold" onClick={openInOwnTab}>
                  Open in own tab <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            If a colleague invited you, use the published link: <strong>oralexamassistant.lovable.app</strong>
          </p>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" className="w-full gap-2" onClick={handleGoogle} disabled={loading}>

            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
            </svg>
            Continue with Google
          </Button>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 mb-4">

              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
                <Button type="button" variant="link" className="w-full text-xs" onClick={handleForgotPassword}>
                  Forgot password?
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input id="signup-name" placeholder="Dr. Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input id="signup-password" type="password" placeholder="Min. 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
