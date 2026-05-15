import * as React from 'react';
import { useState } from 'react';
import { ToastProvider, AppLayout } from './components/Layout';
import { ConfirmProvider } from './components/ConfirmDialog';
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
import PaymentDetailsPage from './pages/PaymentDetailsPage';
import JDSkillsPage from './pages/JDSkillsPage';
import JDPlatformsPage from './pages/JDPlatformsPage';
import ProspectsPage from './pages/ProspectsPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
// Pipeline and Interactions are background features, not shown in Code App
// import ProspectPipelinePage from './pages/ProspectPipelinePage';
// import ProspectInteractionsPage from './pages/ProspectInteractionsPage';

const pageComponents: Partial<Record<PageId, React.FC>> = {
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
  'payment-details': PaymentDetailsPage,
  'jd-skills': JDSkillsPage,
  'jd-platforms': JDPlatformsPage,
  prospects: ProspectsPage,
  opportunities: OpportunitiesPage,
  // Pipeline and Interactions are background features, not shown in Code App
  // 'prospect-interactions': ProspectInteractionsPage,
  // 'prospect-pipeline': ProspectPipelinePage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const PageComponent = pageComponents[currentPage] || DashboardPage;

  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppLayout sidebar={<AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />}>
          <PageComponent />
        </AppLayout>
      </ConfirmProvider>
    </ToastProvider>
  );
}
