import React, { useEffect, useState } from 'react';
import api, { formatDate } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Plus, Trash2, UserCog } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff');

  const load = async () => { const r = await api.get('/users'); setUsers(r.data); };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !username.trim() || !password) { toast({ title: 'Fill all fields', variant: 'destructive' }); return; }
    try {
      await api.post('/users', { name: name.trim(), username: username.trim(), password, role });
      toast({ title: 'User created' });
      setOpen(false); setName(''); setUsername(''); setPassword(''); setRole('staff');
      load();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || '', variant: 'destructive' });
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast({ title: 'Deleted' });
      load();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e?.response?.data?.detail || e?.message || 'Network error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-slate-500">Admins and staff</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4 mr-2" />Add</Button>
      </div>
      <Card>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><UserCog className="w-5 h-5 text-slate-500" /></div>
                <div>
                  <div className="font-medium">{u.name} {u.id === user.id && <span className="text-xs text-slate-500">(you)</span>}</div>
                  <div className="text-xs text-slate-500">@{u.username} • {formatDate(u.created_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className={u.role === 'admin' ? 'bg-orange-500 hover:bg-orange-500' : ''}>{u.role}</Badge>
                {u.id !== user.id && (
                  <Button variant="ghost" size="icon" onClick={() => remove(u.id)}><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} className="bg-orange-500 hover:bg-orange-600 text-white">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
