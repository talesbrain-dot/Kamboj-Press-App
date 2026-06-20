import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatINR, formatDate, STATUS_COLORS } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Bell, Plus, Search, ShoppingCart, MessageCircle } from 'lucide-react';

function orderOverallStatus(o) {
  const s = (o.products || []).map((p) => p.status);
  if (!s.length) return 'Pending';
  if (s.every((x) => x === 'Delivered')) return 'Delivered';
  if (s.every((x) => x === 'Pending')) return 'Pending';
  if (s.every((x) => x === 'Ready')) return 'Ready';
  return 'In Progress';
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [orders, setOrders] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const oRes = await api.get('/orders');
      setOrders(oRes.data);
      if (isAdmin) {
        const r = await api.get('/reminders', { params: { include_seen: false } });
        setReminders(r.data);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter((o) =>
      (o.order_no || '').toLowerCase().includes(q) ||
      (o.customer_name || '').toLowerCase().includes(q) ||
      (o.customer_phone || '').toLowerCase().includes(q)
    );
  }, [orders, search]);

  const reminderOrderIds = new Set(reminders.map((r) => r.order_id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">All orders, latest first</p>
        </div>
        {isAdmin || user?.role === 'staff' ? (
          <Link to="/orders/new">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="w-4 h-4 mr-2" /> New Order
            </Button>
          </Link>
        ) : null}
      </div>

      {/* Reminders banner */}
      {isAdmin && reminders.length > 0 && (
        <Card className="p-4 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-medium text-amber-900 dark:text-amber-200">{reminders.length} new reminder{reminders.length > 1 ? 's' : ''}</h3>
                <Link to="/reminders" className="text-xs text-amber-900 dark:text-amber-200 hover:underline font-medium">View all reminders →</Link>
              </div>
              <ul className="mt-2 space-y-1.5">
                {reminders.slice(0, 8).map((r) => (
                  <li key={r.key} className="text-sm flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Link to={`/orders/${r.order_id}`} className="text-amber-900 dark:text-amber-200 hover:underline font-medium">
                        {r.order_no} • {r.customer_name}
                      </Link>
                      <span className="text-amber-800/80 dark:text-amber-200/80"> — {r.message}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      onClick={async () => {
                        try {
                          await api.post('/reminders/dismiss', { key: r.key });
                          setReminders((prev) => prev.filter((x) => x.key !== r.key));
                        } catch {}
                      }}
                    >Mark seen</Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Stats moved to /analytics (admin only) */}

      {/* Search */}
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search by order no, customer name or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {/* Orders list */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No orders yet.</p>
            {isAdmin && <Link to="/orders/new"><Button className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4 mr-2" />Create first order</Button></Link>}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((o) => {
              const overall = orderOverallStatus(o);
              const hasReminder = reminderOrderIds.has(o.id);
              return (
                <Link to={`/orders/${o.id}`} key={o.id} className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{o.order_no}</span>
                        <Badge variant="outline" className="text-xs">{overall}</Badge>
                        {hasReminder && <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs"><Bell className="w-3 h-3 mr-1" />Reminder</Badge>}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300 mt-1 truncate">
                        {o.customer_name} • {o.customer_phone}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{(o.products || []).length} product(s) • {formatDate(o.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatINR(o.total)}</div>
                      {o.balance > 0 ? (
                        <div className="text-xs text-rose-600 dark:text-rose-400">Bal: {formatINR(o.balance)}</div>
                      ) : (
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">Paid</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(o.products || []).slice(0, 6).map((p) => (
                      <span key={p.id} className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[p.status] || ''}`}>
                        {p.name}: {p.status}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
