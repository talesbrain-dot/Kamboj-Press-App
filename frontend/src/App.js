import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandingProvider } from './context/BrandingContext';
import { Toaster } from './components/ui/toaster';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import OrderDetail from './pages/OrderDetail';
import Invoice from './pages/Invoice';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Reminders from './pages/Reminders';
import EditOrder from './pages/EditOrder';
import StatusQueue from './pages/StatusQueue';

function Protected({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <BrandingProvider>
        <AuthProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders/new" element={<NewOrder />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/orders/:id/edit" element={<Protected adminOnly><EditOrder /></Protected>} />
              <Route path="/orders/:id/invoice" element={<Invoice />} />
              <Route path="/customers" element={<Protected adminOnly><Customers /></Protected>} />
              <Route path="/customers/:id" element={<Protected adminOnly><CustomerDetail /></Protected>} />
              <Route path="/reminders" element={<Protected adminOnly><Reminders /></Protected>} />
              <Route path="/queue" element={<StatusQueue />} />
              <Route path="/queue/:status" element={<StatusQueue />} />
              <Route path="/users" element={<Protected adminOnly><Users /></Protected>} />
              <Route path="/settings" element={<Protected adminOnly><Settings /></Protected>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
        </AuthProvider>
      </BrandingProvider>
    </ThemeProvider>
  );
}

export default App;
