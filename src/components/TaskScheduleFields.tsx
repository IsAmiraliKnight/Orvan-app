"use client";

import { DatePicker, TimePicker } from "@/components/DateField";
import { today } from "@/lib/domain/dates";
import type { LocalDate } from "@/lib/domain/types";

export function TaskScheduleFields({
  date, time, onDate, onTime, repeating = false, markedDates,
}: {
  date?: LocalDate;
  time: string;
  onDate: (date: LocalDate | undefined) => void;
  onTime: (time: string) => void;
  repeating?: boolean;
  markedDates?: Set<LocalDate>;
}) {
  const mode = !date ? "none" : time ? "timed" : "anytime";
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Task schedule">
        {([ ["anytime", "No time"], ["timed", "Set time"], ["none", "No date"] ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            disabled={repeating && value === "none"}
            aria-pressed={mode === value}
            onClick={() => {
              onDate(value === "none" ? undefined : date ?? today());
              onTime(value === "timed" ? time || "09:00" : "");
            }}
            className={`rounded-full px-2.5 py-1.5 text-[11px] transition-colors disabled:opacity-35 ${mode === value ? "bg-accent text-on-accent" : "bg-surface-2 text-ink-dim hover:text-ink"}`}
          >{label}</button>
        ))}
      </div>
      {date ? (
        <div className="flex gap-2">
          <DatePicker value={date} onChange={onDate} markedDates={markedDates} />
          {mode === "timed" && <TimePicker value={time} onChange={onTime} />}
        </div>
      ) : (
        <p className="text-[11px] text-ink-faint">Kept in No date until you schedule it.</p>
      )}
    </div>
  );
}
