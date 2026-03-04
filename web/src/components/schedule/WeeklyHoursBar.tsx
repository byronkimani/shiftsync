import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import clsx from 'clsx';

export function WeeklyHoursBar({ locationId, weekStart }: { locationId: string; weekStart: Date }) {
    const formattedWeekStart = weekStart.toISOString();

    const { data, isLoading } = useQuery({
        queryKey: ['analytics', 'overtime', locationId, formattedWeekStart],
        queryFn: () => (api.analytics.overtime(locationId, formattedWeekStart) as unknown) as Promise<any>,
        enabled: !!locationId && !!formattedWeekStart,
    });

    if (isLoading || !data?.staff) return null;
    if (data.staff.length === 0) return null;

    return (
        <div className="bg-white border-t border-gray-200 py-3 px-6 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-10 sticky bottom-0">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Weekly Hours</h4>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-1">
                {data.staff.map((s: any) => {
                    const hours = Math.round(s.scheduledHours * 10) / 10;
                    const isOvertime = hours >= 40;
                    const isWarning = hours >= 35 && hours < 40;
                    const isGood = hours < 35;

                    return (
                        <div key={s.userId} className="flex flex-col flex-shrink-0 min-w-[120px]">
                            <span className="text-sm font-semibold truncate text-gray-800">{s.name}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className={clsx(
                                    "w-2 h-2 rounded-full flex-shrink-0",
                                    isGood && "bg-green-500",
                                    isWarning && "bg-amber-500",
                                    isOvertime && "bg-red-500 animate-pulse"
                                )} />
                                <span className={clsx(
                                    "text-xs font-bold",
                                    isGood && "text-green-700",
                                    isWarning && "text-amber-700",
                                    isOvertime && "text-red-700"
                                )}>
                                    {hours}h
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
