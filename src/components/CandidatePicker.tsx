import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useStudents, useCreateStudent } from "@/hooks/useRoster";
import { useToast } from "@/hooks/use-toast";

interface CandidatePickerProps {
  value: string;
  onChange: (name: string) => void;
  groupId?: string | null;
  placeholder?: string;
  excludeNames?: string[];
}

/**
 * Combobox that lets the examiner either pick a student from the active group's
 * roster or type a free-form name. Falls back to a plain input when no group is
 * selected so the picker never blocks recording.
 */
export function CandidatePicker({
  value,
  onChange,
  groupId,
  placeholder,
  excludeNames = [],
}: CandidatePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: students = [], isLoading } = useStudents(groupId);
  const createStudent = useCreateStudent();
  const { toast } = useToast();

  const available = useMemo(() => {
    const taken = new Set(excludeNames.filter((n) => n && n !== value).map((n) => n.toLowerCase()));
    return students.filter((s) => !taken.has(s.full_name.toLowerCase()));
  }, [students, excludeNames, value]);

  const exactMatch = useMemo(
    () => students.find((s) => s.full_name.toLowerCase() === search.trim().toLowerCase()),
    [students, search],
  );

  // Without a group we just render a plain input.
  if (!groupId) {
    return (
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const handleAddNew = async () => {
    const name = search.trim();
    if (!name) return;
    try {
      await createStudent.mutateAsync({ group_id: groupId, full_name: name });
      onChange(name);
      setOpen(false);
      setSearch("");
      toast({ title: "Student added", description: `${name} added to the roster.` });
    } catch (err: any) {
      toast({ title: "Could not add student", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {value || placeholder || "Select student…"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder="Search or type a new name…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
            ) : (
              <>
                <CommandEmpty>
                  {search.trim() ? (
                    <button
                      type="button"
                      onClick={handleAddNew}
                      className="flex w-full items-center justify-center gap-2 px-3 py-2 text-sm text-accent hover:bg-accent/10"
                    >
                      <UserPlus className="h-4 w-4" /> Add "{search.trim()}" to roster
                    </button>
                  ) : (
                    <div className="py-3 text-center text-xs text-muted-foreground">
                      No students yet. Type a name to add.
                    </div>
                  )}
                </CommandEmpty>
                {available.length > 0 && (
                  <CommandGroup heading="Roster">
                    {available.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={s.full_name}
                        onSelect={() => {
                          onChange(s.full_name);
                          setOpen(false);
                          setSearch("");
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === s.full_name ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {s.full_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {search.trim() && !exactMatch && available.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem onSelect={handleAddNew}>
                        <UserPlus className="mr-2 h-4 w-4 text-accent" />
                        Add "{search.trim()}" to roster
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
