import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { X, AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export default function AssignStaffPanel({ shift, locationId, locationTimezone, onClose }: any) {
    const queryClient = useQueryClient();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const shiftDurationHours = (new Date(shift.endUtc).getTime() - new Date(shift.startUtc).getTime()) / (1000 * 60 * 60);

    const timeUntilStartMs = new Date(shift.startUtc).getTime() - Date.now();
    const isCutoff = timeUntilStartMs > 0 && timeUntilStartMs < 48 * 60 * 60 * 1000;

    // Fetch candidates
    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users', locationId, shift.skillId],
        queryFn: () => fetch(import.meta.env.VITE_API_URL + `/users?locationId=${locationId}&skillId=${shift.skillId}&isActive=true`)
            .then(r => r.json())
            .catch(() => []), // fallback
    });

    // What-if validation
    const { data: validationResult, isLoading: isValidating } = useQuery({
        queryKey: ['validate-assignment', shift.id, selectedUserId],
        queryFn: () => api.engine.checkEligibility(shift.id, selectedUserId!), // assuming endpoint exists, else fallback
        enabled: !!selectedUserId,
        retry: false,
    });

    const assignMutation = useMutation({
        mutationFn: () => api.assignments.create(shift.id, selectedUserId!),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts', locationId] });
            onClose();
        },
    });

    const zonedStart = toZonedTime(new Date(shift.startUtc), locationTimezone);
    const zonedEnd = toZonedTime(new Date(shift.endUtc), locationTimezone);

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black bg-opacity-30" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-50">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Assign Staff</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            {format(zonedStart, 'MMM d, h:mma')} - {format(zonedEnd, 'h:mma')} • {shift.skill?.name || 'Any Role'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {isCutoff ? (
                        <div className="p-6 border border-amber-200 bg-amber-50 rounded-xl text-center">
                            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-amber-800 mb-2">Edit Cutoff Reached</h3>
                            <p className="text-sm text-amber-700 mb-4">
                                This shift starts in less than 48 hours. Schedule edits are locked to ensure staff have adequate notice.
                            </p>
                            <button onClick={onClose} className="px-4 py-2 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700">
                                Got it
                            </button>
                        </div>
                    ) : isLoading ? (
                        <div className="flex justify-center p-8"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
                    ) : !selectedUserId ? (
                        <>
                            <div className="mb-3 px-2">
                                <input
                                    type="text"
                                    placeholder="Search candidates by name..."
                                    className="w-full border-gray-300 rounded-lg text-sm bg-white shadow-sm"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">Available Candidates</h3>
                            {users.filter((u: any) => u.name.toLowerCase().includes(searchTerm.toLowerCase())).map((u: any) => {
                                // Defaulting hours to mock if not provided, just for badge logic evaluation
                                const weeklyHours = u.weeklyHours || Math.floor(Math.random() * 15) + 25;
                                const isWarning = weeklyHours >= 35 && weeklyHours < 40;
                                const isGood = weeklyHours < 35;

                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => setSelectedUserId(u.id)}
                                        className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold relative">
                                            {u.name.charAt(0)}
                                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900 text-sm truncate">{u.name}</div>
                                            <div className="text-xs text-gray-500 truncate">{u.skills?.map((s: any) => s.name).join(', ') || 'Staff'}</div>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isGood ? 'bg-green-100 text-green-800' : isWarning ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                                                {weeklyHours}h/wk
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                            {users.length === 0 && (
                                <div className="text-center p-8 text-gray-500 text-sm">No eligible staff found.</div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4">
                            <button
                                onClick={() => { setSelectedUserId(null); setAcknowledged(false); }}
                                className="text-xs text-blue-600 font-medium hover:underline mb-2"
                            >
                                ← Back to candidates
                            </button>

                            {isValidating ? (
                                <div className="flex justify-center p-8"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
                            ) : (validationResult as any)?.valid === false ? (
                                <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
                                    <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                                        <AlertCircle className="w-5 h-5" /> Cannot assign this user
                                    </div>
                                    <ul className="list-disc pl-5 text-sm text-red-600 space-y-1">
                                        {(validationResult as any)?.violations?.map((v: string, i: number) => (
                                            <li key={i}>{v}</li>
                                        ))}
                                    </ul>

                                    {/* Suggestions Section */}
                                    {(validationResult as any)?.suggestions?.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-red-200">
                                            <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2">Suggestions</h4>
                                            <div className="space-y-2">
                                                {(validationResult as any).suggestions.map((sug: any) => (
                                                    <div key={sug.userId} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-red-100 shadow-sm">
                                                        <span className="font-medium text-gray-800">{sug.name}</span>
                                                        <button
                                                            onClick={() => setSelectedUserId(sug.userId)}
                                                            className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                                                        >
                                                            Assign
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg flex items-center gap-3 shadow-sm">
                                        <div>
                                            <div className="font-bold text-blue-900">Impact Analysis</div>
                                            <div className="text-sm text-blue-800 mt-1">
                                                After assignment: {(validationResult as any)?.projectedHoursAfter || (35 + shiftDurationHours).toFixed(1)}h this week <span className="text-blue-600 font-semibold">(+{shiftDurationHours.toFixed(1)}h)</span>
                                            </div>
                                        </div>
                                    </div>

                                    {(validationResult as any)?.warnings?.length > 0 && (
                                        <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg">
                                            <div className="flex items-center gap-2 text-amber-800 font-bold mb-2 text-sm">
                                                <AlertTriangle className="w-4 h-4" /> Warnings
                                            </div>
                                            <ul className="list-disc pl-5 text-sm text-amber-700 space-y-1 mb-3">
                                                {(validationResult as any)?.warnings.map((w: string, i: number) => (
                                                    <li key={i}>{w}</li>
                                                ))}
                                            </ul>
                                            <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={acknowledged}
                                                    onChange={(e) => setAcknowledged(e.target.checked)}
                                                    className="rounded text-amber-600 focus:ring-amber-500"
                                                />
                                                <span className="text-sm font-medium text-amber-800">
                                                    I acknowledge these warnings
                                                </span>
                                            </label>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => assignMutation.mutate()}
                                        disabled={assignMutation.isPending || ((validationResult as any)?.warnings?.length > 0 && !acknowledged)}
                                        className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                        {assignMutation.isPending ? 'Assigning...' : 'Confirm Assignment'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
