"use client";

import { useMemo, useState } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NewsletterType } from '@/types/database';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STANDARD_SEND_DAYS = new Set([4, 6]);

type IssueCalendarProps = {
    issueDates: Record<NewsletterType, string>;
    onAssignDate: (type: NewsletterType, date: string) => void;
    onOpenIssue: (type: NewsletterType) => void;
};

function toDateKey(date: Date) {
    return format(date, 'yyyy-MM-dd');
}

function fromDateKey(dateKey: string) {
    return new Date(`${dateKey}T00:00:00`);
}

export function IssueCalendar({ issueDates, onAssignDate, onOpenIssue }: IssueCalendarProps) {
    const [viewDate, setViewDate] = useState(() => fromDateKey(issueDates.urgent));
    const [selectedDate, setSelectedDate] = useState(() => issueDates.urgent);

    const calendarDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 });
        return eachDayOfInterval({ start, end });
    }, [viewDate]);

    const selectedDateLabel = selectedDate ? format(fromDateKey(selectedDate), 'MMMM d, yyyy') : null;
    const selectedDay = selectedDate ? fromDateKey(selectedDate) : null;
    const urgentSelected = selectedDate === issueDates.urgent;
    const evergreenSelected = selectedDate === issueDates.evergreen;
    const isStandardSendDay = selectedDay ? STANDARD_SEND_DAYS.has(selectedDay.getDay()) : false;

    return (
        <section className="gpt-panel p-6 grid gap-6 lg:grid-cols-[1.1fr,0.7fr]">
            <div className="space-y-5">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Newsletter Calendar
                        </p>
                        <h2 className="text-lg font-semibold text-card-foreground">
                            {format(viewDate, 'MMMM yyyy')}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className="gpt-button-ghost px-3 py-2"
                            onClick={() => setViewDate((prev) => subMonths(prev, 1))}
                            aria-label="Previous month"
                        >
                            <ChevronLeft size={16} strokeWidth={1.5} />
                        </button>
                        <button
                            type="button"
                            className="gpt-button-ghost px-3 py-2"
                            onClick={() => setViewDate((prev) => addMonths(prev, 1))}
                            aria-label="Next month"
                        >
                            <ChevronRight size={16} strokeWidth={1.5} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-7 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    {DAY_LABELS.map((day) => (
                        <div key={day} className="text-center py-2">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((day) => {
                        const dateKey = toDateKey(day);
                        const inMonth = isSameMonth(day, viewDate);
                        const isSelected = selectedDate === dateKey;
                        const isUrgent = issueDates.urgent === dateKey;
                        const isEvergreen = issueDates.evergreen === dateKey;
                        const isStandard = STANDARD_SEND_DAYS.has(day.getDay());

                        const base = 'rounded-2xl px-3 py-3 text-sm transition-colors';
                        const classes = [
                            base,
                            inMonth ? 'bg-secondary text-card-foreground' : 'bg-transparent text-muted-foreground/50',
                            isSelected ? 'ring-2 ring-primary/70' : 'hover:bg-[#3d3d3d]',
                            isStandard ? 'border border-border' : 'border border-transparent',
                        ]
                            .filter(Boolean)
                            .join(' ');

                        return (
                            <button
                                type="button"
                                key={dateKey}
                                className={classes}
                                onClick={() => setSelectedDate(dateKey)}
                            >
                                <div className="flex items-start justify-between">
                                    <span className={isToday(day) ? 'text-primary font-semibold' : ''}>
                                        {format(day, 'd')}
                                    </span>
                                    {(isUrgent || isEvergreen) && (
                                        <span className="flex gap-1 text-[10px]">
                                            {isUrgent && <span className="gpt-chip px-2 py-0.5 text-[10px]">U</span>}
                                            {isEvergreen && <span className="gpt-chip px-2 py-0.5 text-[10px]">E</span>}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="gpt-card p-5 space-y-4">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Selected Date
                    </p>
                    <p className="text-lg font-semibold text-card-foreground">
                        {selectedDateLabel || 'Pick a day'}
                    </p>
                    {isStandardSendDay && (
                        <span className="gpt-chip text-xs">Standard send day</span>
                    )}
                </div>

                {!selectedDate && (
                    <p className="text-sm text-muted-foreground">
                        Choose a date on the calendar to plan a newsletter issue.
                    </p>
                )}

                {selectedDate && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Urgent Issue</span>
                            {urgentSelected ? (
                                <button
                                    type="button"
                                    className="gpt-button-ghost text-xs px-3 py-1.5"
                                    onClick={() => onOpenIssue('urgent')}
                                >
                                    Open Draft
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="gpt-button text-xs px-3 py-1.5"
                                    onClick={() => onAssignDate('urgent', selectedDate)}
                                >
                                    Assign Date
                                </button>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Evergreen Issue</span>
                            {evergreenSelected ? (
                                <button
                                    type="button"
                                    className="gpt-button-ghost text-xs px-3 py-1.5"
                                    onClick={() => onOpenIssue('evergreen')}
                                >
                                    Open Draft
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="gpt-button text-xs px-3 py-1.5"
                                    onClick={() => onAssignDate('evergreen', selectedDate)}
                                >
                                    Assign Date
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
