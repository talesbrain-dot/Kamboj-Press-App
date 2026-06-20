import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { STATUS_COLORS, formatINR, formatDate } from '../lib/api';
import { useStatuses } from '../context/StatusesContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { ArrowLeft, MessageCircle, FileText, IndianRupee, Trash2, Loader2, Pencil } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

const WA_TEMPLATES = {
  Pending: (o, p) => `Hello ${o.customer_name}, your order ${o.order_no} for "${p.name}" is received and pending.`,
  Designing: (o, p) => `Hello ${o.customer_name}, design work has started on "${p.name}" (Order ${o.order_no}).`,
  Offset: (o, p) => `Hello ${o.customer_name}, offset printing has started for "${p.name}" (Order ${o.order_no}).`,
  'Digital Printing': (o, p) => `Hello ${o.customer_name}, digital printing has started for "${p.name}" (Order ${o.order_no}).`,
  Printing: (o, p) => `Hello ${o.customer_name}, printing has started for "${p.name}" (Order ${o.order_no}).`,
  Binding: (o, p) => `Hello ${o.customer_name}, binding is in progress for "${p.name}" (Order ${o.order_no}).`,
  Ready: (o, p) => `Good news ${o.customer_name}! Your "${p.name}" (Order ${o.order_no}) is ready for pickup/delivery.`,
  Delivered: (o, p) => `Hello ${o.customer_name}, your "${p.name}" (Order ${o.order_no}) has been delivered. Thank you!`,
};

const waMessage = (status, o, p) => {
  const fn = WA_TEMPLATES[status];
  if (fn) return fn(o, p);
  return `Hello ${o.customer_name}, update on your order ${o.order_no} — "${p.name}" is now: ${status}.`;
};

