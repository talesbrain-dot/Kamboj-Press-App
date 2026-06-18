import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Printer, Loader2 } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function Login() {
  const { login } = useAuth();
  const { app_name, logo_base64 } = useBranding();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      toast({ title: 'Login failed', description: err?.response?.data?.detail || 'Invalid credentials', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          {logo_base64 ? (
            <img src={logo_base64} alt="logo" className="w-14 h-14 rounded-lg object-contain bg-white border border-slate-200 mb-3" />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-orange-500 flex items-center justify-center text-white mb-3">
              <Printer className="w-7 h-7" />
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-center">{app_name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sign in to manage your orders</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="u">Username</Label>
            <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p">Password</Label>
            <Input id="p" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sign In
          </Button>
        </form>
      </Card>
    </div>
  );
}
