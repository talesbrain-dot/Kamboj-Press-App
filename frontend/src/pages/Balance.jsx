import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatINR, formatDate, STATUS_COLORS } from '../lib/api';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Search, Wallet, Phone, IndianRupee } from 'lucide-react';

export default function Balance() {
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/orders/balance/list');
        setOrders(r.data || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return orders;
    const s = q.toLowerCase();
    return orders.filter((o) =>
      (o.order_no || '').toLowerCase().includes(s) ||
      (o.customer_name || '').toLowerCase().includes(s) ||
      (o.customer_phone || '').toLowerCase().includes(s)
    );
  }, [orders, q]);

  const totals = useMemo(() => {
    let outstanding = 0;
    let totalValue = 0;
    for (const o of filtered) {
      outstanding += Number(o.balance || 0);
      totalValue += Number(o.total || 0);
    }
    return { outstanding, totalValue, count: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-5 max-w-5xl" data-testid="balance-page">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6" />Pending Balance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">All orders with an outstanding payment.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Orders Pending</div>
          <div className="text-2xl font-semibold mt-1" data-testid="balance-count">{totals.count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Total Outstanding</div>
          <div className="text-2xl font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center" data-testid="balance-total-outstanding">
            <IndianRupee className="w-5 h-5 mr-0.5" />{Number(totals.outstanding || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide">Combined Order Value</div>
          <div className="text-2xl font-semibold mt-1 flex items-center">
            <IndianRupee className="w-5 h-5 mr-0.5" />{Number(totals.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search order, customer or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="balance-search-input"
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No pending balances. All clear!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="block p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                data-testid={`balance-row-${o.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-orange-600 dark:text-orange-400">{o.order_no}</span>
                      <span className="text-slate-600 dark:text-slate-300">• {o.customer_name}</span>
                      {(o.products || []).slice(0, 3).map((p) => (
                        <Badge key={p.id} className={`${STATUS_COLORS[p.status] || ''} border-0 text-[10px]`}>
                          {p.status}
                        </Badge>
                      ))}
                      {(o.products || []).length > 3 && (
                        <span className="text-xs text-slate-400">+{o.products.length - 3} more</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />{o.customer_phone}
                      <span className="ml-2">{formatDate(o.created_at)}</span>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs text-slate-500">Balance Due</div>
                    <div className="text-lg font-semibold text-rose-600 dark:text-rose-400" data-testid={`balance-amount-${o.id}`}>
                      {formatINR(o.balance)}
                    </div>
                    <div className="text-xs text-slate-500">of {formatINR(o.total)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
