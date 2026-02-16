import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Copy, CheckCircle2, MessageSquare } from "lucide-react";
import { ORAL_QUESTIONS } from "@/lib/practiceData";
import { useToast } from "@/hooks/use-toast";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function QuestionBankPage() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (question: string, id: string) => {
    navigator.clipboard.writeText(question);
    setCopiedId(id);
    toast({ title: "Copied!", description: "Question copied to clipboard." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Question Bank</h1>
        <p className="mt-1 text-muted-foreground">Common oral exam questions organised by CEFR level. Copy any question to use in your exam.</p>
      </div>

      <Tabs defaultValue="A1">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {LEVELS.map((l) => (
            <TabsTrigger key={l} value={l} className="px-4">{l}</TabsTrigger>
          ))}
        </TabsList>

        {LEVELS.map((level) => {
          const questions = ORAL_QUESTIONS.filter((q) => q.level === level);
          const topics = [...new Set(questions.map((q) => q.topic))];

          return (
            <TabsContent key={level} value={level} className="space-y-4">
              {topics.map((topic) => (
                <Card key={topic}>
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" /> {topic}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {questions
                      .filter((q) => q.topic === topic)
                      .map((q) => (
                        <div
                          key={q.id}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3"
                        >
                          <p className="text-sm flex-1">{q.question}</p>
                          <Button
                            size="sm"
                            variant={copiedId === q.id ? "default" : "outline"}
                            className="gap-1.5 shrink-0"
                            onClick={() => handleCopy(q.question, q.id)}
                          >
                            {copiedId === q.id ? (
                              <><CheckCircle2 className="h-3.5 w-3.5" /> Copied</>
                            ) : (
                              <><Copy className="h-3.5 w-3.5" /> Copy to Exam</>
                            )}
                          </Button>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
