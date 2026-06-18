import React, { useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { useBranding } from '../context/BrandingContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Trash2, Plus, Upload, Loader2, Download, FileSpreadsheet, Cloud, CloudOff, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function Settings() {
  const { toast } = useToast();
  const { refresh: refreshBranding } = useBranding();
  const fileRef = useRef(null);
  const gdriveFileRef = useRef(null);
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newReminder, setNewReminder] = useState({ label: '', days: 3 });

  // Google Drive state
  const [gdrive, setGdrive] = useState(null);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [gdriveJson, setGdriveJson] = useState(null);
  const [gdriveJsonName, setGdriveJsonName] = useState('');
  const [gdriveSheet, setGdriveSheet] = useState('');

  useEffect(() => {
    api.get('/settings').then((r) => setS(r.data));
    loadGdrive();
  }, []);

  const loadGdrive = async () => {
    try {
      const r = await api.get('/gdrive/status');
      setGdrive(r.data);
    } catch (e) { /* not admin or not configured */ }
  };

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

  const exportSummary = async () => {
    try {
      const r = await api.get('/backup/summary', { responseType: 'blob' });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const blob = new Blob([r.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-summary-${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Order summary downloaded' });
    } catch (e) {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  // ---------- Google Drive ----------
  const onGdriveJson = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.json')) {
      toast({ title: 'JSON file chahiye', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.type !== 'service_account' || !parsed.client_email) {
          throw new Error('Not a service-account JSON');
        }
        setGdriveJson(parsed);
        setGdriveJsonName(f.name);
        toast({ title: 'JSON loaded', description: parsed.client_email });
      } catch (err) {
        toast({ title: 'Invalid service-account JSON', variant: 'destructive' });
      }
    };
    reader.readAsText(f);
  };

  const connectGdrive = async () => {
    if (!gdriveJson) { toast({ title: 'Service-account JSON select karein', variant: 'destructive' }); return; }
    if (!gdriveSheet.trim()) { toast({ title: 'Google Sheet URL ya ID dijiye', variant: 'destructive' }); return; }
    setGdriveLoading(true);
    try {
      const r = await api.post('/gdrive/connect', {
        service_account_json: gdriveJson,
        spreadsheet: gdriveSheet.trim(),
        auto_sync: true,
      });
      setGdrive(r.data);
      setGdriveJson(null);
      setGdriveJsonName('');
      setGdriveSheet('');
      toast({ title: 'Google Drive connected', description: 'Sheet me data sync ho gaya.' });
    } catch (e) {
      toast({
        title: 'Connect failed',
        description: e?.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    } finally { setGdriveLoading(false); }
  };

  const syncGdriveNow = async () => {
    setGdriveLoading(true);
    try {
      const r = await api.post('/gdrive/sync');
      toast({ title: 'Synced to Drive', description: `${r.data.rows} rows updated.` });
      await loadGdrive();
    } catch (e) {
      toast({
        title: 'Sync failed',
        description: e?.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    } finally { setGdriveLoading(false); }
  };

  const toggleAutoSync = async () => {
    if (!gdrive) return;
    try {
      const r = await api.patch('/gdrive/auto-sync', { auto_sync: !gdrive.auto_sync });
      setGdrive(r.data);
    } catch (e) {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  const disconnectGdrive = async () => {
    if (!window.confirm('Disconnect Google Drive? Sheet Drive me rahegi, lekin app sync band kar dega.')) return;
    setGdriveLoading(true);
    try {
      await api.delete('/gdrive/disconnect');
      setGdrive({ connected: false });
      toast({ title: 'Disconnected' });
    } catch (e) {
      toast({
        title: 'Disconnect failed',
        description: e?.response?.data?.detail || e?.message || 'Try again',
        variant: 'destructive',
      });
    } finally { setGdriveLoading(false); }
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

      <Card className="p-5 space-y-3">
        <h2 className="font-medium flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />Order Summary Export</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Compact table — one row per product with order no., date, customer, phone, qty, product, price, total, advance, balance.
        </p>
        <Button type="button" variant="outline" onClick={exportSummary} data-testid="export-summary-btn">
          <Download className="w-4 h-4 mr-2" />Download Order Summary (Excel)
        </Button>
      </Card>

      <Card className="p-5 space-y-4" data-testid="gdrive-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium flex items-center gap-2">
              <Cloud className="w-4 h-4 text-blue-600" />Google Drive Auto-Sync
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Har order change pe order summary automatically aapki Drive ki Google Sheet me sync ho jayegi.
            </p>
          </div>
          {gdrive?.connected && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Cloud className="w-3 h-3" />Connected
            </span>
          )}
        </div>

        {!gdrive?.connected ? (
          <div className="space-y-3">
            <details className="text-sm bg-slate-50 dark:bg-slate-800/40 rounded-md p-3 border border-slate-200 dark:border-slate-800" open>
              <summary className="cursor-pointer font-medium">Setup steps (one-time)</summary>
              <ol className="list-decimal pl-5 mt-2 space-y-1 text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                <li>Go to <a className="text-blue-600 underline" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a> → create a project (free).</li>
                <li><b>APIs &amp; Services → Library</b> → enable <b>Google Drive API</b> and <b>Google Sheets API</b>.</li>
                <li><b>IAM &amp; Admin → Service Accounts → Create Service Account</b>. Give it any name (no roles needed). Click Done.</li>
                <li>Open the service account → <b>Keys → Add Key → Create new key → JSON</b>. A JSON file downloads — keep it safe.</li>
                <li>Open <a className="text-blue-600 underline" href="https://drive.google.com" target="_blank" rel="noreferrer">Google Drive</a> → <b>+ New → Google Sheets</b> → ek blank sheet banao (naam: <i>Kamboj Press Orders</i>).</li>
                <li>Sheet ke right-top <b>Share</b> button → JSON file me se <code>client_email</code> (ends with <code>@*.iam.gserviceaccount.com</code>) paste karo → <b>Editor</b> access → Send.</li>
                <li>Sheet ka URL copy karo (browser address bar se) ya sirf ID (URL me <code>/d/</code> ke baad ka string). Niche paste karo → Connect.</li>
              </ol>
              <div className="mt-2 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded p-2 border border-amber-200 dark:border-amber-900">
                ⚠️ <b>Important:</b> Sheet aap khud banao Drive me — service account khud file nahi bana sakta (Google ki storage quota limitation hai).
              </div>
            </details>

            <div className="space-y-2">
              <Label>Service-Account JSON</Label>
              <div className="flex items-center gap-2">
                <input ref={gdriveFileRef} type="file" accept="application/json,.json" onChange={onGdriveJson} className="hidden" />
                <Button type="button" variant="outline" size="sm" onClick={() => gdriveFileRef.current?.click()} data-testid="gdrive-json-btn">
                  <Upload className="w-4 h-4 mr-2" />Select JSON
                </Button>
                {gdriveJsonName && (
                  <span className="text-xs text-slate-500 truncate">{gdriveJsonName} — {gdriveJson?.client_email}</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Google Sheet URL or ID</Label>
              <Input
                placeholder="https://docs.google.com/spreadsheets/d/<ID>/edit  (ya sirf ID)"
                value={gdriveSheet}
                onChange={(e) => setGdriveSheet(e.target.value)}
                data-testid="gdrive-sheet-input"
              />
              <p className="text-xs text-slate-500">Drive me sheet bana ke service-account email ke saath Editor share karna na bhulein.</p>
            </div>

            <Button
              type="button"
              onClick={connectGdrive}
              disabled={gdriveLoading || !gdriveJson || !gdriveSheet.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="gdrive-connect-btn"
            >
              {gdriveLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Cloud className="w-4 h-4 mr-2" />Connect &amp; First Sync
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-500 uppercase">Sheet</div>
                <div className="font-medium truncate">{gdrive.spreadsheet_name || gdrive.spreadsheet_id}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Service Account</div>
                <div className="font-mono text-xs truncate">{gdrive.service_account_email}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Last Sync</div>
                <div>
                  {gdrive.last_sync_at ? new Date(gdrive.last_sync_at).toLocaleString('en-IN') : 'Never'}
                  {gdrive.last_sync_status === 'ok' && <span className="text-emerald-600 ml-2">✓</span>}
                  {gdrive.last_sync_status === 'error' && <span className="text-rose-600 ml-2">✗ {gdrive.last_sync_error}</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase">Auto-Sync</div>
                <button
                  onClick={toggleAutoSync}
                  className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${gdrive.auto_sync ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                  data-testid="gdrive-autosync-toggle"
                >
                  {gdrive.auto_sync ? 'ON — click to disable' : 'OFF — click to enable'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {gdrive.spreadsheet_url && (
                <a href={gdrive.spreadsheet_url} target="_blank" rel="noreferrer" data-testid="gdrive-open-sheet">
                  <Button type="button" variant="outline" size="sm"><ExternalLink className="w-4 h-4 mr-2" />Open Sheet</Button>
                </a>
              )}
              <Button type="button" variant="outline" size="sm" onClick={syncGdriveNow} disabled={gdriveLoading} data-testid="gdrive-sync-btn">
                {gdriveLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync Now
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={disconnectGdrive} disabled={gdriveLoading} className="text-rose-600 hover:text-rose-700" data-testid="gdrive-disconnect-btn">
                <CloudOff className="w-4 h-4 mr-2" />Disconnect
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save Settings
        </Button>
      </div>
    </div>
  );
}
