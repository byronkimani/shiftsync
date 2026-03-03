import { useState } from 'react';
import { useUIStore } from '../stores/uiStore';
import { format } from 'date-fns';
import { Shield, Download, FileJson } from 'lucide-react';
import clsx from 'clsx';
import DiffPanel from '../components/audit/DiffPanel';

export default function AuditLogPage() {
    const locationId = useUIStore(s => s.selectedLocationId);

    const [actionFilter, setActionFilter] = useState<string>('all');
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    // Seed mock data for audit logs
    const seedLogs = [
        {
            id: '1',
            timestamp: new Date().toISOString(),
            actorName: 'Admin Guy',
            action: 'CREATED',
            entityType: 'SHIFT',
            summary: 'Created shift for Front Desk at 9:00 AM',
            oldState: null,
            newState: { locationId, role: 'Front Desk', startTime: '09:00', endTime: '17:00' }
        },
        {
            id: '2',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            actorName: 'Manager Jane',
            action: 'UPDATED',
            entityType: 'SHIFT_ASSIGNMENT',
            summary: 'Reassigned John Doe to shift',
            oldState: { assigneeId: null },
            newState: { assigneeId: 'user_123' }
        },
        {
            id: '3',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            actorName: 'Admin Guy',
            action: 'PUBLISHED',
            entityType: 'SCHEDULE',
            summary: 'Published schedule for week of Mar X',
            oldState: { status: 'draft' },
            newState: { status: 'published' }
        }
    ];

    // Ideally, we fetch from API:
    // const { data: logs = [], isLoading } = useQuery({ ... });
    const logs = seedLogs.filter(l => actionFilter === 'all' || l.action === actionFilter);
    const isLoading = false;

    const handleExport = () => {
        // Typically call api.audit.exportCsv()
        alert('Exporting CSV...');
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATED': return 'text-green-700 bg-green-100 border-green-200';
            case 'UPDATED': return 'text-blue-700 bg-blue-100 border-blue-200';
            case 'DELETED': return 'text-red-700 bg-red-100 border-red-200';
            case 'PUBLISHED': return 'text-teal-700 bg-teal-100 border-teal-200';
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
                        <option value="CREATED">Created</option>
                        <option value="UPDATED">Updated</option>
                        <option value="PUBLISHED">Published</option>
                        <option value="DELETED">Deleted</option>
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
                                        {log.actorName}
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
                                        {log.summary}
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
                        oldState={selectedLog.oldState}
                        newState={selectedLog.newState}
                        onClose={() => setSelectedLog(null)}
                    />
                </>
            )}
        </main>
    );
}
