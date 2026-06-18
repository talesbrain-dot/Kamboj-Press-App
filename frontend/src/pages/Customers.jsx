import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { formatDate } from '../lib/api';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, Phone, User, Trash2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function Customers() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = async (query = '') => {
    setLoading(true);
    try {
      const r = await api.get('/customers', { params: query ? { q: query } : {} });
      setList(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q]);

  const remove = async (e, c) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete customer "${c.name}"? This cannot be undone.`)) return;
    setDeletingId(c.id);
    try {
      await api.delete(`/customers/${c.id}`);
      setList((prev) => prev.filter((x) => x.id !== c.id));
      toast({ title: 'Customer deleted' });
    } catch (err) {
      toast({
        title: 'Cannot delete',
        description: err?.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    } finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Auto-created when you make an order. Customers with orders cannot be deleted.</p>
      </div>
      <Card className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </Card>
      <Card>
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading...</div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No customers yet</div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {list.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <Link to={`/customers/${c.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 flex items-center justify-center"><User className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</div>
                  </div>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-xs text-slate-500 hidden sm:block">{formatDate(c.updated_at)}</div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => remove(e, c)}
                    disabled={deletingId === c.id}
                    title="Delete customer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
