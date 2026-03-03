import { X } from 'lucide-react';

interface DiffPanelProps {
    oldState: any;
    newState: any;
    onClose: () => void;
}

export default function DiffPanel({ oldState, newState, onClose }: DiffPanelProps) {
    const rawOld = oldState || {};
    const rawNew = newState || {};

    // Simple flat key difference check
    const allKeys = Array.from(new Set([...Object.keys(rawOld), ...Object.keys(rawNew)])).sort();

    const diffLines = allKeys.map(key => {
        const inOld = key in rawOld;
        const inNew = key in rawNew;
        const oldVal = JSON.stringify(rawOld[key]);
        const newVal = JSON.stringify(rawNew[key]);

        if (inOld && !inNew) {
            return { key, type: 'removed', oldVal, newVal: null };
        }
        if (!inOld && inNew) {
            return { key, type: 'added', oldVal: null, newVal };
        }
        if (oldVal !== newVal) {
            return { key, type: 'changed', oldVal, newVal };
        }
        return { key, type: 'unchanged', oldVal, newVal: oldVal };
    });

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <h2 className="text-lg font-bold text-gray-900">State Changes</h2>
                <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
                {diffLines.length === 0 ? (
                    <div className="text-center text-gray-500 italic p-8">No changes detected.</div>
                ) : (
                    <div className="space-y-4">
                        {diffLines.map(line => (
                            <div key={line.key} className="bg-white border text-sm font-mono overflow-hidden rounded-md shadow-sm border-gray-200">
                                <div className="bg-gray-100 px-3 py-1.5 font-bold border-b border-gray-200 text-gray-700">
                                    "{line.key}"
                                </div>

                                {line.type === 'unchanged' && (
                                    <div className="px-3 py-2 text-gray-500">
                                        {line.oldVal}
                                    </div>
                                )}

                                {line.type === 'added' && (
                                    <div className="px-3 py-2 bg-green-50 text-green-700 font-medium">
                                        + {line.newVal}
                                    </div>
                                )}

                                {line.type === 'removed' && (
                                    <div className="px-3 py-2 bg-red-50 text-red-700 line-through">
                                        - {line.oldVal}
                                    </div>
                                )}

                                {line.type === 'changed' && (
                                    <div className="divide-y divide-gray-100">
                                        <div className="px-3 py-2 bg-red-50/50 text-red-600 line-through">
                                            - {line.oldVal}
                                        </div>
                                        <div className="px-3 py-2 bg-green-50/50 text-green-700 font-medium">
                                            + {line.newVal}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
