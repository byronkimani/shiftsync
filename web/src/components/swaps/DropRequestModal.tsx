import { useState } from 'react';
import { useSwapRequest } from '../../hooks/useSwapRequest';
import { X, AlertCircle } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';

interface DropRequestModalProps {
    shift: any;
    assignmentId: string;
    onClose: () => void;
}

export default function DropRequestModal({ shift, assignmentId, onClose }: DropRequestModalProps) {
    const { create } = useSwapRequest();
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const isTooClose = differenceInHours(new Date(shift.startUtc), new Date()) < 24;

    const handleConfirm = () => {
        if (isTooClose) {
            setErrorMsg("Cannot drop a shift that starts in less than 24 hours.");
            return;
        }

        create.mutate(
            { requesterAssignmentId: assignmentId, type: 'drop' },
            {
                onSuccess: () => {
                    onClose();
                },
                onError: (err: any) => {
                    setErrorMsg(err?.response?.data?.message || err.message || "Failed to submit drop request");
                }
            }
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">Drop Shift</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5">
                    <p className="text-sm text-gray-600 mb-4">
                        You are requesting to drop the following shift:
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5">
                        <div className="font-semibold text-gray-800">
                            {format(new Date(shift.startUtc), 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                            {format(new Date(shift.startUtc), 'h:mm a')} - {format(new Date(shift.endUtc), 'h:mm a')}
                        </div>
                        <div className="text-xs text-blue-600 mt-1.5 font-medium">{shift.skill?.name}</div>
                    </div>

                    <p className="text-xs text-gray-500 italic mb-5">
                        This will be sent to your manager for approval. You are still responsible for this shift until it is approved.
                    </p>

                    {(errorMsg || isTooClose) && (
                        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{errorMsg || "Cannot drop a shift that starts in less than 24 hours."}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 font-medium">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={create.isPending || isTooClose}
                            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            {create.isPending ? 'Submitting...' : 'Confirm Drop'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
