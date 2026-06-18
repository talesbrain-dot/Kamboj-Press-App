import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useBranding } from '../context/BrandingContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Trash2, Plus, Upload, Loader2, Download } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function Settings() {
  const { toast } = useToast();
  const { refresh: refreshBranding } = useBranding();
  const fileRef = useRef(null);
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newReminder, setNewReminder] = useState({ label: '', days: 3 });

  useEffect(() => { api.get('/settings').then((r) => setS(r.data)); }, []);

  const update = (k, v) => setS((p) => ({ ...p, [k]: v }));

  const onLogo = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 600 * 1024) { toast({ title: 'Image too large', description: 'Max 600KB', variant: 'destructive' }); return; }
    const reader = new FileReader();
    reader.onload = () => update('logo_base64', reader.result);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.patch('/settings', {
        app_name: s.app_name,
        company_name: s.company_name,
        company_phone: s.company_phone,
        company_address: s.company_address,
        logo_base64: s.logo_base64,
        reminder_in_process_days: Number(s.reminder_in_process_days) || 2,
        reminder_delivery_days: Number(s.reminder_delivery_days) || 7,
        reminder_payment_days: Number(s.reminder_payment_days) || 10,
        custom_reminders: s.custom_reminders || [],
      });
      setS(r.data);
      refreshBranding();
      toast({ title: 'Settings saved' });
    } catch (e) {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const addReminder = () => {
    if (!newReminder.label.trim() || !newReminder.days) return;
    const list = [...(s.custom_reminders || []), { label: newReminder.label.trim(), days: Number(newReminder.days) }];
    update('custom_reminders', list);
    setNewReminder({ label: '', days: 3 });
  };

  const removeReminder = (i) => update('custom_reminders', s.custom_reminders.filter((_, idx) => idx !== i));

  const exportBackup = async () => {
    try {
      const r = await api.get('/backup', { responseType: 'blob' });
      let filename = 'press-order-book-backup.xlsx';
      const cd = r.headers?.['content-disposition'] || r.headers?.['Content-Disposition'];
      if (cd) {
        const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
        if (m && m[1]) filename = decodeURIComponent(m[1]);
      } else {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        filename = `press-order-book-backup-${stamp}.xlsx`;
      }
      const blob = new Blob([r.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Backup downloaded', description: 'Excel file saved to your device.' });
    } catch (e) {
      toast({ title: 'Backup failed', variant: 'destructive' });
    }
  };

  if (!s) return <div className="p-10 text-center text-slate-500">Loading...</div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500">Company info, logo, and reminders</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-medium">App Branding</h2>
        <div className="space-y-1.5">
          <Label>App Name</Label>
          <Input value={s.app_name || ''} onChange={(e) => update('app_name', e.target.value)} placeholder="e.g. Sharma Press" />
          <p className="text-xs text-slate-500">Shown in the header, browser title and login screen.</p>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-medium">Company Info (Invoice)</h2>
        <div className="flex items-center gap-4">
          {s.logo_base64 ? (
            <img src={s.logo_base64} alt="logo" className="w-20 h-20 object-contain border border-slate-200 dark:border-slate-800 rounded-md bg-white p-1" />
          ) : (
            <div className="w-20 h-20 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">No logo</div>
          )}
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Upload Logo</Button>
            {s.logo_base64 && <Button variant="ghost" size="sm" onClick={() => update('logo_base64', '')}>Remove</Button>}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Company Name</Label><Input value={s.company_name || ''} onChange={(e) => update('company_name', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={s.company_phone || ''} onChange={(e) => update('company_phone', e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label>Address</Label><Textarea rows={2} value={s.company_address || ''} onChange={(e) => update('company_address', e.target.value)} /></div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-medium">Default Reminders</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Move to In-Process within (days)</Label>
            <Input type="number" min="1" value={s.reminder_in_process_days} onChange={(e) => update('reminder_in_process_days', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Deliver within (days)</Label>
            <Input type="number" min="1" value={s.reminder_delivery_days} onChange={(e) => update('reminder_delivery_days', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Payment pending after (days)</Label>
            <Input type="number" min="1" value={s.reminder_payment_days || 10} onChange={(e) => update('reminder_payment_days', e.target.value)} />
          </div>
        </div>
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-medium mb-2">Custom Reminders</h3>
          {(s.custom_reminders || []).length > 0 && (
            <ul className="space-y-2 mb-3">
              {s.custom_reminders.map((c, i) => (
                <li key={i} className="flex items-center justify-between border border-slate-200 dark:border-slate-800 rounded-md p-2">
                  <span className="text-sm">{c.label} — after <b>{c.days}</b> day(s)</span>
                  <Button variant="ghost" size="icon" onClick={() => removeReminder(i)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-12 gap-2">
            <Input className="col-span-7" placeholder="Label e.g. Follow up" value={newReminder.label} onChange={(e) => setNewReminder((p) => ({ ...p, label: e.target.value }))} />
            <Input type="number" min="1" className="col-span-3" value={newReminder.days} onChange={(e) => setNewReminder((p) => ({ ...p, days: e.target.value }))} />
            <Button className="col-span-2" variant="outline" onClick={addReminder}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="font-medium">Data Backup</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Download a full Excel (.xlsx) snapshot with separate sheets for orders, products, payments, customers and outstanding balances.</p>
        <Button type="button" variant="outline" onClick={exportBackup} data-testid="export-backup-btn">
          <Download className="w-4 h-4 mr-2" />Export Backup (Excel)
        </Button>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Settings
        </Button>
      </div>
    </div>
  );
}
