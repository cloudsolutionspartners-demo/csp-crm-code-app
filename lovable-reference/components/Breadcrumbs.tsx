import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const routeNames: Record<string, string> = {
  '/': 'Dashboard',
  '/accounts': 'Accounts',
  '/contacts': 'Contacts',
  '/contracts': 'Contracts',
  '/invoices': 'Invoices',
  '/expenses': 'Expenses',
  '/timesheets': 'Timesheets',
  '/leave': 'Leave Management',
  '/dividends': 'Dividends',
  '/bank-reconciliation': 'Bank Reconciliation',
  '/documents': 'Documents',
  '/reports': 'Reports & Analytics',
  '/settings': 'Settings',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathname = location.pathname;
  const name = routeNames[pathname] || 'Page';

  if (pathname === '/') return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <span className="hover:text-foreground cursor-pointer">Dashboard</span>
      <ChevronRight className="h-3 w-3" />
      <span className="text-foreground font-medium">{name}</span>
    </nav>
  );
}
