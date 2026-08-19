import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp, Wallet, CheckCircle2, Truck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';

const RANGES = ['7 Days', '30 Days', '3 Months', '1 Year'] as const;

const cargoVolume = [
  { day: 'Mon', volume: 42 },
  { day: 'Tue', volume: 58 },
  { day: 'Wed', volume: 49 },
  { day: 'Thu', volume: 73 },
  { day: 'Fri', volume: 65 },
  { day: 'Sat', volume: 51 },
  { day: 'Sun', volume: 38 },
];

const utilization = [
  { route: 'CHE-BLR', used: 78 },
  { route: 'CHE-CBE', used: 64 },
  { route: 'BLR-HYD', used: 88 },
  { route: 'HYD-CHE', used: 71 },
  { route: 'CHE-MDU', used: 55 },
];

const savings = [
  { m: 'Jan', savings: 1.2 },
  { m: 'Feb', savings: 1.6 },
  { m: 'Mar', savings: 2.1 },
  { m: 'Apr', savings: 2.8 },
  { m: 'May', savings: 3.4 },
  { m: 'Jun', savings: 4.1 },
];

const capacityMix = [
  { name: 'Trucks', value: 48, color: '#08A6A6' },
  { name: 'Trailers', value: 22, color: '#FF8A34' },
  { name: 'Containers', value: 18, color: '#14C8C8' },
  { name: 'Mini', value: 12, color: '#102A43' },
];

const matches = [
  { day: 'Mon', matches: 18 },
  { day: 'Tue', matches: 26 },
  { day: 'Wed', matches: 22 },
  { day: 'Thu', matches: 34 },
  { day: 'Fri', matches: 28 },
  { day: 'Sat', matches: 19 },
  { day: 'Sun', matches: 14 },
];

export function AnalyticsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>('30 Days');
  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Trends, savings and capacity utilization at a glance."
        actions={
          <div className="flex items-center gap-1 bg-white border border-border rounded-md p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md ${range === r ? 'bg-teal text-white' : 'text-navy hover:bg-background'}`}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Cargo Volume" value="376 t" icon={TrendingUp} trend="+12%" trendUp accent="teal" />
        <StatCard label="Cost Savings" value="₹18.4L" icon={Wallet} trend="+8%" trendUp accent="orange" />
        <StatCard label="Successful Matches" value="161" icon={CheckCircle2} trend="+4%" trendUp accent="cyan" />
        <StatCard label="Capacity Utilization" value="76%" icon={Truck} trend="+3%" trendUp accent="navy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <ChartHeader title="Cargo Volume" subtitle="Tons moved per day" />
          <div className="h-64 px-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cargoVolume}>
                <CartesianGrid stroke="#E5EAF0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="day" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E5EAF0' }} />
                <Line type="monotone" dataKey="volume" stroke="#08A6A6" strokeWidth={3} dot={{ r: 4, fill: '#08A6A6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <ChartHeader title="Route Utilization" subtitle="Average match utilization" />
          <div className="h-64 px-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={utilization}>
                <CartesianGrid stroke="#E5EAF0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="route" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E5EAF0' }} />
                <Bar dataKey="used" fill="#FF8A34" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <ChartHeader title="Cost Savings" subtitle="Monthly savings (₹L)" />
          <div className="h-64 px-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={savings}>
                <CartesianGrid stroke="#E5EAF0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="m" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E5EAF0' }} />
                <Line type="monotone" dataKey="savings" stroke="#14C8C8" strokeWidth={3} dot={{ r: 4, fill: '#14C8C8' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <ChartHeader title="Capacity Mix" subtitle="Vehicle distribution" />
          <div className="h-64 px-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={capacityMix} dataKey="value" innerRadius={50} outerRadius={90} paddingAngle={4}>
                  {capacityMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E5EAF0' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <ChartHeader title="Successful Matches" subtitle="Matches per day" />
          <div className="h-64 px-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={matches}>
                <CartesianGrid stroke="#E5EAF0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="day" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#E5EAF0' }} />
                <Bar dataKey="matches" fill="#08A6A6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ChartHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-5 py-4 border-b border-border">
      <h3 className="trh-section-title">{title}</h3>
      {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}