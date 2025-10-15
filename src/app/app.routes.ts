import { Routes } from '@angular/router';
import { AuthGuard } from './core';
import { NoAuthGuard } from './core';

export const routes: Routes = [
 // ========================================
  // RUTA POR DEFECTO
  // ========================================
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },

  // ========================================
  // RUTAS PÚBLICAS (con NoAuthGuard)
  // Solo accesibles si NO está logueado
  // ========================================
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login/login.page').then(m => m.LoginPage),
    canActivate: [NoAuthGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/pages/register/register.page').then(m => m.RegisterPage),
    canActivate: [NoAuthGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
    canActivate: [NoAuthGuard]
  },

  // ========================================
  // RUTAS PRIVADAS (con AuthGuard)
  // Solo accesibles si está logueado
  // ========================================
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard.page').then(m => m.DashboardPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'transactions',
    loadComponent: () => import('./features/transactions/pages/transactions/transactions.page').then(m => m.TransactionsPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'add-transaction',
    loadComponent: () => import('./features/transactions/pages/add-transaction/add-transaction.page').then(m => m.AddTransactionPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'transaction-detail/:id',
    loadComponent: () => import('./features/transactions/pages/transaction-detail/transaction-detail.page').then(m => m.TransactionDetailPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'budgets',
    loadComponent: () => import('./features/budgets/pages/budgets/budgets.page').then(m => m.BudgetsPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'add-budget',
    loadComponent: () => import('./features/budgets/pages/add-budget/add-budget.page').then(m => m.AddBudgetPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/pages/reports/reports.page').then(m => m.ReportsPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./features/auth/pages/profile/profile.page').then(m => m.ProfilePage),
    canActivate: [AuthGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/auth/pages/settings/settings.page').then(m => m.SettingsPage),
    canActivate: [AuthGuard]
  },

  // ========================================
  // RUTA DE VERIFICACIÓN DE EMAIL
  // ========================================
  {
    path: 'verify-email',
    loadComponent: () => import('./features/auth/pages/verify-email/verify-email.page').then(m => m.VerifyEmailPage),
    canActivate: [AuthGuard]
  },

  // ========================================
  // PÁGINA TEMPORAL (tu home actual)
  // Puedes eliminarla después
  // ========================================
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },

  // ========================================
  // 404 - PÁGINA NO ENCONTRADA
  // ========================================
  {
    path: '**',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/pages/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard.page').then( m => m.DashboardPage)
  },
  {
    path: 'add-transaction',
    loadComponent: () => import('./features/transactions/pages/add-transaction/add-transaction.page').then( m => m.AddTransactionPage)
  },
  {
    path: 'transactions',
    loadComponent: () => import('./features/transactions/pages/transactions/transactions.page').then( m => m.TransactionsPage)
  }
];