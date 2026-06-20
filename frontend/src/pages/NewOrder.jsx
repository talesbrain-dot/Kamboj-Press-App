import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { formatINR } from '../lib/api';
import { useStatuses } from '../context/StatusesContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Trash2, Plus, Loader2, UserSearch } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function NewOrder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { statuses: PRODUCT_STATUSES } = useStatuses();
  const isAdmin = user?.role === 'admin';
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [matched, setMatched] = useState(null);
  const [products, setProducts] = useState([{ name: '', quantity: 1, price: 0, status: 'Pending', notes: '' }]);
  const [advance, setAdvance] = useState(0);
  const [notes, setNotes] = useState('');
  const [staff, setStaff] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isAdmin) api.get('/users').then((r) => setStaff(r.data)).catch(() => {}); }, [isAdmin]);

  // Auto-detect customer by phone
  useEffect(() => {
    const phone = customerPhone.trim();
    if (phone.length < 5) { setMatched(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await api.get('/customers', { params: { q: phone } });
        const exact = r.data.find((c) => c.phone === phone);
        if (exact) {
          setMatched(exact);
          if (!customerName) setCustomerName(exact.name);
          if (!customerAddress) setCustomerAddress(exact.address || '');
        } else setMatched(null);
      } catch {}
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [customerPhone]);

  const updateProduct = (i, k, v) => {
    setProducts((arr) => arr.map((p, idx) => idx === i ? { ...p, [k]: v } : p));
  };
  const removeProduct = (i) => setProducts((arr) => arr.filter((_, idx) => idx !== i));
  const addProduct = () => setProducts((arr) => [...arr, { name: '', quantity: 1, price: 0, status: 'Pending', notes: '' }]);

  const total = products.reduce((s, p) => s + (Number(p.price) || 0), 0);
  const balance = Math.max(total - Number(advance || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      toast({ title: 'Missing details', description: 'Customer name and phone are required', variant: 'destructive' });
      return;
    }
    const valid = products.filter((p) => p.name.trim());
    if (!valid.length) { toast({ title: 'Add at least one product', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const r = await api.post('/orders', {
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        products: valid.map((p) => ({
          name: p.name.trim(),
          quantity: Number(p.quantity) || 1,
          price: Number(p.price) || 0,
          status: p.status,
          notes: p.notes || '',
        })),
        assigned_user_ids: assigned,
        advance_paid: Number(advance) || 0,
        notes: notes.trim(),
      });
      toast({ title: 'Order created', description: r.data.order_no });
      navigate(`/orders/${r.data.id}`);
    } catch (err) {
      toast({ title: 'Failed to create order', description: err?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Order</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Customer is auto-created. Existing customers are detected by phone.</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-medium">Customer</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Phone <span className="text-rose-500">*</span></Label>
            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g. 9876543210" required />
            {matched && <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><UserSearch className="w-3 h-3" /> Existing customer detected</div>}
          </div>
          <div className="space-y-1.5">
            <Label>Name <span className="text-rose-500">*</span></Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address (optional)</Label>
            <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Products</h2>
          <Button type="button" variant="outline" size="sm" onClick={addProduct}><Plus className="w-4 h-4 mr-1" />Add</Button>
        </div>
        <div className="space-y-3">
          {products.map((p, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-end border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <Label className="text-xs">Product name</Label>
                <Input value={p.name} onChange={(e) => updateProduct(i, 'name', e.target.value)} placeholder="e.g. Visiting Card" />
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">Qty</Label>
                <Input type="number" min="1" value={p.quantity} onChange={(e) => updateProduct(i, 'quantity', e.target.value)} />
              </div>
              <div className="col-span-4 sm:col-span-2 space-y-1">
                <Label className="text-xs">Price (₹)</Label>
                <Input type="number" min="0" step="0.01" value={p.price} onChange={(e) => updateProduct(i, 'price', e.target.value)} placeholder="Total for this product" />
              </div>
              <div className="col-span-4 sm:col-span-3 space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={p.status} onValueChange={(v) => updateProduct(i, 'status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRODUCT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon" onClick={() => removeProduct(i)} disabled={products.length === 1}>
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </Button>
              </div>
              <div className="col-span-12 space-y-1">
                <Input value={p.notes} onChange={(e) => updateProduct(i, 'notes', e.target.value)} placeholder="Notes (optional)" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-medium">Assign Team</h2>
        {!isAdmin ? (
          <p className="text-sm text-slate-500">You will be automatically assigned to this order.</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-slate-500">No team members yet. Add them in the Team page.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {staff.map((u) => (
              <label key={u.id} className="flex items-center gap-2 p-2 border border-slate-200 dark:border-slate-800 rounded-md cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <Checkbox
                  checked={assigned.includes(u.id)}
                  onCheckedChange={(c) => setAssigned((a) => c ? [...a, u.id] : a.filter((x) => x !== u.id))}
                />
                <span className="text-sm">{u.name} <span className="text-xs text-slate-500">({u.role})</span></span>
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-medium">Payment & Notes</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Advance Paid</Label>
            <Input type="number" min="0" step="0.01" value={advance} onChange={(e) => setAdvance(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Order Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
          <span>Total: <b>{formatINR(total)}</b></span>
          <span>Advance: <b>{formatINR(advance)}</b></span>
          <span>Balance: <b className="text-rose-600 dark:text-rose-400">{formatINR(balance)}</b></span>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
        <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create Order
        </Button>
      </div>
    </form>
  );
}
