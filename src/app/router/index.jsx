// src/app/router/index.jsx
// React Router configuration dengan role-based access

import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

// Layouts
import AppLayout from '../../layouts/AppLayout'
import AuthLayout from '../../layouts/AuthLayout'
import AdminLayout from '../../layouts/AdminLayout'

// Auth pages
import LoginPage from '../../features/auth/LoginPage'
import RegisterPage from '../../features/auth/RegisterPage'
import ResetPasswordPage from '../../features/auth/ResetPasswordPage'

// Member pages
import MemberDashboard from '../../features/members/MemberDashboard'
import ProfilePage from '../../features/members/ProfilePage'
import AccountApplicationPage from '../../features/accounts/AccountApplicationPage'
import AccountDetailPage from '../../features/accounts/AccountDetailPage'
import BoxActivationPage from '../../features/savings/BoxActivationPage'
import DepositPage from '../../features/transactions/DepositPage'
import WithdrawalPage from '../../features/transactions/WithdrawalPage'
import TransactionHistoryPage from '../../features/transactions/TransactionHistoryPage'
import SavingsGoalsPage from '../../features/savings/SavingsGoalsPage'
import ReportsPage from '../../features/reports/ReportsPage'
import PhysicalBalancePage from '../../features/savings/PhysicalBalancePage'
import NotificationsPage from '../../features/members/NotificationsPage'

// NFC pages
import NFCScanPage from '../../features/nfc/NFCScanPage'
import NFCVerifyPage from '../../features/nfc/NFCVerifyPage'

// Admin pages
import AdminDashboard from '../../features/admin/AdminDashboard'
import AdminMembersPage from '../../features/admin/AdminMembersPage'
import AdminAccountsPage from '../../features/admin/AdminAccountsPage'
import AdminBoxesPage from '../../features/admin/AdminBoxesPage'
import AdminNFCPage from '../../features/admin/AdminNFCPage'
import AdminTransactionsPage from '../../features/admin/AdminTransactionsPage'
import AdminAuditPage from '../../features/audit/AdminAuditPage'

// 3D Office page (always visible at root)
import VirtualOfficePage from '../../features/members/VirtualOfficePage'

// NFC token landing page
import NFCTokenPage from '../../features/nfc/NFCTokenPage'

// Protected route wrapper
function ProtectedRoute({ requiredRole }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (requiredRole === 'ADMIN' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  if (requiredRole === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

const router = createBrowserRouter([
  // NFC Token Landing — akses publik, redirect ke scan
  {
    path: '/nfc/:token',
    element: <NFCTokenPage />,
  },

  // Auth routes
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },

  // 3D Virtual Office + Member Portal (root)
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <VirtualOfficePage /> },
    ],
  },

  // Member routes (requires login)
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <MemberDashboard /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/accounts/apply', element: <AccountApplicationPage /> },
          { path: '/accounts/:id', element: <AccountDetailPage /> },
          { path: '/box/activate', element: <BoxActivationPage /> },
          { path: '/deposit', element: <DepositPage /> },
          { path: '/withdrawal', element: <WithdrawalPage /> },
          { path: '/transactions', element: <TransactionHistoryPage /> },
          { path: '/goals', element: <SavingsGoalsPage /> },
          { path: '/reports', element: <ReportsPage /> },
          { path: '/physical-balance', element: <PhysicalBalancePage /> },
          { path: '/nfc/scan', element: <NFCScanPage /> },
          { path: '/nfc/verify', element: <NFCVerifyPage /> },
        ],
      },
    ],
  },

  // Admin routes (requires admin role)
  {
    element: <ProtectedRoute requiredRole="ADMIN" />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin', element: <AdminDashboard /> },
          { path: '/admin/members', element: <AdminMembersPage /> },
          { path: '/admin/accounts', element: <AdminAccountsPage /> },
          { path: '/admin/boxes', element: <AdminBoxesPage /> },
          { path: '/admin/nfc', element: <AdminNFCPage /> },
          { path: '/admin/transactions', element: <AdminTransactionsPage /> },
          { path: '/admin/audit', element: <AdminAuditPage /> },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}

