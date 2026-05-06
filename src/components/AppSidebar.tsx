import * as React from 'react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import {
  LayoutDashboard, Building2, Users, FileText, Receipt, Wallet,
  Clock, CalendarDays, BadgeDollarSign, Landmark, BarChart3, Settings,
  ChevronLeft, ChevronRight, ChevronDown, FileStack, UserPlus, CalendarClock,
  Milestone, Target, MessagesSquare, KanbanSquare,
} from './Icons';

export type PageId =
  | 'dashboard' | 'accounts' | 'contacts' | 'contracts' | 'documents'
  | 'candidates' | 'interviewers' | 'availability'
  | 'prospects' | 'prospect-interactions' | 'prospect-pipeline'
  | 'timesheets' | 'leave'
  | 'invoices' | 'expenses' | 'milestones' | 'dividends' | 'bank-reconciliation'
  | 'payment-details' | 'jd-skills' | 'jd-platforms'
  | 'reports' | 'settings';

const standaloneTop = [
  { title: 'Dashboard', id: 'dashboard' as PageId, icon: LayoutDashboard },
];

const groups = [
  {
    label: 'Data Management',
    items: [
      { title: 'Accounts', id: 'accounts' as PageId, icon: Building2 },
      { title: 'Contacts', id: 'contacts' as PageId, icon: Users },
      { title: 'Contracts', id: 'contracts' as PageId, icon: FileText },
      { title: 'Documents', id: 'documents' as PageId, icon: FileStack },
    ],
  },
  {
    label: 'Onboarding',
    items: [
      { title: 'Candidates', id: 'candidates' as PageId, icon: UserPlus },
      { title: 'Interviewers', id: 'interviewers' as PageId, icon: Users },
      { title: 'Availability', id: 'availability' as PageId, icon: CalendarClock },
    ],
  },
  {
    label: 'Prospecting',
    items: [
      { title: 'Prospects', id: 'prospects' as PageId, icon: Target },
      // Pipeline and Interactions are background features, not shown in Code App
      // { title: 'Interactions', id: 'prospect-interactions' as PageId, icon: MessagesSquare },
      // { title: 'Pipeline', id: 'prospect-pipeline' as PageId, icon: KanbanSquare },
    ],
  },
  {
    label: 'Time Management',
    items: [
      { title: 'Timesheets', id: 'timesheets' as PageId, icon: Clock },
      { title: 'Leave', id: 'leave' as PageId, icon: CalendarDays },
    ],
  },
  {
    label: 'Finance Management',
    items: [
      { title: 'Invoices', id: 'invoices' as PageId, icon: Receipt },
      { title: 'Expenses', id: 'expenses' as PageId, icon: Wallet },
      { title: 'Milestones', id: 'milestones' as PageId, icon: Milestone },
      { title: 'Dividends', id: 'dividends' as PageId, icon: BadgeDollarSign },
      { title: 'Bank Recon', id: 'bank-reconciliation' as PageId, icon: Landmark },
    ],
  },
  {
    label: 'Metadata',
    items: [
      { title: 'Payment Details', id: 'payment-details' as PageId, icon: Landmark },
      { title: 'JD Skills', id: 'jd-skills' as PageId, icon: FileText },
      { title: 'JD Platforms', id: 'jd-platforms' as PageId, icon: FileText },
    ],
  },
];

const standaloneBottom = [
  { title: 'Reports', id: 'reports' as PageId, icon: BarChart3 },
  { title: 'Settings', id: 'settings' as PageId, icon: Settings },
];

interface NavItemProps {
  item: { title: string; id: PageId; icon: React.FC<{ className?: string }> };
  collapsed: boolean;
  isActive: boolean;
  onClick: () => void;
}

function NavItem({ item, collapsed, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn('csp-nav-item', isActive && 'csp-nav-item-active')}
    >
      <item.icon className="csp-nav-icon" />
      {!collapsed && <span className="csp-nav-label">{item.title}</span>}
    </button>
  );
}

interface AppSidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

export function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Data Management': true,
    'Onboarding': true,
    'Prospecting': true,
    'Time Management': true,
    'Finance Management': true,
    'Metadata': true,
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className={cn('csp-sidebar', collapsed && 'csp-sidebar-collapsed')}>
      {/* Logo */}
      <div className="csp-sidebar-logo">
        <div className="csp-logo-icon">CSP</div>
        {!collapsed && <span className="csp-logo-text">CSP CRM</span>}
      </div>

      {/* Nav */}
      <nav className="csp-sidebar-nav">
        {standaloneTop.map(item => (
          <NavItem key={item.id} item={item} collapsed={collapsed} isActive={currentPage === item.id} onClick={() => onNavigate(item.id)} />
        ))}

        {groups.map(group => (
          <div key={group.label} className="csp-nav-group">
            {!collapsed && (
              <button className="csp-nav-group-label" onClick={() => toggleGroup(group.label)}>
                {group.label}
                <ChevronDown className={cn('csp-nav-group-chevron', !openGroups[group.label] && 'csp-rotated-neg90')} />
              </button>
            )}
            {(collapsed || openGroups[group.label]) && group.items.map(item => (
              <NavItem key={item.id} item={item} collapsed={collapsed} isActive={currentPage === item.id} onClick={() => onNavigate(item.id)} />
            ))}
          </div>
        ))}

        {!collapsed && <div className="csp-nav-group-label csp-nav-group-label-static">System</div>}
        {standaloneBottom.map(item => (
          <NavItem key={item.id} item={item} collapsed={collapsed} isActive={currentPage === item.id} onClick={() => onNavigate(item.id)} />
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="csp-sidebar-footer">
        <button className="csp-sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight className="csp-nav-icon" /> : <ChevronLeft className="csp-nav-icon" />}
        </button>
      </div>
    </aside>
  );
}