function waLink(phone, msg) {
  const num = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { statuses: PRODUCT_STATUSES } = useStatuses();
  const isAdmin = user?.role === 'admin';
  const [order, setOrder] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmt, setPayAmt] = useState('');
  const [payNote, setPayNote] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSel, setAssignSel] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/orders/${id}`);
      setOrder(r.data);
      setAssignSel(r.data.assigned_user_ids || []);
    } catch (e) {
      toast({ title: 'Order not found', variant: 'destructive' });
      navigate('/');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (isAdmin) api.get('/users').then((r) => setStaff(r.data)); }, [isAdmin]);

  const updateStatus = async (productId, status) => {
    try {
      const r = await api.patch(`/orders/${id}/products/${productId}`, { status });
      setOrder(r.data);
      toast({ title: 'Status updated', description: status });
    } catch (e) {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const recordPayment = async () => {
    const amt = Number(payAmt);
    if (!amt || amt <= 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    try {
      const r = await api.post(`/orders/${id}/payments`, { amount: amt, note: payNote });
      setOrder(r.data);
      setPayOpen(false); setPayAmt(''); setPayNote('');
      toast({ title: 'Payment recorded' });
    } catch (e) {
      toast({ title: 'Failed', variant: 'destructive' });
    }
  };

  const [editPayId, setEditPayId] = useState(null);
  const [editPayAmt, setEditPayAmt] = useState('');

  const startEditPayment = (p) => { setEditPayId(p.id); setEditPayAmt(String(p.amount)); };
  const cancelEditPayment = () => { setEditPayId(null); setEditPayAmt(''); };
  const saveEditPayment = async (paymentId) => {
    const amt = Number(editPayAmt);
    if (isNaN(amt) || amt < 0) { toast({ title: 'Enter a valid amount', variant: 'destructive' }); return; }
    try {
      const r = await api.patch(`/orders/${id}/payments/${paymentId}`, { amount: amt });
      setOrder(r.data);
      cancelEditPayment();
      toast({ title: 'Payment updated' });
    } catch (e) {
      toast({ title: 'Update failed', description: e?.response?.data?.detail || '', variant: 'destructive' });
    }
  };
  const deletePayment = async (paymentId) => {
    if (!window.confirm('Yeh payment delete kar dein?')) return;
    try {
      const r = await api.delete(`/orders/${id}/payments/${paymentId}`);
      setOrder(r.data);
      toast({ title: 'Payment deleted' });
    } catch (e) {
      toast({ title: 'Delete failed', description: e?.response?.data?.detail || '', variant: 'destructive' });
    }
  };

  const saveAssign = async () => {
    try {
      const r = await api.patch(`/orders/${id}`, { assigned_user_ids: assignSel });
      setOrder(r.data); setAssignOpen(false);
      toast({ title: 'Team updated' });
    } catch (e) { toast({ title: 'Failed', variant: 'destructive' }); }
  };

  const deleteOrder = async () => {
    if (!window.confirm('Delete this order? This cannot be undone.')) return;
    try { await api.delete(`/orders/${id}`); navigate('/'); } catch { toast({ title: 'Failed', variant: 'destructive' }); }
  };

  if (loading || !order) return <div className="p-10 text-center text-slate-500">Loading...</div>;

  const assignedUsers = staff.filter((u) => (order.assigned_user_ids || []).includes(u.id));

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{order.order_no}</h1>
            <p className="text-xs text-slate-500">Created {formatDate(order.created_at)} by {order.created_by_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/orders/${order.id}/invoice`}>
            <Button variant="outline"><FileText className="w-4 h-4 mr-2" />Invoice</Button>
          </Link>
          <Link to={`/orders/${order.id}/edit`}>
            <Button variant="outline"><Pencil className="w-4 h-4 mr-2" />Edit</Button>
          </Link>
          {isAdmin && (
            <Button variant="outline" onClick={deleteOrder} className="text-rose-600 hover:text-rose-700" data-testid="delete-order-btn">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2 space-y-4">
          <div>
            <h2 className="font-medium">Customer</h2>
            <div className="mt-2 text-sm">
              <div className="font-medium">{order.customer_name}</div>
              <div className="text-slate-600 dark:text-slate-300">{order.customer_phone}</div>
              {order.customer_address && <div className="text-slate-500 mt-1">{order.customer_address}</div>}
              {isAdmin && (
                <Link to={`/customers/${order.customer_id}`} className="text-xs text-orange-600 hover:underline">View customer history</Link>
              )}
            </div>
          </div>
          <div>
            <h2 className="font-medium mb-2">Products</h2>
            <div className="space-y-2">
              {(order.products || []).map((p) => (
                <div key={p.id} className="border border-slate-200 dark:border-slate-800 rounded-md p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500">Qty: {p.quantity} • Price: {formatINR(p.price)}</div>
                      {p.notes && <div className="text-xs text-slate-500 mt-0.5">{p.notes}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${STATUS_COLORS[p.status] || ''} border-0`}>{p.status}</Badge>
                      <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v)}>
                        <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <a href={waLink(order.customer_phone, waMessage(p.status, order, p))} target="_blank" rel="noreferrer">
                        <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-600 hover:text-emerald-700" title="Send WhatsApp update">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {order.notes && (
            <div>
              <h2 className="font-medium">Notes</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 space-y-3">
            <h2 className="font-medium">Payment</h2>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>Total</span><span className="font-medium">{formatINR(order.total)}</span></div>
              <div className="flex justify-between"><span>Paid</span><span className="font-medium text-emerald-600">{formatINR(order.paid)}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1 mt-1"><span>Balance</span><span className="font-semibold text-rose-600">{formatINR(order.balance)}</span></div>
            </div>
            {isAdmin && order.balance > 0 && (
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setPayOpen(true)}>
                <IndianRupee className="w-4 h-4 mr-2" /> Pay Balance
              </Button>
            )}
            {(order.payments || []).length > 0 && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 mb-1">Payment history</p>
                <ul className="text-xs space-y-1">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2" data-testid={`payment-row-${p.id}`}>
                      <span className="text-slate-500 shrink-0">{formatDate(p.at)}</span>
                      {isAdmin && editPayId === p.id ? (
                        <>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editPayAmt}
                            onChange={(e) => setEditPayAmt(e.target.value)}
                            className="h-7 text-xs w-24 ml-auto"
                            data-testid={`edit-payment-input-${p.id}`}
                            autoFocus
                          />
                          <Button size="sm" className="h-7 px-2 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => saveEditPayment(p.id)} data-testid={`save-payment-${p.id}`}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelEditPayment}>×</Button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium ml-auto">{formatINR(p.amount)}</span>
                          {isAdmin && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => startEditPayment(p)}
                                title="Edit payment"
                                data-testid={`edit-payment-btn-${p.id}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-rose-600 hover:text-rose-700"
                                onClick={() => deletePayment(p.id)}
                                title="Delete payment"
                                data-testid={`delete-payment-btn-${p.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          {isAdmin && (
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Assigned Team</h2>
                <Button variant="ghost" size="sm" onClick={() => setAssignOpen(true)}>Edit</Button>
              </div>
              {assignedUsers.length === 0 ? (
                <p className="text-sm text-slate-500">No one assigned</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {assignedUsers.map((u) => <Badge key={u.id} variant="secondary">{u.name}</Badge>)}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} autoFocus />
              <p className="text-xs text-slate-500">Balance due: {formatINR(order.balance)}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="e.g. UPI / Cash" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={recordPayment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Team</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-72 overflow-auto">
            {staff.map((u) => (
              <label key={u.id} className="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-800 rounded-md cursor-pointer">
                <Checkbox checked={assignSel.includes(u.id)} onCheckedChange={(c) => setAssignSel((a) => c ? [...a, u.id] : a.filter((x) => x !== u.id))} />
                <span className="text-sm">{u.name} <span className="text-xs text-slate-500">({u.role})</span></span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={saveAssign}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
