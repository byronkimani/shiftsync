import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { X } from 'lucide-react';

const shiftSchema = z.object({
    skillId: z.string().min(1, 'Skill is required'),
    date: z.string().min(1, 'Date is required'),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid format HH:MM'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid format HH:MM'),
    headcountRequired: z.number().min(1, 'Must be at least 1'),
    isPremium: z.boolean(),
    notes: z.string().optional(),
});

type ShiftFormValues = z.infer<typeof shiftSchema>;

interface CreateShiftModalProps {
    locationId: string;
    onClose: () => void;
}

export default function CreateShiftModal({ locationId, onClose }: CreateShiftModalProps) {
    const queryClient = useQueryClient();

    const { data: skills = [] } = useQuery({
        queryKey: ['skills'],
        queryFn: () => api.users.getMe().then(() => fetch(import.meta.env.VITE_API_URL + '/skills').then(r => r.json())),
    });

    const { register, handleSubmit, formState: { errors } } = useForm<ShiftFormValues>({
        resolver: zodResolver(shiftSchema),
        defaultValues: {
            headcountRequired: 1,
            isPremium: false,
        },
    });

    const mutation = useMutation({
        mutationFn: (data: ShiftFormValues) => {
            // Convert local date/time to UTC strings
            const localStartDate = new Date(`${data.date}T${data.startTime}:00`);
            const localEndDate = new Date(`${data.date}T${data.endTime}:00`);

            return api.shifts.create({
                locationId,
                skillId: data.skillId,
                startUtc: localStartDate.toISOString(),
                endUtc: localEndDate.toISOString(),
                headcountRequired: data.headcountRequired,
                isPremium: data.isPremium,
                notes: data.notes,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shifts', locationId] });
            onClose();
        },
    });

    const onSubmit = (data: ShiftFormValues) => {
        mutation.mutate(data);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Add Shift</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Skill</label>
                        <select
                            {...register('skillId')}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                            <option value="">Select a skill</option>
                            {skills.slice().map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {errors.skillId && <p className="text-red-500 text-xs mt-1">{errors.skillId.message}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                        <input
                            type="date"
                            {...register('date')}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date.message}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                            <input
                                type="time"
                                {...register('startTime')}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            {errors.startTime && <p className="text-red-500 text-xs mt-1">{errors.startTime.message}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                            <input
                                type="time"
                                {...register('endTime')}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            />
                            {errors.endTime && <p className="text-red-500 text-xs mt-1">{errors.endTime.message}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Headcount Required</label>
                        <input
                            type="number"
                            min="1"
                            {...register('headcountRequired', { valueAsNumber: true })}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        {errors.headcountRequired && <p className="text-red-500 text-xs mt-1">{errors.headcountRequired.message}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isPremium"
                            {...register('isPremium')}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="isPremium" className="text-sm font-medium text-gray-700">
                            Premium Shift
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                        <textarea
                            {...register('notes')}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                            rows={3}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={mutation.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {mutation.isPending ? 'Creating...' : 'Create Shift'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
