import { useState } from "react";
import { Calendar, Users, BarChart3, Clock, ArrowRightLeft, Bell, Shield, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useUIStore } from "../../stores/uiStore";
import NotificationPanel from "../notifications/NotificationPanel";

export function Sidebar() {
    const { user } = useUser();
    const location = useLocation();
    const unreadCount = useUIStore((s) => s.unreadNotificationCount);
    const [showNotifications, setShowNotifications] = useState(false);

    const role = (user?.publicMetadata?.role as string) || "staff";
    const isManager = role === "admin" || role === "manager";
    const isAdmin = role === "admin";

    const navItems = [
        ...(isManager ? [
            { name: "Schedule", href: "/schedule", icon: Calendar },
            { name: "Staff", href: "/staff", icon: Users },
            { name: "Analytics", href: "/analytics", icon: BarChart3 }
        ] : [
            { name: "My Shifts", href: "/my-shifts", icon: Clock },
            { name: "Availability", href: "/availability", icon: Calendar }
        ]),
        { name: "Swaps", href: "/swaps", icon: ArrowRightLeft },
        ...(isAdmin ? [{ name: "Audit Log", href: "/audit", icon: Shield }] : []),
        { name: "Settings", href: "/settings", icon: Settings },
    ];

    const roleBadgeStyle: Record<string, { bg: string; color: string }> = {
        admin: { bg: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' },
        manager: { bg: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd' },
        staff: { bg: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7' },
    };
    const badge = roleBadgeStyle[role] || roleBadgeStyle.staff;

    return (
        <aside className="hidden md:flex flex-col" style={{
            position: 'fixed', top: 0, left: 0, width: 'var(--sidebar-width)', height: '100vh',
            background: 'linear-gradient(180deg, #0f172a 0%, #1a2744 100%)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            zIndex: 30,
            boxShadow: '4px 0 24px rgba(0,0,0,0.2)'
        }}>
            {/* Logo */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.875rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{
                    width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
                }}>
                    <span style={{ color: 'white', fontWeight: 900, fontSize: '15px' }}>S</span>
                </div>
                <div>
                    <div style={{ color: 'white', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.02em' }}>ShiftSync</div>
                </div>
            </div>

            {/* Role section */}
            <div style={{ padding: '1rem 1.5rem 0.5rem' }}>
                <span style={{
                    fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', padding: '0.25rem 0.6rem', borderRadius: '999px',
                    background: badge.bg, color: badge.color
                }}>{role}</span>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '0.5rem 0.75rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                    return (
                        <Link key={item.href} to={item.href} style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.625rem 0.875rem', borderRadius: '10px',
                            textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
                            transition: 'all 0.15s ease',
                            background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                            color: isActive ? '#93c5fd' : 'rgba(148, 163, 184, 0.9)',
                            position: 'relative',
                        }}>
                            <item.icon size={16} style={{ color: isActive ? '#60a5fa' : 'rgba(100, 116, 139, 0.9)', flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{item.name}</span>
                            {isActive && (
                                <div style={{ width: '4px', height: '4px', borderRadius: '999px', background: '#60a5fa' }} />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* User footer */}
            <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <UserButton afterSignOutUrl="/sign-in" />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.firstName} {user?.lastName}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.primaryEmailAddress?.emailAddress}
                    </div>
                </div>
                <button
                    onClick={() => setShowNotifications(true)}
                    style={{ position: 'relative', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', background: 'transparent', border: 'none', color: '#64748b', transition: 'all 0.15s ease' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8', e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#64748b', e.currentTarget.style.background = 'transparent')}
                >
                    <Bell size={16} />
                    {unreadCount > 0 && (
                        <span style={{
                            position: 'absolute', top: '-4px', right: '-4px',
                            padding: '0 4px', height: '16px', minWidth: '16px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '999px', background: '#ef4444',
                            color: 'white', fontSize: '10px', fontWeight: 'bold',
                            border: '2px solid #0f172a'
                        }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Notification panel */}
            {showNotifications && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 40 }}
                        onClick={() => setShowNotifications(false)} />
                    <NotificationPanel isSlideOver={true} onClose={() => setShowNotifications(false)} />
                </>
            )}
        </aside>
    );
}
