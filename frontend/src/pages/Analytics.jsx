import React, { useEffect, useMemo, useState } from 'react';
import api, { formatINR } from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  BarChart3, ShoppingCart, IndianRupee, CheckCircle2, Clock, Wallet, Loader2,
} from 'lucide-react';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card className="p-4" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-2xl font-semibold mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export default function Analytics() {
  const [periods, setPeriods] = useState({ years: [], months: [] });
  const [scope, setScope] = useState('all'); // 'all' | 'year' | 'month'
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/stats/periods').then((r) => {
      setPeriods(r.data);
      const ys = r.data.years || [];
      if (ys.length && !year) setYear(String(ys[0]));
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const monthsForYear = useMemo(() => {
    if (!year) return [];
    return (periods.months || []).filter((m) => String(m.year) === String(year));
  }, [periods, year]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = {};
        if (scope === 'year' && year) params.year = year;
        if (scope === 'month' && year && month) { params.year = year; params.month = month; }
        const r = await api.get('/stats', { params });
        setStats(r.data);
      } finally { setLoading(false); }
    };
    load();
  }, [scope, year, month]);

  const periodLabel = useMemo(() => {
    if (scope === 'all') return 'All-time';
    if (scope === 'year' && year) return `Year ${year}`;
    if (scope === 'month' && year && month) return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
    return '—';
  }, [scope, year, month]);

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-orange-500" />
            Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Confidential — admin only. Sort by month or year.</p>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Range</label>
            <div className="flex gap-1">
              {['all', 'year', 'month'].map((s) => (
                <Button
                  key={s}
                  variant={scope === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScope(s)}
                  className={scope === s ? 'bg-orange-500 hover:bg-orange-600 text-white' : ''}
                  data-testid={`scope-${s}`}
                >
                  {s === 'all' ? 'All-time' : s === 'year' ? 'Year' : 'Month'}
                </Button>
              ))}
            </div>
          </div>

          {scope !== 'all' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Year</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-28" data-testid="year-select"><SelectValue placeholder="Year" /></SelectTrigger>
                <SelectContent>
                  {(periods.years || []).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {scope === 'month' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">Month</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36" data-testid="month-select"><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                  {monthsForYear.map((m) => (
                    <SelectItem key={`${m.year}-${m.month}`} value={String(m.month)}>{MONTH_NAMES[m.month - 1]} {m.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="ml-auto text-sm font-medium text-slate-700 dark:text-slate-200" data-testid="period-label">
            {periodLabel}
          </div>
        </div>
      </Card>

      {loading && !stats ? (
        <div className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : stats ? (
        <>
          <div>
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{periodLabel}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard icon={ShoppingCart} label="Total Orders" value={stats.total_orders} accent="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" />
              <StatCard icon={IndianRupee} label="Total Amount" value={formatINR(stats.total_revenue)} accent="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" />
              <StatCard icon={Clock} label="In Progress" value={stats.in_progress} accent="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />
              <StatCard icon={CheckCircle2} label="Delivered" value={stats.delivered} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
              <StatCard icon={Wallet} label="Balance Due" value={formatINR(stats.balance_due)} accent="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" />
            </div>
          </div>
          {stats.today && (
            <div>
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Today</h2>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard icon={ShoppingCart} label="Today's Orders" value={stats.today.total_orders} accent="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" />
                <StatCard icon={IndianRupee} label="Today's Amount" value={formatINR(stats.today.total_revenue)} accent="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" />
                <StatCard icon={Clock} label="In Progress" value={stats.today.in_progress} accent="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" />
                <StatCard icon={CheckCircle2} label="Delivered" value={stats.today.delivered} accent="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" />
                <StatCard icon={Wallet} label="Balance Due" value={formatINR(stats.today.balance_due)} accent="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" />
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-slate-500 text-sm">No data.</p>
      )}
    </div>
  );
}
