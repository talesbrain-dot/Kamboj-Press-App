import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { formatINR, formatDate, STATUS_COLORS, PRODUCT_STATUSES } from '../lib/api';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Printer, Phone, Package, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function StatusQueue() {
  const { status: paramStatus } = useParams();
  const initial = paramStatus && PRODUCT_STATUSES.includes(paramStatus) ? paramStatus : 'Offset';
  const { toast } = useToast();
  const [status, setStatus] = useState(initial);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingKey, setUpdatingKey] = useState(null);

  useEffect(() => {
    if (paramStatus && PRODUCT_STATUSES.includes(paramStatus)) {
      setStatus(paramStatus);
    }
  }, [paramStatus]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get('/orders');
        setOrders(r.data);
      } finally { setLoading(false); }
    })();
  }, []);

  // Flatten products matching status
  const rows = useMemo(() => {
    const out = [];
    for (const o of orders) {
      for (const p of (o.products || [])) {
        if (p.status === status) {
          out.push({
            key: `${o.id}-${p.id}`,
            order_id: o.id,
            order_no: o.order_no,
            product_id: p.id,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            product: p,
            order_total: o.total,
            order_balance: o.balance,
            created_at: o.created_at,
            updated_at: p.updated_at || o.updated_at,
          });
        }
      }
    }
    out.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return out;
  }, [orders, status]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      (r.order_no || '').toLowerCase().includes(s) ||
      (r.customer_name || '').toLowerCase().includes(s) ||
      (r.customer_phone || '').toLowerCase().includes(s) ||
      (r.product?.name || '').toLowerCase().includes(s)
    );
  }, [rows, q]);

  const changeStatus = async (row, newStatus) => {
    if (!newStatus || newStatus === row.product.status) return;
    setUpdatingKey(row.key);
    try {
      const r = await api.patch(`/orders/${row.order_id}/products/${row.product_id}`, { status: newStatus });
      const updatedOrder = r.data;
      setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
      toast({ title: 'Status updated', description: `${row.product.name} → ${newStatus}` });
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e?.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Printer className="w-6 h-6" />Production Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {filtered.length} product{filtered.length === 1 ? '' : 's'} currently in <b>{status}</b>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40" data-testid="queue-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search order, customer or product" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">No products in {status} right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((r) => (
              <div key={r.key} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <Link to={`/orders/${r.order_id}`} className="flex-1 min-w-0">
                    <div className="font-medium">{r.product.name}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Qty: {r.product.quantity} • Price: {formatINR(r.product.price)}
                    </div>
                    {r.product.notes && <div className="text-xs text-slate-500 mt-0.5 italic">{r.product.notes}</div>}
                  </Link>
                  <div className="sm:text-right space-y-1 sm:min-w-[220px]">
                    <div className="text-sm">
                      <Link to={`/orders/${r.order_id}`} className="font-medium text-orange-600 dark:text-orange-400 hover:underline">{r.order_no}</Link>
                      <span className="text-slate-500"> • {r.customer_name}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex sm:justify-end items-center gap-1">
                      <Phone className="w-3 h-3" />{r.customer_phone}
                    </div>
                    <div className="flex sm:justify-end items-center gap-2 pt-1">
                      {updatingKey === r.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
                      <Select
                        value={r.product.status}
                        onValueChange={(v) => changeStatus(r, v)}
                        disabled={updatingKey === r.key}
                      >
                        <SelectTrigger
                          className={`h-8 w-40 text-xs border-0 ${STATUS_COLORS[r.product.status] || ''}`}
                          data-testid={`inline-status-${r.product_id}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-slate-400">{formatDate(r.updated_at)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
