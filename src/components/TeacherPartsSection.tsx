import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ListChecks, MessageSquareText } from "lucide-react";
import { QuotedAudio, type ScribeWord } from "@/components/QuotedAudio";
import type { TeacherReportModel } from "@/lib/teacherReportModel";

interface Props {
  model: TeacherReportModel;
  words?: ScribeWord[];
  onSeek?: (start: number, end: number) => void;
}

/**
 * Hybrid teacher-report body: Part → relevant criteria → evidence.
 * Rendered from the same model the teacher PDF uses, so screen and file match.
 */
export function TeacherPartsSection({ model, words = [], onSeek }: Props) {
  if (model.parts.length === 0 && !model.overallSummary) return null;

  const defaultOpen = model.parts[0]?.part ?? "summary";

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold">Analysis by exam part</h3>
      </div>
      <div className="px-3 pb-2">
        <Accordion type="single" collapsible defaultValue={defaultOpen} className="w-full">
          {model.parts.map((p) => (
            <AccordionItem key={p.part} value={p.part}>
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2 text-left">
                  <span className="font-medium">{p.part}</span>
                  {p.title && <span className="text-muted-foreground">— {p.title}</span>}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {p.commentary && (
                    <p className="text-sm leading-relaxed text-foreground/90">
                      <QuotedAudio text={p.commentary} words={words} onSeek={onSeek} />
                    </p>
                  )}

                  {p.criteria.length > 0 && (
                    <ul className="space-y-1.5 rounded-md border bg-muted/20 p-3">
                      {p.criteria.map((cb, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium text-foreground">{cb.criterion}:</span>{" "}
                          <span className="text-foreground/80">
                            <QuotedAudio text={cb.comment} words={words} onSeek={onSeek} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {p.improvement && (
                    <div className="flex gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs">
                      <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span className="text-foreground/80">
                        <span className="font-medium">Suggested focus:</span> {p.improvement}
                      </span>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}

          {model.overallSummary && (
            <AccordionItem value="summary">
              <AccordionTrigger className="text-sm">
                <span className="text-left font-medium">Overall summary</span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {model.overallSummary}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    </div>
  );
}
