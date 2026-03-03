import { useState } from 'react';
import { useMyShifts } from '../hooks/useMyShifts';
import { format, isSameDay } from 'date-fns';
import { Clock, Calendar, ArrowRightLeft, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import SwapBottomSheet from '../components/swaps/SwapBottomSheet';
import DropRequestModal from '../components/swaps/DropRequestModal';
import { toZonedTime } from 'date-fns-tz';

export default function MyShiftsPage() {
    const { shifts, isLoading, activeWeekStart, nextWeek, prevWeek, summary } = useMyShifts();

    const [swapShift, setSwapShift] = useState<any>(null);
    const [dropShift, setDropShift] = useState<any>(null);

    const groupedShifts = shifts.reduce((acc: any, shift: any) => {
        const tz = shift.location?.timezone || 'America/Los_Angeles';
        const zonedStart = toZonedTime(new Date(shift.startUtc), tz);
        const dateKey = format(zonedStart, 'yyyy-MM-dd');
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(shift);
        return acc;
    }, {});

    const sortedDates = Object.keys(groupedShifts).sort();

    return (
        <main className="ss-page">
            {/* Page Header */}
            <div className="ss-page-header">
                <h1 className="ss-page-title">My Shifts</h1>
            </div>

            {/* Week Navigator */}
            <div className="ss-week-nav">
                <button onClick={prevWeek} className="ss-week-nav-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ChevronLeft size={14} /> Prev
                </button>
                <div className="ss-week-nav-label">
                    Week of {format(activeWeekStart, 'MMM d, yyyy')}
                </div>
                <button onClick={nextWeek} className="ss-week-nav-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Next <ChevronRight size={14} />
                </button>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem', marginBottom: '1.5rem' }}>
                <div className="ss-stat" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', color: 'white' }}>
                    <div className="ss-stat-label">Total Hours</div>
                    <div className="ss-stat-value">{summary.totalHours}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.25rem' }}>this week</div>
                </div>
                <div className="ss-stat ss-card">
                    <div className="ss-stat-label" style={{ color: 'var(--text-muted)' }}>Shifts Left</div>
                    <div className="ss-stat-value" style={{ color: 'var(--text-primary)' }}>{summary.shiftsRemaining}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>upcoming</div>
                </div>
            </div>

            {/* Shift List */}
            {isLoading ? (
                <div className="ss-spinner" />
            ) : sortedDates.length === 0 ? (
                <div className="ss-empty">
                    <Calendar className="ss-empty-icon" />
                    <div className="ss-empty-title">No shifts this week</div>
                    <div className="ss-empty-desc">You have no shifts scheduled for this week.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {sortedDates.map((dateStr) => {
                        const dayShifts = groupedShifts[dateStr];
                        const dateObj = new Date(dateStr + 'T00:00:00');
                        const isToday = isSameDay(dateObj, new Date());

                        return (
                            <div key={dateStr}>
                                <div className="ss-day-header">
                                    {format(dateObj, 'EEEE, MMM d')}
                                    {isToday && (
                                        <span className="ss-badge ss-badge-blue">Today</span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {dayShifts.map((shift: any) => {
                                        const myAssignment = shift.assignments?.find((a: any) => a.status === 'assigned');
                                        const assignmentId = myAssignment?.id;
                                        const pendingRequest = shift.swapRequests?.find(
                                            (sr: any) => sr.requesterAssignmentId === assignmentId && sr.status === 'pending'
                                        );
                                        const tz = shift.location?.timezone || 'America/Los_Angeles';
                                        const zonedStart = toZonedTime(new Date(shift.startUtc), tz);
                                        const zonedEnd = toZonedTime(new Date(shift.endUtc), tz);

                                        return (
                                            <div key={shift.id} className="ss-shift-card"
                                                style={pendingRequest ? { borderColor: '#f59e0b', borderWidth: '1.5px' } : {}}>
                                                <div className="ss-shift-card-body">
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                        <div>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
                                                                {format(zonedStart, 'h:mm a')} – {format(zonedEnd, 'h:mm a')}
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '0.2rem' }}>
                                                                {shift.location?.name || 'Location'}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                                            {shift.skill?.name && (
                                                                <span className="ss-badge ss-badge-blue">{shift.skill.name.replace('_', ' ')}</span>
                                                            )}
                                                            {shift.isPremium && (
                                                                <span className="ss-badge ss-badge-amber">⭐ Premium</span>
                                                            )}
                                                            {pendingRequest && (
                                                                <span className="ss-badge ss-badge-amber">
                                                                    <Clock size={9} /> Pending {pendingRequest.type}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="ss-shift-card-actions">
                                                    <button
                                                        onClick={() => setSwapShift({ shift, assignmentId })}
                                                        disabled={!!pendingRequest}
                                                        className="ss-shift-action-btn swap"
                                                    >
                                                        <ArrowRightLeft size={14} /> Swap
                                                    </button>
                                                    <button
                                                        onClick={() => setDropShift({ shift, assignmentId })}
                                                        disabled={!!pendingRequest}
                                                        className="ss-shift-action-btn drop"
                                                    >
                                                        <XCircle size={14} /> Drop
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {swapShift && (
                <SwapBottomSheet
                    shift={swapShift.shift}
                    assignmentId={swapShift.assignmentId}
                    locationId={swapShift.shift.locationId}
                    onClose={() => setSwapShift(null)}
                    onDropClick={() => { setDropShift(swapShift); setSwapShift(null); }}
                />
            )}

            {dropShift && (
                <DropRequestModal
                    shift={dropShift.shift}
                    assignmentId={dropShift.assignmentId}
                    onClose={() => setDropShift(null)}
                />
            )}
        </main>
    );
}
