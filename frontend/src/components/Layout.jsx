import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useBranding } from '../context/BrandingContext';
import { LayoutDashboard, ShoppingCart, Users, UserCog, Settings, LogOut, Moon, Sun, Menu, X, Printer, Bell, Wallet } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { app_name, logo_base64 } = useBranding();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/orders/new', label: 'New Order', icon: ShoppingCart, show: true },
    { to: '/queue/Digital%20Printing', label: 'Digital Printing', icon: Printer, show: true },
    { to: '/reminders', label: 'Reminders', icon: Bell, show: isAdmin },
    { to: '/balance', label: 'Balance', icon: Wallet, show: isAdmin },
    { to: '/customers', label: 'Customers', icon: Users, show: isAdmin },
    { to: '/users', label: 'Team', icon: UserCog, show: isAdmin },
    { to: '/settings', label: 'Settings', icon: Settings, show: isAdmin },
  ].filter((i) => i.show);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
        <div className="flex items-center justify-between h-14 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2" onClick={() => setOpen(!open)} aria-label="menu">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              {logo_base64 ? (
                <img src={logo_base64} alt="logo" className="w-8 h-8 rounded-md object-contain bg-white" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-orange-500 flex items-center justify-center text-white">
                  <Printer className="w-5 h-5" />
                </div>
              )}
              <span className="font-semibold text-lg tracking-tight truncate max-w-[180px] sm:max-w-none">{app_name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="toggle theme">
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium">{user?.name}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{user?.role}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="logout">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={cn(
          'fixed lg:sticky top-14 z-30 h-[calc(100vh-3.5rem)] w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <nav className="p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
