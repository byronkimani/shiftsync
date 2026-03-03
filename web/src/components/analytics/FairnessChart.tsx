import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

export default function FairnessChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="p-8 text-center text-gray-500">No data available</div>;

    const expectedShare = data[0]?.expectedShare || 0;

    return (
        <div className="w-full h-80 relative">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                    />
                    <YAxis label={{ value: 'Premium Shifts', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }} />
                    <Tooltip
                        formatter={(value: any, _name: any, props: any) => [
                            value,
                            props.payload.isFlagged ? 'Premium Shifts (Flagged)' : 'Premium Shifts'
                        ]}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />

                    <ReferenceLine
                        y={expectedShare}
                        stroke="#6b7280"
                        strokeDasharray="3 3"
                        label={{ position: 'top', value: `Expected: ${expectedShare.toFixed(1)}`, fill: '#6b7280', fontSize: 11 }}
                    />

                    <Bar dataKey="premiumShiftsCount" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.isFlagged ? '#eab308' : '#3b82f6'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Custom Legend/Note */}
            <div className="absolute top-0 right-4 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-gray-600">
                    <div className="w-3 h-3 rounded-sm bg-[#3b82f6]"></div> Normal
                </div>
                <div className="flex items-center gap-1.5 font-medium text-amber-600">
                    <div className="w-3 h-3 rounded-sm bg-[#eab308]"></div> &gt;20% Deviation
                </div>
            </div>
        </div>
    );
}
