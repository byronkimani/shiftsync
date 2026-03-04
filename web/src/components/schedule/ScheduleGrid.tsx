import { useMemo } from 'react';
import { ShiftCard } from './ShiftCard';
import { format, addDays, startOfWeek } from 'date-fns';
import { useWindowSize } from 'react-use';
import clsx from 'clsx';
import DayView from './DayView';
import { toZonedTime } from 'date-fns-tz';

export default function ScheduleGrid({ shifts, locationId, activeWeekStart }: { shifts: any[], locationId: string, activeWeekStart: Date }) {
    const { width } = useWindowSize();

    // For real implementation: we'd fetch the location timezone from api.locations.getById(locationId).timezone
    // For the assessment, we default to America/Los_Angeles or America/New_York via a config or default string
    const locationTimezone = "America/Los_Angeles";

    // Generate the 7 days
    const weekDayDates = useMemo(() => {
        const monday = startOfWeek(activeWeekStart, { weekStartsOn: 1 });
        return Array.from({ length: 7 }).map((_, i) => addDays(monday, i));
    }, [activeWeekStart]);

    // Responsive breakpoints matching LLD 5.6
    // Mobile: handled by DayView
    // Tablet: 768px - 1023px (3 cols)
    // Desktop: >=1024px (7 cols)

    // Wait for DayView
    if (width < 768) {
        return <DayView shifts={shifts} locationId={locationId} activeWeekStart={activeWeekStart} />;
    }

    const columnsVisible = width >= 1024 ? 7 : 3;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden h-full min-h-[700px]">

            {/* Header Row: Days of Week */}
            <div
                className="grid border-b border-gray-200"
                style={{ gridTemplateColumns: `60px repeat(${columnsVisible}, minmax(180px, 1fr))` }}
            >
                <div className="bg-gray-50 border-r border-gray-100 p-2"></div>
                {weekDayDates.slice(0, columnsVisible).map((date, i) => {
                    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                        <div
                            key={i}
                            className={clsx(
                                "px-4 py-3 text-center border-r border-gray-100 font-medium",
                                isToday ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700"
                            )}
                        >
                            <div className="text-xs font-semibold uppercase tracking-wider">{format(date, 'EEE')}</div>
                            <div className={clsx("text-lg", isToday && "font-bold")}>{format(date, 'd')}</div>
                        </div>
                    );
                })}
            </div>

            {/* Grid Body */}
            <div className="flex-1 overflow-y-auto relative bg-gray-50">
                <div
                    className="grid absolute inset-0 pb-10" // Extra padding bottom
                    style={{
                        gridTemplateColumns: `60px repeat(${columnsVisible}, minmax(180px, 1fr))`,
                        minHeight: '1200px' // 19 hours * 60px approx
                    }}
                >
                    {/* 1. Time Gutter (Left Edge) */}
                    <div className="border-r border-gray-200 bg-white relative">
                        {Array.from({ length: 19 }).map((_, i) => {
                            const hour = i + 5; // 5am to midnight
                            const display = format(new Date().setHours(hour, 0, 0, 0), 'ha').toLowerCase();
                            return (
                                <div
                                    key={i}
                                    className="absolute w-full border-b border-gray-100 flex items-start justify-end pr-2 pt-1 pb-1"
                                    style={{ top: `${(i / 19) * 100}%`, height: `${100 / 19}%` }}
                                >
                                    <span className="text-[10px] text-gray-400 font-medium bg-white px-1 relative -top-3 z-10">{display}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 2. Day Columns */}
                    {weekDayDates.slice(0, columnsVisible).map((date, i) => {
                        // Filter shifts mapping exactly to this Day column comparing the YYYY-MM-DD
                        const dayStr = format(date, 'yyyy-MM-dd');
                        // For this, we use toZonedTime to see if the shift's local start falls on this specific date.
                        const dayShifts = shifts.filter(s => {
                            const localDate = toZonedTime(new Date(s.startUtc), locationTimezone);
                            return format(localDate, 'yyyy-MM-dd') === dayStr;
                        });

                        return (
                            <div key={i} className="relative border-r border-gray-100 pt-0 hover:bg-gray-50/50 transition-colors">
                                {/* Horizontal grid lines for aesthetics */}
                                {Array.from({ length: 19 }).map((_, j) => (
                                    <div key={j} className="absolute w-full border-b border-gray-100 border-dashed" style={{ top: `${(j / 19) * 100}%`, height: `${100 / 19}%` }}></div>
                                ))}

                                {dayShifts.map((shift: any) => (
                                    <ShiftCard
                                        key={shift.id}
                                        shift={shift}
                                        locationTimezone={locationTimezone}
                                    />
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
