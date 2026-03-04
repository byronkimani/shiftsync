import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUIStore } from '../stores/uiStore';
import { format, subDays } from 'date-fns';
import { Shield, Download, FileJson } from 'lucide-react';
import clsx from 'clsx';
import DiffPanel from '../components/audit/DiffPanel';

export default function AuditLogPage() {
    const locationId = useUIStore(s => s.selectedLocationId);

    const [actionFilter, setActionFilter] = useState<string>('all');
    const [entityFilter, setEntityFilter] = useState<string>('all');
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    // Default to last 30 days
    const now = new Date();
    const [fromDate] = useState(subDays(now, 30).toISOString());
    const [toDate] = useState(now.toISOString());

    const { data: rawLogs = [], isLoading } = useQuery({
        queryKey: ['audit-logs', locationId, fromDate, toDate],
        queryFn: () => api.audit.export(fromDate, toDate, locationId as string).then(res => res.data),
        enabled: !!locationId,
    });

    const logs = rawLogs.filter((l: any) => {
        const actionMatch = actionFilter === 'all' || l.action === actionFilter;
        const entityMatch = entityFilter === 'all' || l.entityType === entityFilter;
        return actionMatch && entityMatch;
    });

    const handleExport = async () => {
        if (!locationId) return;
        try {
            const response = await api.audit.exportCsv('history', locationId, fromDate, toDate);
            const url = window.URL.createObjectURL(new Blob([response as any]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_export_${format(now, 'yyyyMMdd')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to export CSV. Please try again.');
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'create': return 'text-green-700 bg-green-100 border-green-200';
            case 'update': return 'text-blue-700 bg-blue-100 border-blue-200';
            case 'delete':
            case 'cancel': return 'text-red-700 bg-red-100 border-red-200';
            case 'publish': return 'text-teal-700 bg-teal-100 border-teal-200';
            default: return 'text-gray-700 bg-gray-100 border-gray-200';
        }
    };

    return (
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24 relative">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-red-600" /> System Audit Log
                    </h1>
                    <p className="text-sm font-medium text-gray-500 mt-1">
                        Track all administrative overrides, assignments, and schedule publications.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={actionFilter}
                        onChange={e => setActionFilter(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="all">All Actions</option>
                        <option value="create">Created</option>
                        <option value="update">Updated</option>
                        <option value="publish">Published</option>
                        <option value="delete">Deleted</option>
                        <option value="cancel">Cancelled</option>
                    </select>

                    <select
                        value={entityFilter}
                        onChange={e => setEntityFilter(e.target.value)}
                        className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="all">All Entities</option>
                        <option value="shift">Shift</option>
                        <option value="shift_assignment">Assignment</option>
                        <option value="swap_request">Swap Request</option>
                    </select>

                    <button
                        onClick={handleExport}
                        className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Export
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs tracking-wider border-b border-gray-200 uppercase">
                        <tr>
                            <th className="px-6 py-4 text-left whitespace-nowrap">Timestamp</th>
                            <th className="px-6 py-4 text-left">Actor</th>
                            <th className="px-6 py-4 text-left">Action</th>
                            <th className="px-6 py-4 text-left">Entity</th>
                            <th className="px-6 py-4 text-left">Summary</th>
                            <th className="px-6 py-4 text-right">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    <div className="animate-spin h-6 w-6 border-2 border-red-600 border-t-transparent rounded-full mx-auto" />
                                </td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                                    No audit logs found for the selected filters.
                                </td>
                            </tr>
                        ) : (
                            logs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-medium text-xs">
                                        {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm:ss')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900">
                                        {log.actor?.name || 'System'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={clsx(
                                            "inline-flex items-center gap-1 font-bold border px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider",
                                            getActionColor(log.action)
                                        )}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium text-xs">
                                        {log.entityType}
                                    </td>
                                    <td className="px-6 py-4 text-gray-800">
                                        {log.entityType} ID: {log.entityId}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                                        >
                                            <FileJson className="w-4 h-4" /> View Diff
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {logs.length > 0 && (
                    <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex justify-center">
                        <button className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 bg-white px-4 py-2 rounded-lg shadow-sm">
                            Load more
                        </button>
                    </div>
                )}
            </div>

            {selectedLog && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 z-40"
                        onClick={() => setSelectedLog(null)}
                    />
                    <DiffPanel
                        oldState={selectedLog.beforeState}
                        newState={selectedLog.afterState}
                        onClose={() => setSelectedLog(null)}
                    />
                </>
            )}
        </main>
    );
}
