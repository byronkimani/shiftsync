import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { addWeeks, subWeeks, startOfWeek } from 'date-fns';
import { useUser } from '@clerk/clerk-react';

export function useMyShifts() {
    const { user } = useUser();
    const [activeWeekStart, setActiveWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

    const formattedWeekStart = activeWeekStart.toISOString();

    const { data: shifts = [], isLoading } = useQuery({
        // poll against this user's shifts
        queryKey: ['my-shifts', user?.id, formattedWeekStart],
        queryFn: () => (api.shifts.getWeek('me', formattedWeekStart) as unknown) as Promise<any[]>, 
        // Actually, Chunk 17 says: Polls `GET /api/shifts?userId=me&weekStart` every 30 seconds
        enabled: !!user?.id,
        refetchInterval: 30000,
    });

    const nextWeek = () => setActiveWeekStart(d => addWeeks(d, 1));
    const prevWeek = () => setActiveWeekStart(d => subWeeks(d, 1));

    // Calculate week summary
    const summary = useMemo(() => {
        let totalHours = 0;
        let shiftsRemaining = 0;
        const now = new Date().getTime();

        shifts.forEach((s: any) => {
            const start = new Date(s.startUtc).getTime();
            const end = new Date(s.endUtc).getTime();
            totalHours += (end - start) / (1000 * 60 * 60);

            if (end > now) {
                shiftsRemaining++;
            }
        });

        return {
            totalHours: Math.round(totalHours * 10) / 10,
            shiftsRemaining
        };
    }, [shifts]);

    return {
        shifts,
        isLoading,
        activeWeekStart,
        nextWeek,
        prevWeek,
        summary
    };
}
