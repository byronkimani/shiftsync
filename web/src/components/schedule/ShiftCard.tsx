import { useMemo } from 'react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useUIStore } from '../../stores/uiStore';

// Mock types since we don't have a global types.ts yet in web
type Shift = any;

interface ShiftCardProps {
    shift: Shift;
    locationTimezone: string;
}

export function ShiftCard({ shift, locationTimezone }: ShiftCardProps) {
    const staleShiftIds = useUIStore(s => s.staleShiftIds);
    const setSelectedAssignShiftId = useUIStore(s => s.setSelectedAssignShiftId);
    const isStale = staleShiftIds.has(shift.id);

    // Convert UTC string to Date, then to Location's Timezone Date for rendering
    const zonedStart = useMemo(() => toZonedTime(new Date(shift.startUtc), locationTimezone), [shift.startUtc, locationTimezone]);
    const zonedEnd = useMemo(() => toZonedTime(new Date(shift.endUtc), locationTimezone), [shift.endUtc, locationTimezone]);

    const isPremium = shift.isPremium;
    const isDraft = shift.status === 'draft';
    const isFilled = shift.headcountFilled >= shift.headcountRequired;

    // We take the hour/minute and map it to a vertical percentage within the day column.
    // 5am = 0%, 12am = 100%. (19 total hours from 5 to 24)
    const calculateGridPosition = () => {
        const startHour = zonedStart.getHours();
        const startMin = zonedStart.getMinutes();
        const endHour = zonedEnd.getHours();
        const endMin = zonedEnd.getMinutes();

        // Map time to minutes since 5am
        const startMinutesOffset = ((startHour - 5) * 60) + startMin;
        const endMinutesOffset = ((endHour - 5) * 60) + endMin;

        const durationMins = endMinutesOffset - startMinutesOffset;

        const totalGridMinutes = 19 * 60; // 5am to Midnight

        // Prevent rendering out of bounds if a shift crosses midnight (edge case)
        const clampedTop = Math.max(0, (startMinutesOffset / totalGridMinutes) * 100);
        const clampedHeight = Math.min(100 - clampedTop, (durationMins / totalGridMinutes) * 100);

        return { top: `${clampedTop}%`, height: `${clampedHeight}%` };
    };

    const { top, height } = calculateGridPosition();

    const assignments = shift.assignments || [];

    return (
        <div
            className={clsx(
                "absolute inset-x-1 rounded-md border shadow-sm flex flex-col overflow-hidden text-xs transition-all cursor-pointer hover:shadow-md",
                isDraft ? "opacity-75 bg-gray-50 border-gray-200 border-dashed" : "bg-white border-gray-100",
                isPremium && !isDraft && "border-l-4 border-l-amber-400",
                isStale && "ring-2 ring-amber-500 animate-pulse bg-amber-50"
            )}
            style={{ top, height }}
            onClick={() => {
                setSelectedAssignShiftId(shift.id);
            }}
        >
            {/* Header Bar */}
            <div className="px-2 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-1 flex-shrink-0">
                <span className="font-semibold text-gray-800 text-[10px] sm:text-xs">
                    {format(zonedStart, 'h:mma').toLowerCase()} - {format(zonedEnd, 'h:mma').toLowerCase()}
                </span>
                <div className={clsx(
                    "px-1.5 py-0.5 rounded-full font-bold text-[9px] whitespace-nowrap",
                    isFilled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                    {shift.headcountFilled}/{shift.headcountRequired}
                </div>
            </div>

            {/* Body */}
            <div className="p-2 flex-1 flex flex-col gap-1 min-h-0 overflow-hidden">
                {/* Skill Badge */}
                <div className="mb-1">
                    <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded truncate max-w-full">
                        {shift.skill?.name || 'Any Skill'}
                    </span>
                </div>

                {/* Assigned Staff */}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                    {assignments.slice(0, 2).map((a: any) => (
                        <div key={a.id} className="flex items-center gap-1.5 truncate">
                            <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                                {a.user.name.charAt(0)}
                            </div>
                            <span className="text-[10px] truncate text-gray-600 font-medium">{a.user.name}</span>
                        </div>
                    ))}
                    {assignments.length > 2 && (
                        <span className="text-[9px] text-gray-400 font-medium pl-5">+{assignments.length - 2} more</span>
                    )}

                    {!isFilled && (
                        <div className="border border-dashed border-gray-300 rounded bg-gray-50 flex items-center justify-center mt-1 py-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                            <span className="text-[10px] font-medium">+ Assign</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
