import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Bell, CheckCircle2, RotateCcw, Clock, Truck, IndianRupee, Sparkles } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const TYPE_META = {
  in_process: { label: 'In Process', icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
  delivery: { label: 'Delivery', icon: Truck, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200' },
  payment: { label: 'Payment', icon: IndianRupee, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200' },
  custom: { label: 'Custom', icon: Sparkles, color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
};

export default function Reminders() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/reminders', { params: { include_seen: true } });
      setList(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markSeen = async (key) => {
    try {
      await api.post('/reminders/dismiss', { key });
      setList((prev) => prev.map((r) => r.key === key ? { ...r, seen: true } : r));
      toast({ title: 'Marked as seen' });
    } catch { toast({ title: 'Failed', variant: 'destructive' }); }
  };

  const unmarkSeen = async (key) => {
    try {
      await api.post('/reminders/restore', { key });
      setList((prev) => prev.map((r) => r.key === key ? { ...r, seen: false } : r));
    } catch { toast({ title: 'Failed', variant: 'destructive' }); }
  };

  const unseen = list.filter((r) => !r.seen);
  const seen = list.filter((r) => r.seen);

  const renderItem = (r) => {
    const meta = TYPE_META[r.type] || TYPE_META.custom;
    const Icon = meta.icon;
    return (
      <div key={r.key} className="flex items-start gap-3 p-4 border-b border-slate-200 dark:border-slate-800 last:border-0">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${meta.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/orders/${r.order_id}`} className="font-medium hover:underline">{r.order_no}</Link>
            <span className="text-sm text-slate-600 dark:text-slate-300">• {r.customer_name}</span>
            <Badge variant="outline" className="text-xs">{meta.label}</Badge>
            {r.seen && <Badge variant="secondary" className="text-xs">Seen</Badge>}
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{r.message}</p>
          {r.customer_phone && <p className="text-xs text-slate-500 mt-0.5">{r.customer_phone}</p>}
        </div>
        <div className="shrink-0">
          {r.seen ? (
            <Button size="sm" variant="ghost" onClick={() => unmarkSeen(r.key)} title="Mark unseen">
              <RotateCcw className="w-4 h-4" />
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => markSeen(r.key)}>
              <CheckCircle2 className="w-4 h-4 mr-1" />Mark seen
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Bell className="w-6 h-6" />Reminders</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Reminders disappear automatically when the task is done. Latest first.</p>
      </div>

      {loading ? (
        <Card className="p-10 text-center text-slate-500">Loading...</Card>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
          <p className="text-slate-500">No reminders right now. Great work!</p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wide">
              New ({unseen.length})
            </div>
            {unseen.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">No new reminders</div>
            ) : unseen.map(renderItem)}
          </Card>
          {seen.length > 0 && (
            <Card>
              <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Seen ({seen.length})
              </div>
              {seen.map(renderItem)}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
