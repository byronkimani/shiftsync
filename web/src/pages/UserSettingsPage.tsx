import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Settings, LogOut, CheckCircle, AlertCircle } from 'lucide-react';

export default function UserSettingsPage() {
    const { user } = useUser();
    const { signOut } = useClerk();
    const queryClient = useQueryClient();

    // Local form state
    const [name, setName] = useState('');
    const [desiredHours, setDesiredHours] = useState<number | ''>('');
    const [notificationInApp, setNotificationInApp] = useState(true);
    const [notificationEmail, setNotificationEmail] = useState(true);

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const { data: profile, isLoading } = useQuery({
        queryKey: ['me', user?.id],
        queryFn: () => api.users.getMe().then(res => res.data),
        enabled: !!user?.id,
    });

    useEffect(() => {
        if (profile) {
            setName(profile.name || '');
            setDesiredHours(profile.desiredHoursPerWeek || '');
            setNotificationInApp(profile.notificationInApp ?? true);
            setNotificationEmail(profile.notificationEmail ?? true);
        }
    }, [profile]);

    const updateMutation = useMutation({
        mutationFn: (data: any) => api.users.updateMe(data),
        onMutate: () => setSaveStatus('saving'),
        onSuccess: () => {
            setSaveStatus('success');
            queryClient.invalidateQueries({ queryKey: ['me'] });
            setTimeout(() => setSaveStatus('idle'), 3000);
        },
        onError: (err: any) => {
            setSaveStatus('error');
            setErrorMsg(err?.response?.data?.message || err.message || 'Failed to update profile');
            setTimeout(() => setSaveStatus('idle'), 5000);
        }
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate({
            name,
            desiredHoursPerWeek: desiredHours === '' ? null : Number(desiredHours),
            notificationInApp,
            notificationEmail
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-20">
                <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!profile) return null;

    return (
        <main className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24">
            <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6 text-gray-500" />
                Profile & Settings
            </h1>

            <form onSubmit={handleSave} className="space-y-8">

                {/* Profile Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold shrink-0">
                                {profile.name?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 leading-tight">{profile.name}</h2>
                                <p className="text-sm text-gray-500 capitalize">{profile.role}</p>
                            </div>
                        </div>

                        <div className="grid gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={profile.email}
                                    disabled
                                    className="w-full text-sm border-gray-200 bg-gray-50 text-gray-500 rounded-lg shadow-sm cursor-not-allowed"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Desired Hours / Week</label>
                                <input
                                    type="number"
                                    value={desiredHours}
                                    onChange={e => setDesiredHours(e.target.value === '' ? '' : Number(e.target.value))}
                                    min="0"
                                    max="80"
                                    step="0.5"
                                    className="w-full sm:w-48 text-sm border-gray-300 rounded-lg shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1.5">Helps your manager when assigning shifts manually or auto-scheduling.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notifications */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800">Notifications</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <label className="flex items-center justify-between cursor-pointer">
                            <div>
                                <div className="text-sm font-semibold text-gray-900">In-App Notifications</div>
                                <div className="text-xs text-gray-500 mt-0.5">Show notifications within ShiftSync.</div>
                            </div>
                            <input
                                type="checkbox"
                                checked={notificationInApp}
                                onChange={e => setNotificationInApp(e.target.checked)}
                                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                        </label>
                        <div className="border-t border-gray-100 pt-4">
                            <label className="flex items-center justify-between cursor-pointer">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">Email Notifications</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Receive shift updates and requests via email.</div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={notificationEmail}
                                    onChange={e => setNotificationEmail(e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                {/* System Info (Read Only) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800">Assigned Roles & Locations</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Contact your manager if this needs to be updated.</p>
                    </div>
                    <div className="p-6 grid sm:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Skills</h3>
                            {profile.skills?.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {profile.skills.map((s: any) => (
                                        <span key={s.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                            {s.name}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No specific skills listed.</p>
                            )}
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Your Locations</h3>
                            {profile.locations?.length > 0 ? (
                                <div className="space-y-2">
                                    {profile.locations.map((l: any) => (
                                        <div key={l.locationId} className="text-sm font-medium text-gray-800">
                                            {l.location?.name}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">Not assigned to any locations.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Save Block */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                    <button
                        type="button"
                        onClick={() => signOut()}
                        className="w-full sm:w-auto text-sm text-red-600 font-semibold flex items-center justify-center gap-2 px-4 py-2.5 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>

                    <div className="w-full sm:w-auto flex items-center justify-end gap-3 flex-row-reverse sm:flex-row">
                        {saveStatus === 'success' && (
                            <div className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                                <CheckCircle className="w-4 h-4" /> Saved!
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div className="flex items-center gap-1.5 text-red-600 text-sm font-semibold">
                                <AlertCircle className="w-4 h-4" /> {errorMsg}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={saveStatus === 'saving'}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50"
                        >
                            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>

            </form>
        </main>
    );
}
