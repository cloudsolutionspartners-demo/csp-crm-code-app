import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import {
  LayoutDashboard, Building2, Users, FileText, Receipt, Wallet,
  Clock, CalendarDays, BadgeDollarSign, Landmark, BarChart3, Settings,
  ChevronLeft, ChevronRight, FileStack, ChevronDown, UserPlus, CalendarClock,
  Milestone, CreditCard, Wrench, Monitor, Target, MessagesSquare, KanbanSquare, Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const standaloneTop = [
  { title: 'Corporate Actions', url: '/', icon: KanbanSquare },
];

const groups = [
  {
    label: 'Data Management',
    items: [
      { title: 'Accounts', url: '/accounts', icon: Building2 },
      { title: 'Contacts', url: '/contacts', icon: Users },
      { title: 'Contracts', url: '/contracts', icon: FileText },
      { title: 'Documents', url: '/documents', icon: FileStack },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { title: 'Candidates', url: '/onboarding/candidates', icon: UserPlus },
      { title: 'Interviewers', url: '/onboarding/interviewers', icon: Users },
      { title: 'Availability', url: '/onboarding/availability', icon: CalendarClock },
    ],
  },
  {
    label: 'Prospecting',
    items: [
      { title: 'Prospects', url: '/prospecting/prospects', icon: Target },
      { title: 'Opportunities', url: '/prospecting/opportunities', icon: Briefcase },
    ],
  },
  {
    label: 'Time Management',
    items: [
      { title: 'Timesheets', url: '/timesheets', icon: Clock },
      { title: 'Leave', url: '/leave', icon: CalendarDays },
    ],
  },
  {
    label: 'Finance Management',
    items: [
      { title: 'Invoices', url: '/invoices', icon: Receipt },
      { title: 'Expenses', url: '/expenses', icon: Wallet },
      { title: 'Milestones', url: '/milestones', icon: Milestone },
      { title: 'Dividends', url: '/dividends', icon: BadgeDollarSign },
      { title: 'Bank Recon', url: '/bank-reconciliation', icon: Landmark },
    ],
  },
  {
    label: 'Metadata',
    items: [
      { title: 'Payment Details', url: '/metadata/payment-details', icon: CreditCard },
      { title: 'JD Skills', url: '/metadata/skills', icon: Wrench },
      { title: 'JD Platforms', url: '/metadata/platforms', icon: Monitor },
    ],
  },
];

const reportsItems = [
  { title: 'Billing & Profit', url: '/reports', icon: BarChart3 },
];

const standaloneBottom = [
  { title: 'Settings', url: '/settings', icon: Settings },
];

function NavItem({ item, collapsed, isActive }: { item: typeof standaloneTop[0]; collapsed: boolean; isActive: boolean }) {
  return (
    <NavLink
      to={item.url}
      className={cn(
        'flex items-center gap-3 mx-2 px-3 py-2 rounded-md text-sm transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        isActive && 'bg-sidebar-accent text-sidebar-primary font-medium'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.title}</span>}
    </NavLink>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isActive = (url: string) =>
    url === '/' ? location.pathname === '/' : location.pathname.startsWith(url);

  return (
    <aside
      className={cn(
        'flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
          CSP
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold truncate text-sidebar-primary-foreground">CSP CRM</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {/* Dashboard */}
        {standaloneTop.map((item) => (
          <NavItem key={item.url} item={item} collapsed={collapsed} isActive={isActive(item.url)} />
        ))}

        {/* Groups */}
        {groups.map((group) => {
          const groupHasActive = group.items.some((i) => isActive(i.url));
          return (
            <Collapsible key={group.label} defaultOpen={groupHasActive || true}>
              {!collapsed && (
                <CollapsibleTrigger className="flex w-full items-center justify-between px-5 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground/80 transition-colors">
                  {group.label}
                  <ChevronDown className="h-3 w-3 transition-transform duration-200 [&[data-state=open]]:rotate-0 [[data-state=closed]_&]:rotate-0" />
                </CollapsibleTrigger>
              )}
              <CollapsibleContent>
                {group.items.map((item) => (
                  <NavItem key={item.url} item={item} collapsed={collapsed} isActive={isActive(item.url)} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        {/* Reports section */}
        {!collapsed && (
          <div className="px-5 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Reports
          </div>
        )}
        {reportsItems.map((item) => (
          <NavItem key={item.url} item={item} collapsed={collapsed} isActive={isActive(item.url)} />
        ))}

        {/* Bottom standalone */}
        {!collapsed && (
          <div className="px-5 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            System
          </div>
        )}
        {standaloneBottom.map((item) => (
          <NavItem key={item.url} item={item} collapsed={collapsed} isActive={isActive(item.url)} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full h-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
