import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { formatINR, formatDate } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ArrowLeft, Download, FileImage, Printer, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState(null);
  const [settings, setSettings] = useState(null);
  const [exporting, setExporting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [o, s] = await Promise.all([api.get(`/orders/${id}`), api.get('/settings')]);
        setOrder(o.data); setSettings(s.data);
      } catch { toast({ title: 'Failed to load invoice', variant: 'destructive' }); }
    })();
  }, [id]);

  const exportPDF = async () => {
    if (!ref.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(img, 'PNG', (pageW - w) / 2, 20, w, h);
      pdf.save(`${order.order_no}.pdf`);
    } catch (e) {
      toast({ title: 'PDF failed', description: String(e?.message || e), variant: 'destructive' });
    } finally { setExporting(false); }
  };

  const exportJPEG = async () => {
    if (!ref.current) return;
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const link = document.createElement('a');
      link.download = `${order.order_no}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (e) {
      toast({ title: 'JPEG failed', variant: 'destructive' });
    } finally { setExporting(false); }
  };

  const doPrint = () => window.print();

  if (!order || !settings) return <div className="p-10 text-center text-slate-500">Loading invoice...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={doPrint}><Printer className="w-4 h-4 mr-2" />Print</Button>
          <Button variant="outline" onClick={exportJPEG} disabled={exporting}><FileImage className="w-4 h-4 mr-2" />JPEG</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={exportPDF} disabled={exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} PDF
          </Button>
        </div>
      </div>

      <div ref={ref} className="bg-white text-slate-900 p-8 shadow-sm border border-slate-200 print:shadow-none print:border-0" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="flex justify-between items-start gap-4 pb-4 border-b-2 border-orange-500">
          <div className="flex items-center gap-3">
            {settings.logo_base64 ? (
              <img src={settings.logo_base64} alt="logo" className="w-16 h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 rounded-md bg-orange-500 flex items-center justify-center text-white text-2xl font-bold">{(settings.company_name || 'P')[0]}</div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{settings.company_name || 'Press Order Book'}</h1>
              {settings.company_phone && <p className="text-sm text-slate-600">{settings.company_phone}</p>}
              {settings.company_address && <p className="text-sm text-slate-600 max-w-xs">{settings.company_address}</p>}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-orange-600">INVOICE</h2>
            <p className="text-sm mt-1"><b>{order.order_no}</b></p>
            <p className="text-xs text-slate-600">{formatDate(order.created_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div>
            <p className="text-xs uppercase text-slate-500 font-medium">Bill To</p>
            <p className="font-semibold mt-1">{order.customer_name}</p>
            <p className="text-sm text-slate-600">{order.customer_phone}</p>
            {order.customer_address && <p className="text-sm text-slate-600">{order.customer_address}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-slate-500 font-medium">Status</p>
            <p className="font-semibold mt-1">{order.balance > 0 ? `Balance Due: ${formatINR(order.balance)}` : 'Fully Paid'}</p>
          </div>
        </div>

        <table className="w-full mt-6 text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">Product</th>
              <th className="p-2 text-right">Qty</th>
              <th className="p-2 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {order.products.map((p, i) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="p-2">{i + 1}</td>
                <td className="p-2">{p.name}{p.notes && <div className="text-xs text-slate-500">{p.notes}</div>}</td>
                <td className="p-2 text-right">{p.quantity}</td>
                <td className="p-2 text-right">{formatINR(p.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mt-4">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between"><span>Total</span><span className="font-medium">{formatINR(order.total)}</span></div>
            <div className="flex justify-between"><span>Paid</span><span className="font-medium">{formatINR(order.paid)}</span></div>
            <div className="flex justify-between pt-2 border-t border-slate-300 text-base">
              <span className="font-semibold">Balance</span><span className="font-bold text-orange-600">{formatINR(order.balance)}</span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="mt-6 pt-4 border-t border-slate-200">
            <p className="text-xs uppercase text-slate-500 font-medium">Notes</p>
            <p className="text-sm mt-1 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {settings?.invoice_terms && (
          <div className="mt-6 pt-4 border-t border-slate-200" data-testid="invoice-terms">
            <p className="text-xs uppercase text-slate-500 font-medium">Terms &amp; Conditions</p>
            <div className="text-xs mt-1 whitespace-pre-wrap text-slate-700 leading-relaxed">{settings.invoice_terms}</div>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 mt-8 pt-4 border-t border-slate-200">Thank you for your business!</p>
      </div>
    </div>
  );
}
