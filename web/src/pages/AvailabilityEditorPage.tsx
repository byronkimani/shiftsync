import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUser } from '@clerk/clerk-react';
import { CheckCircle, AlertCircle, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

// Helper to generate 30-min increments
const TIME_OPTIONS = Array.from({ length: 48 }).map((_, i) => {
    const hours = Math.floor(i / 2);
    const mins = i % 2 === 0 ? '00' : '30';
    const time24 = `${hours.toString().padStart(2, '0')}:${mins}:00`;

    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayTime = `${displayHour}:${mins} ${ampm}`;

    return { value: time24, label: displayTime };
});

const DEFAULT_START = '09:00:00';
const DEFAULT_END = '17:00:00';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilityEditorPage() {
    const { user } = useUser();
    const queryClient = useQueryClient();

    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [weekly, setWeekly] = useState<any[]>([]);
    const [exceptions, setExceptions] = useState<any[]>([]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    // Form state for new exception
    const [newExcDate, setNewExcDate] = useState('');
    const [newExcAvailable, setNewExcAvailable] = useState(false);
    const [newExcStart, setNewExcStart] = useState(DEFAULT_START);
    const [newExcEnd, setNewExcEnd] = useState(DEFAULT_END);

    // Fetch locations
    const { data: locations = [] } = useQuery({
        queryKey: ['my-locations', user?.id],
        queryFn: () => api.users.getHomeLocation(user?.id as string).then(res => res.data),
        enabled: !!user?.id,
    });

    // Auto-select first location
    useEffect(() => {
        if (!selectedLocationId && locations.length > 0) {
            setSelectedLocationId(locations[0].locationId);
        }
    }, [locations, selectedLocationId]);

    // Fetch availability
    const { data: availData, isLoading } = useQuery({
        queryKey: ['availability', user?.id],
        queryFn: () => api.users.getAvailability(user?.id as string).then(res => res.data),
        enabled: !!user?.id,
    });

    // Initialize state from fetched data
    useEffect(() => {
        if (availData && selectedLocationId) {
            // map weekly config
            const locWeekly = availData.regular?.filter((a: any) => a.locationId === selectedLocationId) || [];

            const initialWeekly = DAYS.map((_, i) => {
                const existing = locWeekly.find((a: any) => a.dayOfWeek === i);
                return {
                    dayOfWeek: i,
                    isAvailable: !!existing,
                    startTime: existing?.startTime || DEFAULT_START,
                    endTime: existing?.endTime || DEFAULT_END,
                };
            });
            setWeekly(initialWeekly);

            // map exceptions 
            setExceptions(availData.exceptions || []);
        }
    }, [availData, selectedLocationId]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => api.users.updateAvailability(user?.id as string, data),
        onMutate: () => setSaveStatus('saving'),
        onSuccess: () => {
            setSaveStatus('success');
            queryClient.invalidateQueries({ queryKey: ['availability', user?.id] });
            setTimeout(() => setSaveStatus('idle'), 3000);
        },
        onError: (err: any) => {
            setSaveStatus('error');
            setErrorMsg(err?.response?.data?.message || err.message || 'Failed to save');
            setTimeout(() => setSaveStatus('idle'), 5000);
        }
    });

    const handleSave = () => {
        if (!selectedLocationId) return;

        // format payload as expected by Chunk 17 PUT endpoint
        const payload = {
            locationId: selectedLocationId,
            regular: weekly.filter(d => d.isAvailable).map(d => ({
                dayOfWeek: d.dayOfWeek,
                startTime: d.startTime,
                endTime: d.endTime
            })),
            exceptions: exceptions.map(e => ({
                date: e.date,
                available: e.available,
                startTime: e.available ? e.startTime : null,
                endTime: e.available ? e.endTime : null
            }))
        };

        updateMutation.mutate(payload);
    };

    const addException = () => {
        if (!newExcDate) return;

        // basic validation
        if (newExcAvailable && newExcStart >= newExcEnd) {
            alert('End time must be after start time');
            return;
        }

        const newExc = {
            id: 'temp-' + Date.now(),
            date: newExcDate,
            available: newExcAvailable,
            startTime: newExcAvailable ? newExcStart : null,
            endTime: newExcAvailable ? newExcEnd : null
        };

        setExceptions(prev => [...prev.filter(e => e.date !== newExcDate), newExc].sort((a, b) => a.date.localeCompare(b.date)));

        // reset form
        setNewExcDate('');
        setNewExcAvailable(false);
        setNewExcStart(DEFAULT_START);
        setNewExcEnd(DEFAULT_END);
    };

    const removeException = (idOrDate: string) => {
        setExceptions(prev => prev.filter(e => e.id !== idOrDate && e.date !== idOrDate));
    };

    const currentLocation = locations.find((l: any) => l.locationId === selectedLocationId)?.location;

    return (
        <main className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Availability</h1>
            <p className="text-sm text-gray-500 mb-8">Set your regular working hours and add date-specific exceptions.</p>

            {/* Location Selector (if multiple) */}
            {locations.length > 1 && (
                <div className="mb-8 overflow-x-auto hide-scrollbar flex gap-2 pb-2">
                    {locations.map((l: any) => (
                        <button
                            key={l.locationId}
                            onClick={() => setSelectedLocationId(l.locationId)}
                            className={clsx(
                                "px-4 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap",
                                selectedLocationId === l.locationId
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            {l.location?.name || 'Unknown Location'}
                        </button>
                    ))}
                </div>
            )}

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="space-y-8">

                    {/* Weekly Schedule */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">Regular Weekly Hours</h2>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {weekly.map((day, idx) => (
                                <div key={idx} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-4">
                                    <div className="w-40 flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={day.isAvailable}
                                            onChange={(e) => {
                                                const newW = [...weekly];
                                                newW[idx].isAvailable = e.target.checked;
                                                setWeekly(newW);
                                            }}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <span className={clsx("font-semibold", day.isAvailable ? "text-gray-900" : "text-gray-400")}>
                                            {DAYS[idx]}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 flex-1 pl-8 sm:pl-0">
                                        {day.isAvailable ? (
                                            <>
                                                <select
                                                    value={day.startTime}
                                                    onChange={(e) => {
                                                        const newW = [...weekly];
                                                        newW[idx].startTime = e.target.value;
                                                        setWeekly(newW);
                                                    }}
                                                    className="w-[110px] text-sm border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                >
                                                    {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                                <span className="text-gray-400 font-medium">to</span>
                                                <select
                                                    value={day.endTime}
                                                    onChange={(e) => {
                                                        const newW = [...weekly];
                                                        newW[idx].endTime = e.target.value;
                                                        setWeekly(newW);
                                                    }}
                                                    className="w-[110px] text-sm border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                >
                                                    {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                </select>
                                            </>
                                        ) : (
                                            <span className="text-sm text-gray-400 italic">Unavailable</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Exceptions */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                            <h2 className="text-lg font-bold text-gray-800">Date Exceptions</h2>
                            <p className="text-xs text-gray-500 mt-1">Override your regular hours for specific dates (e.g. holidays, time off).</p>
                        </div>

                        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-end gap-4 bg-blue-50/30">
                            <div className="w-full sm:w-auto flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="date"
                                        value={newExcDate}
                                        onChange={e => setNewExcDate(e.target.value)}
                                        className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    />
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newExcAvailable}
                                            onChange={e => setNewExcAvailable(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Available?</span>
                                    </label>
                                </div>
                                {newExcAvailable && (
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={newExcStart}
                                            onChange={e => setNewExcStart(e.target.value)}
                                            className="w-[110px] text-sm border-gray-300 rounded-lg shadow-sm"
                                        >
                                            {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                        <span className="text-gray-400 font-medium">to</span>
                                        <select
                                            value={newExcEnd}
                                            onChange={e => setNewExcEnd(e.target.value)}
                                            className="w-[110px] text-sm border-gray-300 rounded-lg shadow-sm"
                                        >
                                            {TIME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={addException}
                                disabled={!newExcDate}
                                className="w-full sm:w-auto bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                            >
                                <Plus className="w-4 h-4" /> Add Exception
                            </button>
                        </div>

                        <div className="p-5">
                            {exceptions.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No exceptions configured.</p>
                            ) : (
                                <div className="space-y-2">
                                    {exceptions.map(exc => (
                                        <div key={exc.id || exc.date} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                                            <div className="flex items-center gap-4">
                                                <div className="font-semibold text-gray-900 w-28 whitespace-nowrap">
                                                    {format(new Date(exc.date + 'T00:00:00'), 'MMM d, yyyy')}
                                                </div>
                                                {exc.available ? (
                                                    <span className="text-sm text-gray-600 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                        {TIME_OPTIONS.find(o => o.value === exc.startTime)?.label} - {TIME_OPTIONS.find(o => o.value === exc.endTime)?.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm text-gray-500 flex items-center gap-2 italic">
                                                        <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                                        Unavailable Off
                                                    </span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => removeException(exc.id || exc.date)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <p className="text-xs text-center text-gray-400 pt-4">
                        Times shown in <span className="font-semibold">{currentLocation?.timezone || 'Local Timezone'}</span>
                    </p>

                    {/* Fixed Action Bar for Mobile */}
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:sticky md:bottom-4 md:mt-8 md:bg-transparent md:border-t-0 md:shadow-none md:p-0">
                        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 max-w-3xl mx-auto">
                            {saveStatus === 'success' && (
                                <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold bg-green-50 px-3 py-1.5 rounded-full border border-green-200 animate-in fade-in">
                                    <CheckCircle className="w-4 h-4" /> Saved!
                                </div>
                            )}
                            {saveStatus === 'error' && (
                                <div className="flex items-center gap-1.5 text-red-600 text-sm font-semibold">
                                    <AlertCircle className="w-4 h-4" /> {errorMsg}
                                </div>
                            )}

                            <button
                                onClick={handleSave}
                                disabled={saveStatus === 'saving'}
                                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
                            >
                                {saveStatus === 'saving' ? 'Saving...' : 'Save Availability'}
                            </button>
                        </div>
                    </div>

                </div>
            )}
        </main>
    );
}
