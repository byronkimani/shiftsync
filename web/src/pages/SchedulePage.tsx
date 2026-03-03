import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '../stores/uiStore';
import { api } from '../lib/api';
import { addWeeks, subWeeks, format, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import ScheduleGrid from '../components/schedule/ScheduleGrid';
import CreateShiftModal from '../components/schedule/CreateShiftModal';
import PublishConfirmModal from '../components/schedule/PublishConfirmModal';

export default function SchedulePage() {
    const { selectedLocationId, setSelectedLocationId, activeWeekStart, setActiveWeekStart } = useUIStore();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [publishModalOpen, setPublishModalOpen] = useState(false);

    // 1. Fetch locations for the dropdown
    const { data: locData = [] } = useQuery<any[]>({
        queryKey: ['locations'],
        queryFn: () => (api.locations.list() as unknown) as Promise<any[]>,
    });
    const locations = locData as any[];

    // Auto-select first location if none selected
    useMemo(() => {
        if (!selectedLocationId && locations.length > 0) {
            setSelectedLocationId(locations[0].id);
        }
    }, [locations, selectedLocationId, setSelectedLocationId]);

    // 2. Poll for changes every 5 seconds (The Digest)
    const formattedWeekStart = activeWeekStart.toISOString();
    const { data: pollData } = useQuery<any>({
        queryKey: ['poll', 'schedule', selectedLocationId, formattedWeekStart],
        queryFn: () => (api.poll.schedule(selectedLocationId!, formattedWeekStart) as unknown) as Promise<any>,
        enabled: !!selectedLocationId,
        refetchInterval: 5000,
    });

    const lastUpdatedAt = pollData?.lastUpdatedAt;

    // 3. Fetch the actual shifts
    // We include lastUpdatedAt in the queryKey so it auto-invalidates when the poll detects a change!
    const { data = [], isLoading } = useQuery<any[]>({
        queryKey: ['shifts', selectedLocationId, formattedWeekStart, lastUpdatedAt],
        queryFn: () => (api.shifts.getWeek(selectedLocationId!, formattedWeekStart) as unknown) as Promise<any[]>,
        enabled: !!selectedLocationId,
    });
    const shifts = data;

    const draftShifts = shifts.filter((s: any) => s.status === 'draft');
    const hasDrafts = draftShifts.length > 0;

    const handlePrevWeek = () => setActiveWeekStart(subWeeks(activeWeekStart, 1));
    const handleNextWeek = () => setActiveWeekStart(addWeeks(activeWeekStart, 1));

    const weekDisplay = `${format(startOfWeek(activeWeekStart, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(activeWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-20">

                <div className="flex items-center gap-4">
                    <select
                        value={selectedLocationId || ''}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 font-medium"
                    >
                        <option value="" disabled>Select Location</option>
                        {locations.map((loc: any) => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                    </select>

                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button onClick={handlePrevWeek} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
                        <span className="px-3 text-sm font-semibold text-gray-700 whitespace-nowrap">{weekDisplay}</span>
                        <button onClick={handleNextWeek} className="p-1 hover:bg-white rounded shadow-sm transition-all"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {hasDrafts && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            {draftShifts.length} unpublished {draftShifts.length === 1 ? 'shift' : 'shifts'}
                        </span>
                    )}

                    <button
                        onClick={() => setPublishModalOpen(true)}
                        disabled={!hasDrafts}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors border",
                            hasDrafts
                                ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                                : "bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-70"
                        )}
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Publish Schedule
                    </button>

                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Add Shift
                    </button>
                </div>
            </header>

            {/* Main Grid Area */}
            <main className="flex-1 overflow-auto bg-gray-50 relative">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : !selectedLocationId ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        Please select a location
                    </div>
                ) : (
                    <div className="p-6">
                        <ScheduleGrid shifts={shifts} locationId={selectedLocationId!} activeWeekStart={activeWeekStart} />
                    </div>
                )}
            </main>

            {/* Modals */}
            {createModalOpen && <CreateShiftModal locationId={selectedLocationId!} onClose={() => setCreateModalOpen(false)} />}
            {publishModalOpen && <PublishConfirmModal shifts={draftShifts} locationId={selectedLocationId!} onClose={() => setPublishModalOpen(false)} />}
        </div>
    );
}
