import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUIStore } from '../stores/uiStore';
import { useState } from 'react';
import { subWeeks, endOfWeek, format } from 'date-fns';
import { ArrowLeft, Download, Flag } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import FairnessChart from '../components/analytics/FairnessChart';

export default function FairnessReportPage() {
    const locationId = useUIStore(s => s.selectedLocationId);

    const [weeksAgo, setWeeksAgo] = useState<number>(4);

    const now = new Date();
    const startDate = subWeeks(now, weeksAgo).toISOString();
    const currentWeekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

    const { data: fairnessData = [], isLoading } = useQuery({
        queryKey: ['analytics-fairness', locationId, startDate, currentWeekEnd],
        queryFn: () => api.analytics.fairness(locationId as string, startDate, currentWeekEnd).then(res => res.data),
        enabled: !!locationId,
    });

    const expectedShare = fairnessData[0]?.expectedShare || 0;

    const handleExport = async () => {
        if (!locationId) return;
        try {
            const response = await api.audit.exportCsv('fairness', locationId, startDate, currentWeekEnd);
            const url = window.URL.createObjectURL(new Blob([response as any]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `fairness_report_${format(now, 'yyyyMMdd')}.csv`);
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
                        <h1 className="text-2xl font-bold text-gray-900">Shift Fairness Report</h1>
                        <p className="text-sm font-medium text-gray-500 mt-1">
                            Distribution of premium/undesirable shifts from {format(new Date(startDate), 'MMM d')} to {format(new Date(currentWeekEnd), 'MMM d, yyyy')}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <select
                            value={weeksAgo}
                            onChange={(e) => setWeeksAgo(Number(e.target.value))}
                            className="bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg px-3 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value={4}>Last 4 Weeks</option>
                            <option value={8}>Last 8 Weeks</option>
                            <option value={12}>Last 12 Weeks</option>
                        </select>
                        <button
                            onClick={handleExport}
                            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-6 mb-6">
                <FairnessChart data={fairnessData} />
            </div>

            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mb-6 p-4 flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Flag className="w-5 h-5" />
                </div>
                <div>
                    <div className="text-sm font-semibold text-gray-900">Target Expected Share: <span className="text-blue-600 font-bold">{expectedShare.toFixed(1)} shifts</span> per staff member.</div>
                    <div className="text-xs text-gray-500">Staff with deviations &gt; 20% from the expected share are flagged for review.</div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50/80 text-gray-600 font-semibold text-xs tracking-wider border-b border-gray-200 uppercase">
                        <tr>
                            <th className="px-6 py-4 text-left whitespace-nowrap">Staff Member</th>
                            <th className="px-6 py-4 text-center">Premium Shifts Assigned</th>
                            <th className="px-6 py-4 text-center">Expected Share</th>
                            <th className="px-6 py-4 text-center">Deviation</th>
                            <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                                </td>
                            </tr>
                        ) : fairnessData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
                                    No data available for the selected period.
                                </td>
                            </tr>
                        ) : (
                            fairnessData.map((row: any) => {
                                const isFlagged = row.isFlagged;
                                const diff = row.premiumShiftsCount - expectedShare;
                                const diffPercent = expectedShare > 0 ? (diff / expectedShare) * 100 : 0;
                                const diffSign = diff > 0 ? '+' : '';

                                return (
                                    <tr
                                        key={row.userId}
                                        className={clsx(
                                            "hover:bg-gray-50/50 transition-colors",
                                            isFlagged && "bg-amber-50/30"
                                        )}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-gray-900 border-l-4" style={{ borderLeftColor: isFlagged ? '#eab308' : 'transparent' }}>
                                            {row.name}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-800 font-medium text-base">
                                            {row.premiumShiftsCount}
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500">
                                            {expectedShare.toFixed(1)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={clsx(
                                                "font-semibold",
                                                diff > 0 ? "text-green-600" : diff < 0 ? "text-red-500" : "text-gray-400"
                                            )}>
                                                {diffSign}{diff.toFixed(1)} ({diffSign}{diffPercent.toFixed(0)}%)
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isFlagged ? (
                                                <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
                                                    <Flag className="w-3 h-3" /> Flagged Review
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider">
                                                    Balanced
                                                </span>
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
