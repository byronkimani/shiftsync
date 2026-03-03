import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { X, AlertTriangle } from 'lucide-react';

interface Shift {
    id: string;
    headcountRequired: number;
    headcountFilled: number;
    assignments?: any[];
}

interface PublishConfirmModalProps {
    shifts: Shift[];
    onClose: () => void;
    locationId: string;
}

export default function PublishConfirmModal({ shifts, onClose, locationId }: PublishConfirmModalProps) {
    const queryClient = useQueryClient();
    const [acknowledged, setAcknowledged] = useState(false);

    const totalShifts = shifts.length;
    // Get unique assigned users from drafts
    const uniqueStaff = new Set(
        shifts.flatMap(s => s.assignments?.map(a => a.user.id) || [])
    ).size;

    const unfilledShifts = shifts.filter(s => s.headcountFilled < s.headcountRequired);
    const totalOpenSlots = unfilledShifts.reduce((acc, s) => acc + (s.headcountRequired - s.headcountFilled), 0);
    const needsAck = totalOpenSlots > 0;

    const mutation = useMutation({
        mutationFn: async () => {
            // The API requires acknowledgeOpenSlots if we have unfilled shifts and require >= 1 headcount
            // Wait, there's no bulk endpoint, so we loop over all draft shifts.
            // But the API publish route says: "unless body includes { acknowledgeOpenSlots: true }"
            // Oh, wait. The LLD chunk 7 says:
            // "Block if shift has no assignments and headcount_required > 0 — unless body includes { acknowledgeOpenSlots: true }"
            // Wait, let's fix api client to pass `acknowledgeOpenSlots`

            const payload = needsAck ? { acknowledgeOpenSlots: true } : {};

            return Promise.all(shifts.map(s =>
                api.shifts.publish(s.id, payload)
            ));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts', locationId] });
            onClose();
        },
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Publish Schedule</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-gray-600 mb-6">
                        You are about to publish <strong>{totalShifts}</strong> draft shifts, which will notify <strong>{uniqueStaff}</strong> assigned staff members.
                    </p>

                    {needsAck && (
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-amber-800">Unfilled Slots</h4>
                                    <p className="text-sm text-amber-700 mt-1">
                                        There are {totalOpenSlots} open slots across {unfilledShifts.length} shifts. Staff will be notified to pick these up if they are eligible.
                                    </p>

                                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={acknowledged}
                                            onChange={(e) => setAcknowledged(e.target.checked)}
                                            className="rounded text-amber-600 focus:ring-amber-500"
                                        />
                                        <span className="text-sm font-medium text-amber-800">
                                            I acknowledge these open slots
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending || (needsAck && !acknowledged)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {mutation.isPending ? 'Publishing...' : 'Publish'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
