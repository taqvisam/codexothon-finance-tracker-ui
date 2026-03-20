import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import { AppShell } from "../layouts/AppShell";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { SettingsPage } from "../features/auth/SettingsPage";
import { DashboardPage } from "../features/reports/DashboardPage";
import { TransactionsPage } from "../features/transactions/TransactionsPage";
import { BudgetsPage } from "../features/budgets/BudgetsPage";
import { GoalsPage } from "../features/goals/GoalsPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { RecurringPage } from "../features/recurring/RecurringPage";
import { AccountsPage } from "../features/accounts/AccountsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/register", element: <SignupPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
      { path: "/reset-password", element: <ResetPasswordPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/",
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "transactions", element: <TransactionsPage /> },
              { path: "budgets", element: <BudgetsPage /> },
              { path: "goals", element: <GoalsPage /> },
              { path: "reports", element: <ReportsPage /> },
              { path: "recurring", element: <RecurringPage /> },
              { path: "accounts", element: <AccountsPage /> },
              { path: "settings", element: <SettingsPage /> }
            ]
          }
        ]
      }
    ]
  }
]);
