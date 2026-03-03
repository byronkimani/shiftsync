import { useState, useMemo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSwapRequest } from '../hooks/useSwapRequest';
import { Check, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useUIStore } from '../stores/uiStore';
import clsx from 'clsx';

export default function SwapRequestsPage() {
    const { user } = useUser();
    const role = (user?.publicMetadata?.role as string) || 'staff';
    const isManager = role === 'admin' || role === 'manager';
    const locationId = useUIStore(s => s.selectedLocationId);

    const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history'>('pending');

    const { data: swaps = [], isLoading } = useQuery({
        queryKey: ['swap-requests', locationId],
        queryFn: () => api.swaps.list(locationId || undefined).then(res => res.data).catch(() => []),
        refetchInterval: 10000, // Poll every 10s
    });

    const { approve, reject, accept, decline, withdraw } = useSwapRequest();

    const tabs = useMemo(() => {
        // Filter logic
        // Pending: 
        //  - Manager: waiting for manager approval (drop pending, or swap accepted)
        //  - Staff: waiting for my acceptance (swap pending targeted at me)
        // Active:
        //  - Not pending my action, but still in progress (pending, accepted)
        // History:
        //  - approved, cancelled, expired

        const pendingList: any[] = [];
        const activeList: any[] = [];
        const historyList: any[] = [];

        swaps.forEach((s: any) => {
            if (['approved', 'cancelled', 'expired'].includes(s.status)) {
                historyList.push(s);
            } else {
                let actionRequiredByMe = false;
                if (isManager) {
                    if (s.status === 'accepted' || (s.type === 'drop' && s.status === 'pending')) {
                        actionRequiredByMe = true;
                    }
                } else {
                    if (s.status === 'pending' && s.targetId === user?.id) {
                        actionRequiredByMe = true;
                    }
                }

                if (actionRequiredByMe) {
                    pendingList.push(s);
                } else {
                    activeList.push(s);
                }
            }
        });

        // sort by newest first
        const sortDesc = (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

        return {
            pending: pendingList.sort(sortDesc),
            active: activeList.sort(sortDesc),
            history: historyList.sort(sortDesc)
        };
    }, [swaps, isManager, user?.id]);

    const activeList = tabs[activeTab];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'accepted': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'approved': return 'bg-green-100 text-green-800 border-green-200';
            case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
            case 'expired': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const renderActions = (s: any) => {
        const isActionPending = approve.isPending || reject.isPending || accept.isPending || decline.isPending || withdraw.isPending;

        if (isManager) {
            if (s.status === 'accepted' || (s.type === 'drop' && s.status === 'pending')) {
                return (
                    <div className="flex gap-2">
                        <button
                            disabled={isActionPending}
                            onClick={() => approve.mutate(s.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                        >
                            <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                            disabled={isActionPending}
                            onClick={() => reject.mutate(s.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                        >
                            <X className="w-3.5 h-3.5" /> Reject
                        </button>
                    </div>
                );
            }
        } else {
            // Staff
            if (s.status === 'pending' && s.targetId === user?.id) {
                return (
                    <div className="flex gap-2">
                        <button
                            disabled={isActionPending}
                            onClick={() => accept.mutate(s.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-semibold"
                        >
                            Accept Shift
                        </button>
                        <button
                            disabled={isActionPending}
                            onClick={() => decline.mutate(s.id)}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1.5 rounded text-xs font-semibold"
                        >
                            Decline
                        </button>
                    </div>
                );
            }
            if (['pending', 'accepted'].includes(s.status) && s.requesterId === user?.id) {
                return (
                    <button
                        disabled={isActionPending}
                        onClick={() => withdraw.mutate(s.id)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
                    >
                        Withdraw
                    </button>
                );
            }
        }
        return <span className="text-gray-400 text-sm">—</span>;
    };

    return (
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-700">
                        Swap & Drop Requests
                    </h1>
                    <p className="text-sm font-medium text-gray-500 mt-1">
                        Manage scheduling requests and coverage
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6 gap-6">
                {(['pending', 'active', 'history'] as const).map(tabKey => (
                    <button
                        key={tabKey}
                        onClick={() => setActiveTab(tabKey)}
                        className={clsx(
                            "pb-3 text-sm font-semibold capitalize border-b-2 transition-colors",
                            activeTab === tabKey
                                ? "border-blue-600 text-blue-700"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        {tabKey === 'pending' ? 'Pending Approval' : tabKey}
                        <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                            {tabs[tabKey].length}
                        </span>
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center p-20">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                </div>
            ) : activeList.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 bg-white border border-dashed border-gray-300 rounded-xl text-gray-500">
                    <Clock className="w-10 h-10 mb-3 text-gray-300" />
                    <p className="font-medium">No requests in this category</p>
                </div>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-semibold text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 text-left">Type</th>
                                    <th className="px-6 py-4 text-left">Requester</th>
                                    <th className="px-6 py-4 text-left">Shift Details</th>
                                    <th className="px-6 py-4 text-left">Counterparty</th>
                                    <th className="px-6 py-4 text-left">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {activeList.map((s: any) => (
                                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={clsx(
                                                "px-2.5 py-1 rounded border text-xs font-bold uppercase tracking-wider",
                                                s.type === 'drop' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                            )}>
                                                {s.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-semibold text-gray-900">{s.requester?.name || 'Unknown'}</div>
                                            <div className="text-xs text-gray-500">{format(new Date(s.createdAt), 'MMM d, h:mm a')}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-800">
                                                {s.requesterAssignment?.shift?.startUtc ? format(new Date(s.requesterAssignment.shift.startUtc), 'MMM d, yyyy') : 'Unknown Date'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {s.requesterAssignment?.shift?.startUtc && s.requesterAssignment?.shift?.endUtc
                                                    ? `${format(new Date(s.requesterAssignment.shift.startUtc), 'h:mm a')} - ${format(new Date(s.requesterAssignment.shift.endUtc), 'h:mm a')}`
                                                    : 'Unknown Time'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {s.target ? (
                                                <div className="font-medium text-gray-800">{s.target.name}</div>
                                            ) : (
                                                <span className="text-gray-400 italic">None</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={clsx(
                                                "px-2.5 py-1 rounded-full text-xs font-bold border capitalize",
                                                getStatusColor(s.status)
                                            )}>
                                                {s.status}
                                            </span>
                                            {s.cancellationReason && (
                                                <div className="text-[10px] text-gray-500 mt-1 max-w-[120px] truncate" title={s.cancellationReason}>
                                                    {s.cancellationReason}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <div className="flex justify-end">{renderActions(s)}</div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card List */}
                    <div className="md:hidden space-y-4">
                        {activeList.map((s: any) => (
                            <div key={s.id} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider",
                                            s.type === 'drop' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        )}>
                                            {s.type}
                                        </span>
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                                            getStatusColor(s.status)
                                        )}>
                                            {s.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-gray-500 font-medium">
                                        {format(new Date(s.createdAt), 'MMM d')}
                                    </div>
                                </div>

                                <div>
                                    <div className="font-bold text-gray-900 border-b border-gray-100 pb-2 mb-2">
                                        {s.requester?.name || 'Unknown'}
                                        {s.target && <span className="text-gray-500 font-normal"> → {s.target.name}</span>}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                        {s.requesterAssignment?.shift?.startUtc ? format(new Date(s.requesterAssignment.shift.startUtc), 'MMM d, yyyy') : 'Unknown Date'}
                                    </div>
                                    <div className="text-xs text-gray-500 ml-5.5 mt-0.5">
                                        {s.requesterAssignment?.shift?.startUtc && s.requesterAssignment?.shift?.endUtc
                                            ? `${format(new Date(s.requesterAssignment.shift.startUtc), 'h:mm a')} - ${format(new Date(s.requesterAssignment.shift.endUtc), 'h:mm a')}`
                                            : 'Unknown Time'}
                                    </div>
                                </div>

                                {/* Divider & Actions */}
                                <div className="mt-1 pt-3 border-t border-gray-100 flex justify-end">
                                    {renderActions(s)}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </main>
    );
}
