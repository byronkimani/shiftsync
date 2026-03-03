import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCircle2, X } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import clsx from 'clsx';
import { Link, useNavigate } from 'react-router-dom';

interface NotificationPanelProps {
    onClose?: () => void;
    isSlideOver?: boolean;
}

export default function NotificationPanel({ onClose, isSlideOver = false }: NotificationPanelProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const setUnreadCount = useUIStore(s => s.setUnreadNotificationCount);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    const { data: notifications = [], isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => api.notifications.list().then((res: any) => {
            const list = res.data || [];
            setUnreadCount(list.filter((n: any) => !n.read).length);
            return list;
        }),
        refetchInterval: 60000 // Poll every minute
    });

    const markAllRead = useMutation({
        mutationFn: () => api.notifications.readAll(),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] });
            const previous = queryClient.getQueryData(['notifications']);

            // Optimistically update
            queryClient.setQueryData(['notifications'], (old: any) => {
                if (!old) return [];
                return old.map((n: any) => ({ ...n, read: true }));
            });
            setUnreadCount(0);

            return { previous };
        },
        onError: (_err, _new, context) => {
            queryClient.setQueryData(['notifications'], context?.previous);
        }
    });

    const markOneRead = useMutation({
        mutationFn: (id: string) => api.notifications.readOne(id),
        onMutate: async (id) => {
            // Optimistic update
            queryClient.setQueryData(['notifications'], (old: any) => {
                if (!old) return [];
                return old.map((n: any) => n.id === id ? { ...n, read: true } : n);
            });

            // Keep count somewhat in sync optimistically
            const currentCount = useUIStore.getState().unreadNotificationCount;
            if (currentCount > 0) setUnreadCount(currentCount - 1);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    });

    const displayList = notifications.filter((n: any) => filter === 'all' || !n.read);

    const handleAction = (n: any) => {
        if (!n.read) {
            markOneRead.mutate(n.id);
        }

        // Navigation based on type
        if (n.type === 'shift_published' || n.type === 'shift_updated') {
            navigate('/schedule');
        } else if (n.type.includes('swap') || n.type.includes('drop')) {
            navigate('/swaps');
        }
        if (onClose) onClose();
    };

    const content = (
        <div className="flex flex-col h-full bg-white">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-gray-700" />
                    <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
                </div>
                {isSlideOver && onClose && (
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={clsx(
                            "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                            filter === 'all' ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={clsx(
                            "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                            filter === 'unread' ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        Unread
                    </button>
                </div>
                <button
                    onClick={() => markAllRead.mutate()}
                    disabled={notifications.filter((n: any) => !n.read).length === 0}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Mark all read
                </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar">
                {isLoading ? (
                    <div className="p-8 flex justify-center">
                        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" />
                    </div>
                ) : displayList.length === 0 ? (
                    <div className="p-12 flex flex-col items-center text-center text-gray-500">
                        <CheckCircle2 className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="font-medium text-gray-800">You're all caught up</p>
                        <p className="text-sm mt-1">No {filter === 'unread' ? 'unread' : 'new'} notifications right now.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {displayList.map((notification: any) => (
                            <div
                                key={notification.id}
                                onClick={() => handleAction(notification)}
                                className={clsx(
                                    "p-4 flex gap-4 cursor-pointer hover:bg-gray-50 transition-colors relative",
                                    !notification.read && "bg-blue-50/30"
                                )}
                            >
                                {!notification.read && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                                )}

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h4 className={clsx(
                                            "text-sm tracking-tight truncate",
                                            notification.read ? "font-semibold text-gray-800" : "font-bold text-gray-900"
                                        )}>
                                            {notification.title}
                                        </h4>
                                        <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0 mt-0.5">
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                        </span>
                                    </div>
                                    <p className={clsx(
                                        "text-sm line-clamp-2",
                                        notification.read ? "text-gray-500" : "text-gray-700"
                                    )}>
                                        {notification.message}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isSlideOver && (
                <div className="p-3 border-t border-gray-100 text-center shrink-0">
                    <Link to="/notifications" onClick={onClose} className="text-sm font-semibold text-blue-600 hover:text-blue-700">
                        View all in full page
                    </Link>
                </div>
            )}
        </div>
    );

    if (isSlideOver) {
        return (
            <div className="fixed inset-y-0 right-0 w-full sm:w-[380px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
                {content}
            </div>
        );
    }

    return content;
}
