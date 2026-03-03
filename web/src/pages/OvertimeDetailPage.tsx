import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUIStore } from '../stores/uiStore';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { ArrowLeft, Download, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export default function OvertimeDetailPage() {
    const locationId = useUIStore(s => s.selectedLocationId);

    // Default to current week
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

    const { data: overtimeData = [], isLoading } = useQuery({
        queryKey: ['analytics-overtime', locationId, currentWeekStart],
        queryFn: () => api.analytics.overtime(locationId as string, currentWeekStart).then(res => res.data),
        enabled: !!locationId,
    });

    const handleExport = async () => {
        if (!locationId) return;
        try {
            const response = await api.audit.exportCsv('overtime', locationId, currentWeekStart, currentWeekEnd);
            // Assuming response is a blob, create download link
            const url = window.URL.createObjectURL(new Blob([response as any]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `overtime_report_${format(now, 'yyyyMMdd')}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (err) {
            console.error('Export failed', err);
            alert('Failed to export CSV. Please try again.');
        }
    };

    if (!locationId) {
        return <div className="p-12 text-center text-gray-500">Please select a location first.</div>;
    }

    return (
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24">

            <div className="mb-6">
                <Link to="/analytics" className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 w-fit mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Overtime Details</h1>
                        <p className="text-sm font-medium text-gray-500 mt-1">
                            Breakdown of staff hours for the week of {format(new Date(currentWeekStart), 'MMM d, yyyy')}
                        </p>
                    </div>
                    <button
                        onClick={handleExport}
                        className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs tracking-wider border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-left whitespace-nowrap">Staff Member</th>
                            <th className="px-4 py-4 text-center">Mon</th>
                            <th className="px-4 py-4 text-center">Tue</th>
                            <th className="px-4 py-4 text-center">Wed</th>
                            <th className="px-4 py-4 text-center">Thu</th>
                            <th className="px-4 py-4 text-center">Fri</th>
                            <th className="px-4 py-4 text-center bg-gray-100/50">Sat</th>
                            <th className="px-4 py-4 text-center bg-gray-100/50">Sun</th>
                            <th className="px-6 py-4 text-right border-l border-gray-200">Total Hours</th>
                            <th className="px-6 py-4 text-right">Overtime</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {isLoading ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                                </td>
                            </tr>
                        ) : overtimeData.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-6 py-12 text-center text-gray-500 font-medium">
                                    No staff data found for this week.
                                </td>
                            </tr>
                        ) : (
                            overtimeData.map((row: any) => {
                                const isOvertime = row.totalHours > 40;
                                const isWarning = row.totalHours >= 35 && !isOvertime;
                                const otHours = isOvertime ? row.totalHours - 40 : 0;

                                return (
                                    <tr
                                        key={row.userId}
                                        className={clsx(
                                            "hover:bg-gray-50/50 transition-colors",
                                            isOvertime && "bg-red-50/30"
                                        )}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 border-l-4" style={{ borderLeftColor: isOvertime ? '#ef4444' : isWarning ? '#f59e0b' : 'transparent' }}>
                                            {row.name}
                                        </td>
                                        {/* Fallback mock daily breakdown if backend doesn't provide it */}
                                        <td className="px-4 py-4 text-center text-gray-600">{row.daily?.[1]?.toFixed(1) || '-'}</td>
                                        <td className="px-4 py-4 text-center text-gray-600">{row.daily?.[2]?.toFixed(1) || '-'}</td>
                                        <td className="px-4 py-4 text-center text-gray-600">{row.daily?.[3]?.toFixed(1) || '-'}</td>
                                        <td className="px-4 py-4 text-center text-gray-600">{row.daily?.[4]?.toFixed(1) || '-'}</td>
                                        <td className="px-4 py-4 text-center text-gray-600">{row.daily?.[5]?.toFixed(1) || '-'}</td>
                                        <td className="px-4 py-4 text-center text-gray-600 bg-gray-50/30">{row.daily?.[6]?.toFixed(1) || '-'}</td>
                                        <td className="px-4 py-4 text-center text-gray-600 bg-gray-50/30">{row.daily?.[0]?.toFixed(1) || '-'}</td>

                                        <td className="px-6 py-4 text-right font-bold border-l border-gray-100">
                                            {row.totalHours.toFixed(1)}h
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isOvertime ? (
                                                <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-100 px-2.5 py-1 rounded-md text-xs">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> +{otHours.toFixed(1)}h
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
