import { Calendar, Users, BarChart3, Clock, ArrowRightLeft, UserCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

export function BottomNav() {
    const { user } = useUser();
    const location = useLocation();

    const role = (user?.publicMetadata?.role as string) || "staff";
    const isManager = role === "admin" || role === "manager";

    const navItems = [
        ...(isManager ? [
            { name: "Schedule", href: "/schedule", icon: Calendar },
            { name: "Staff", href: "/staff", icon: Users },
            { name: "Analytics", href: "/analytics", icon: BarChart3 }
        ] : [
            { name: "My Shifts", href: "/my-shifts", icon: Clock },
            { name: "Swaps", href: "/swaps", icon: ArrowRightLeft }
        ]),
        { name: "Profile", href: "/settings", icon: UserCircle }
    ];

    return (
        <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
            height: 'var(--bottom-nav-height)',
        }}
            className="flex md:hidden"
        >
            <div style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                display: 'flex',
                alignItems: 'stretch',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            }}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                    return (
                        <Link key={item.href} to={item.href} style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '3px',
                            textDecoration: 'none',
                            position: 'relative',
                            transition: 'opacity 0.15s ease',
                        }}>
                            {isActive && (
                                <span style={{
                                    position: 'absolute', top: 0,
                                    width: '2rem', height: '2px',
                                    borderRadius: '0 0 2px 2px',
                                    background: 'var(--color-primary)',
                                }} />
                            )}
                            <item.icon
                                size={22}
                                style={{
                                    color: isActive ? 'var(--color-primary)' : '#94a3b8',
                                    transition: 'all 0.15s ease',
                                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                                }}
                            />
                            <span style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                color: isActive ? 'var(--color-primary)' : '#94a3b8',
                                textTransform: 'uppercase',
                            }}>
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
