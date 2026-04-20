import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGroups } from "@/hooks/useRoster";
import { Users } from "lucide-react";

interface GroupPickerProps {
  value: string | null;
  onChange: (groupId: string | null, info?: { institution: string; name: string; level_code: string; language: string }) => void;
  filterInstitution?: string;
}

const NONE_VALUE = "__none__";

/**
 * Lets the examiner attach an active class to the current session so the
 * candidate picker can suggest students. Selecting "No group" reverts to
 * free-typed candidate names.
 */
export function GroupPicker({ value, onChange, filterInstitution }: GroupPickerProps) {
  const { data: groups = [], isLoading } = useGroups();

  const filtered = useMemo(() => {
    if (!filterInstitution) return groups;
    const f = filterInstitution.trim().toLowerCase();
    if (!f) return groups;
    return groups.filter((g) => g.institution.toLowerCase().includes(f));
  }, [groups, filterInstitution]);

  return (
    <Select
      value={value ?? NONE_VALUE}
      onValueChange={(v) => {
        if (v === NONE_VALUE) {
          onChange(null);
        } else {
          const g = groups.find((x) => x.id === v);
          onChange(v, g ? { institution: g.institution, name: g.name, level_code: g.level_code, language: g.language } : undefined);
        }
      }}
    >
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder={isLoading ? "Loading rosters…" : "No group (free-type names)"} />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>No group · free-type names</SelectItem>
        {filtered.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.institution ? `${g.institution} · ` : ""}{g.name}
            {g.level_code ? ` (${g.level_code})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
