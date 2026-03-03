import { useMemo, useState } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { useSwipeable } from 'react-swipeable';
import clsx from 'clsx';
// import { ShiftCardList } from './ShiftCardList'; // We'll render shifts linearly here

export default function DayView({ shifts, activeWeekStart }: { shifts: any[], locationId: string, activeWeekStart: Date }) {
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    const weekDayDates = useMemo(() => {
        const monday = startOfWeek(activeWeekStart, { weekStartsOn: 1 });
        return Array.from({ length: 7 }).map((_, i) => addDays(monday, i));
    }, [activeWeekStart]);

    const activeDate = weekDayDates[activeDayIndex];
    const activeDateStr = format(activeDate, 'yyyy-MM-dd');

    // Filter shifts to the active day string trivially
    const dayShifts = shifts.filter(s => s.startUtc.includes(activeDateStr));

    const handlers = useSwipeable({
        onSwipedLeft: () => setActiveDayIndex(i => Math.min(i + 1, 6)),
        onSwipedRight: () => setActiveDayIndex(i => Math.max(i - 0, 0)),
        trackMouse: true
    });

    return (
        <div {...handlers} className="flex flex-col h-full bg-gray-50 pb-20">
            {/* Pill Navigation Strip */}
            <div className="bg-white border-b border-gray-200 p-3 overflow-x-auto snap-x hide-scrollbar flex gap-2">
                {weekDayDates.map((date, i) => {
                    const isActive = i === activeDayIndex;
                    return (
                        <button
                            key={i}
                            onClick={() => setActiveDayIndex(i)}
                            className={clsx(
                                "snap-center flex flex-col items-center justify-center min-w-[60px] p-2 rounded-xl transition-all",
                                isActive
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}
                        >
                            <span className="text-[10px] uppercase tracking-wide font-semibold opacity-80">{format(date, 'EEE')}</span>
                            <span className="text-lg font-bold">{format(date, 'd')}</span>
                        </button>
                    )
                })}
            </div>

            {/* Shifts List for the Day */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {dayShifts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <span className="text-sm font-medium border-2 border-dashed border-gray-200 px-6 py-8 rounded-2xl">
                            No shifts scheduled for {format(activeDate, 'EEEE')}
                        </span>
                    </div>
                ) : (
                    dayShifts.map((shift: any) => (
                        <div key={shift.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-gray-900">{format(new Date(shift.startUtc), 'h:mm a')} - {format(new Date(shift.endUtc), 'h:mm a')}</span>
                                <div className={clsx(
                                    "px-2 py-1 rounded-full text-xs font-bold",
                                    shift.headcountFilled >= shift.headcountRequired ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                )}>
                                    {shift.headcountFilled} / {shift.headcountRequired} Staff
                                </div>
                            </div>
                            {shift.skill?.name && (
                                <div className="self-start">
                                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{shift.skill.name}</span>
                                </div>
                            )}
                            <div className="text-sm text-gray-500 mt-2">
                                {shift.assignments?.map((a: any) => (
                                    <div key={a.id} className="flex items-center gap-2 mb-1">
                                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px]">
                                            {a.user.name.charAt(0)}
                                        </div>
                                        <span className="font-medium text-gray-700">{a.user.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}

                {/* Mobile Add button placeholder */}
                <button className="mt-4 border-2 border-dashed border-blue-300 text-blue-600 font-medium p-4 rounded-xl hover:bg-blue-50 transition-colors">
                    + Add Shift
                </button>
            </div>
        </div>
    );
}
