import * as React from 'react';
import { useState } from 'react';
import { ToastProvider, AppLayout } from './components/Layout';
import { AppSidebar, PageId } from './components/AppSidebar';
import DashboardPage from './pages/DashboardPage';
import AccountsPage from './pages/AccountsPage';
import ContactsPage from './pages/ContactsPage';
import ContractsPage from './pages/ContractsPage';
import InvoicesPage from './pages/InvoicesPage';
import ExpensesPage from './pages/ExpensesPage';
import TimesheetsPage from './pages/TimesheetsPage';
import LeavePage from './pages/LeavePage';
import DividendsPage from './pages/DividendsPage';
import BankReconciliationPage from './pages/BankReconciliationPage';
import MilestonesPage from './pages/MilestonesPage';
import DocumentsPage from './pages/DocumentsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import CandidatesPage from './pages/CandidatesPage';
import InterviewersPage from './pages/InterviewersPage';
import AvailabilityPage from './pages/AvailabilityPage';

const pageComponents: Record<PageId, React.FC> = {
  dashboard: DashboardPage,
  accounts: AccountsPage,
  contacts: ContactsPage,
  contracts: ContractsPage,
  invoices: InvoicesPage,
  expenses: ExpensesPage,
  timesheets: TimesheetsPage,
  leave: LeavePage,
  dividends: DividendsPage,
  'bank-reconciliation': BankReconciliationPage,
  milestones: MilestonesPage,
  documents: DocumentsPage,
  reports: ReportsPage,
  settings: SettingsPage,
  candidates: CandidatesPage,
  interviewers: InterviewersPage,
  availability: AvailabilityPage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const PageComponent = pageComponents[currentPage] || DashboardPage;

  return (
    <ToastProvider>
      <AppLayout sidebar={<AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />}>
        <PageComponent />
      </AppLayout>
    </ToastProvider>
  );
}
