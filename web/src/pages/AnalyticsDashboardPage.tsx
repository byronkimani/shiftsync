import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useUIStore } from '../stores/uiStore';
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';
import { BarChart3, AlertTriangle, Users, Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import OvertimeChart from '../components/analytics/OvertimeChart';
import FairnessChart from '../components/analytics/FairnessChart';

export default function AnalyticsDashboardPage() {
    const locationId = useUIStore(s => s.selectedLocationId);

    // Default to current week
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();

    // Default to last 4 weeks for fairness
    const fourWeeksAgo = subWeeks(now, 4).toISOString();
    const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

    const { data: overtimeData = [], isLoading: loadOT } = useQuery({
        queryKey: ['analytics-overtime', locationId, currentWeekStart],
        queryFn: () => api.analytics.overtime(locationId as string, currentWeekStart).then(res => res.data),
        enabled: !!locationId,
    });

    const { data: fairnessData = [], isLoading: loadFairness } = useQuery({
        queryKey: ['analytics-fairness', locationId, fourWeeksAgo, endOfCurrentWeek],
        queryFn: () => api.analytics.fairness(locationId as string, fourWeeksAgo, endOfCurrentWeek).then(res => res.data),
        enabled: !!locationId,
    });

    const { data: shifts = [] } = useQuery({
        queryKey: ['shifts', locationId, currentWeekStart],
        queryFn: () => api.shifts.getWeek(locationId as string, currentWeekStart).then(res => res.data),
        enabled: !!locationId,
    });

    // Calculate Summary Stats
    const stats = useMemo(() => {
        const staffNearOT = overtimeData.filter((d: any) => d.totalHours >= 35).length;

        let openSlots = 0;
        shifts.forEach((s: any) => {
            if (s.status === 'published') {
                const assigned = s.assignments?.filter((a: any) => a.status === 'assigned').length || 0;
                if (s.headcountNeeded > assigned) {
                    openSlots += (s.headcountNeeded - assigned);
                }
            }
        });

        const totalHours = overtimeData.reduce((sum: number, d: any) => sum + d.totalHours, 0);
        const avgHours = overtimeData.length ? (totalHours / overtimeData.length).toFixed(1) : 0;

        return { staffNearOT, openSlots, avgHours };
    }, [overtimeData, shifts]);

    if (!locationId) {
        return <div className="p-12 text-center text-gray-500">Please select a location first.</div>;
    }

    return (
        <main className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-600" /> Analytics Overview
                    </h1>
                    <p className="text-sm font-medium text-gray-500 mt-1">
                        Monitor schedule health, overtime risk, and shift distribution.
                    </p>
                </div>
                <div className="flex border border-gray-200 bg-white rounded-lg shadow-sm p-1">
                    <div className="px-3 py-1.5 text-sm font-medium text-gray-700 border-r border-gray-200 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        This Week
                    </div>
                    <div className="px-3 py-1.5 text-xs text-gray-500 flex items-center">
                        {format(new Date(currentWeekStart), 'MMM d')} - {format(new Date(endOfCurrentWeek), 'MMM d, yyyy')}
                    </div>
                </div>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white border text-gray-800 p-5 rounded-xl shadow-sm border-gray-200 flex items-start gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Projected Overtime</div>
                        <div className="text-3xl font-extrabold text-gray-900">{stats.staffNearOT}</div>
                        <div className="text-xs text-gray-500 mt-1">Staff {'>'} 35h this week</div>
                    </div>
                </div>

                <div className="bg-white border text-gray-800 p-5 rounded-xl shadow-sm border-gray-200 flex items-start gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Open Shift Slots</div>
                        <div className="text-3xl font-extrabold text-gray-900">{stats.openSlots}</div>
                        <div className="text-xs text-gray-500 mt-1">Needing immediate coverage</div>
                    </div>
                </div>

                <div className="bg-white border text-gray-800 p-5 rounded-xl shadow-sm border-gray-200 flex items-start gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Avg Hours/Staff</div>
                        <div className="text-3xl font-extrabold text-gray-900">{stats.avgHours}</div>
                        <div className="text-xs text-gray-500 mt-1">Based on projected schedule</div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Overtime Chart */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Overtime Projection</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Assigned + open targeted hours</p>
                        </div>
                        <Link
                            to="/analytics/overtime"
                            className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1 transition-colors"
                        >
                            Details <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="p-6 flex-1">
                        {loadOT ? (
                            <div className="h-80 flex items-center justify-center">
                                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                            </div>
                        ) : (
                            <OvertimeChart data={overtimeData} />
                        )}
                    </div>
                </div>

                {/* Fairness Chart */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Shift Fairness Report</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Distribution of premium shifts (Last 4 Weeks)</p>
                        </div>
                        <Link
                            to="/analytics/fairness"
                            className="text-blue-600 hover:text-blue-700 text-sm font-semibold flex items-center gap-1 transition-colors"
                        >
                            Details <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="p-6 flex-1">
                        {loadFairness ? (
                            <div className="h-80 flex items-center justify-center">
                                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
                            </div>
                        ) : (
                            <FairnessChart data={fairnessData} />
                        )}
                    </div>
                </div>

            </div>
        </main>
    );
}
