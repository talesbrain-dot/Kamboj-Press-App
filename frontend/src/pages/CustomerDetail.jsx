import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { formatINR, formatDate, STATUS_COLORS } from '../lib/api';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ArrowLeft, Phone, MapPin, MessageCircle } from 'lucide-react';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { api.get(`/customers/${id}`).then((r) => setData(r.data)); }, [id]);

  if (!data) return <div className="p-10 text-center text-slate-500">Loading...</div>;
  const { customer, orders } = data;
  const totalSpend = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalDue = orders.reduce((s, o) => s + (o.balance || 0), 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <Button variant="ghost" onClick={() => navigate(-1)} size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <div className="text-sm text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</div>
            {customer.address && <div className="text-sm text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{customer.address}</div>}
          </div>
          <a href={`https://wa.me/${(customer.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
            <Button variant="outline" className="text-emerald-600"><MessageCircle className="w-4 h-4 mr-2" />WhatsApp</Button>
          </a>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div><p className="text-xs text-slate-500">Orders</p><p className="font-semibold">{orders.length}</p></div>
          <div><p className="text-xs text-slate-500">Total Spend</p><p className="font-semibold">{formatINR(totalSpend)}</p></div>
          <div><p className="text-xs text-slate-500">Outstanding</p><p className="font-semibold text-rose-600">{formatINR(totalDue)}</p></div>
        </div>
      </Card>
      <div>
        <h2 className="font-medium mb-2">Order History</h2>
        <Card>
          {orders.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No orders</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {orders.map((o) => (
                <Link to={`/orders/${o.id}`} key={o.id} className="flex justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div>
                    <div className="font-medium">{o.order_no}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{formatDate(o.created_at)}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(o.products || []).map((p) => (
                        <span key={p.id} className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[p.status] || ''}`}>{p.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatINR(o.total)}</div>
                    {o.balance > 0 && <div className="text-xs text-rose-600">Bal: {formatINR(o.balance)}</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
