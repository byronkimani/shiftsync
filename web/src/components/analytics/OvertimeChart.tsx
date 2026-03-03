import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

export default function OvertimeChart({ data }: { data: any[] }) {
    // Sort so most hours are at the top
    const sortedData = [...data].sort((a, b) => b.totalHours - a.totalHours);

    const getBarColor = (hours: number) => {
        if (hours >= 40) return '#ef4444'; // Red-500
        if (hours >= 35) return '#f59e0b'; // Amber-500
        return '#22c55e'; // Green-500
    };

    return (
        <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    layout="vertical"
                    data={sortedData}
                    margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 'dataMax + 10']} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                        formatter={(value: any) => [`${value} hours`, 'Total Projected']}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />

                    <ReferenceLine x={35} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: '35h Warning', fill: '#f59e0b', fontSize: 10 }} />
                    <ReferenceLine x={40} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '40h OT Limit', fill: '#ef4444', fontSize: 10 }} />

                    <Bar dataKey="totalHours" radius={[0, 4, 4, 0]} maxBarSize={32}>
                        {sortedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getBarColor(entry.totalHours)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
