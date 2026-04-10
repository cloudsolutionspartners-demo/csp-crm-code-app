import * as React from 'react';
import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { cn } from '../lib/utils';
import { CheckSquare, Power, PowerOff, Trash2, Download } from './Icons';

// ===== Toast System =====
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface ToastContextValue {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue>({
  toast: { success: () => {}, error: () => {} },
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = React.useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const toast = React.useMemo(() => ({
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
  }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="csp-toast-container">
        {toasts.map(t => (
          <div key={t.id} className={cn('csp-toast', t.type === 'error' ? 'csp-toast-error' : 'csp-toast-success')}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ===== Header Actions Context =====
interface HeaderActionsContextValue {
  actions: React.ReactNode | null;
  setActions: (actions: React.ReactNode | null) => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextValue>({
  actions: null,
  setActions: () => {},
});

export function useHeaderActions() {
  return useContext(HeaderActionsContext);
}

// ===== Selection Action Bar =====
interface SelectionActionBarProps {
  count: number;
  onClearSelection: () => void;
  entityLabel?: string;
  showActivate?: boolean;
  showDeactivate?: boolean;
  showDelete?: boolean;
  showDownload?: boolean;
  extraActions?: React.ReactNode;
}

export function SelectionActionBar({
  count, onClearSelection, entityLabel = 'records',
  showActivate = true, showDeactivate = true, showDelete = true, showDownload = true,
  extraActions,
}: SelectionActionBarProps) {
  const { toast } = useToast();
  if (count === 0) return null;
  return (
    <div className="csp-selection-bar">
      <span className="csp-selection-count">
        <CheckSquare className="csp-icon-inline" />{count} selected
      </span>
      {showActivate && (
        <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { toast.success(`${count} ${entityLabel} activated`); onClearSelection(); }}>
          <Power className="csp-icon-inline" />Activate
        </button>
      )}
      {showDeactivate && (
        <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => { toast.success(`${count} ${entityLabel} deactivated`); onClearSelection(); }}>
          <PowerOff className="csp-icon-inline" />Deactivate
        </button>
      )}
      {showDelete && (
        <button className="csp-btn csp-btn-destructive csp-btn-sm" onClick={() => { toast.success(`${count} ${entityLabel} deleted`); onClearSelection(); }}>
          <Trash2 className="csp-icon-inline" />Delete
        </button>
      )}
      {showDownload && (
        <button className="csp-btn csp-btn-outline csp-btn-sm" onClick={() => toast.success(`Downloading ${count} ${entityLabel} to Excel`)}>
          <Download className="csp-icon-inline" />Download
        </button>
      )}
      {extraActions}
    </div>
  );
}

// ===== Header Selection Bar (used by pages) =====
interface HeaderSelectionBarProps {
  count: number;
  onClearSelection: () => void;
  entityLabel?: string;
  showActivate?: boolean;
  showDeactivate?: boolean;
  showDelete?: boolean;
  showDownload?: boolean;
  extraActions?: React.ReactNode;
}

export function HeaderSelectionBar(props: HeaderSelectionBarProps) {
  const { setActions } = useHeaderActions();

  useEffect(() => {
    if (props.count > 0) {
      setActions(<SelectionActionBar {...props} />);
    } else {
      setActions(null);
    }
    return () => setActions(null);
  }, [props.count, props.entityLabel]);

  return null;
}

// ===== App Layout =====
interface AppLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

export function AppLayout({ sidebar, children }: AppLayoutProps) {
  const [actions, setActions] = useState<React.ReactNode | null>(null);

  return (
    <HeaderActionsContext.Provider value={{ actions, setActions }}>
      <div className="csp-app-root">
        {sidebar}
        <div className="csp-main-wrapper">
          <header className="csp-header">
            {actions}
          </header>
          <main className="csp-main-content">
            {children}
          </main>
        </div>
      </div>
    </HeaderActionsContext.Provider>
  );
}

// ===== Sheet (Side Panel) =====
interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  width?: string;
}

export function Sheet({ open, onClose, children, title, width }: SheetProps) {
  if (!open) return null;
  return (
    <div className="csp-sheet-overlay" onClick={onClose}>
      <div
        className="csp-sheet"
        style={width ? { maxWidth: width } : undefined}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="csp-sheet-header">
            <div className="csp-sheet-title">{title}</div>
          </div>
        )}
        <div className="csp-sheet-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// ===== Dialog =====
interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
}

export function Dialog({ open, onClose, children, title, maxWidth }: DialogProps) {
  if (!open) return null;
  return (
    <div className="csp-dialog-overlay" onClick={onClose}>
      <div
        className="csp-dialog"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="csp-dialog-header">
            <h2 className="csp-dialog-title">{title}</h2>
          </div>
        )}
        <div className="csp-dialog-body">
          {children}
        </div>
      </div>
    </div>
  );
}

// ===== Tabs =====
interface TabsProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onChange: (id: string) => void;
  children: React.ReactNode;
}

export function Tabs({ tabs, activeTab, onChange, children }: TabsProps) {
  return (
    <div className="csp-tabs">
      <div className="csp-tabs-list">
        {tabs.map(t => (
          <button
            key={t.id}
            className={cn('csp-tab', activeTab === t.id && 'csp-tab-active')}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="csp-tab-content">
        {children}
      </div>
    </div>
  );
}

// ===== ToggleGroup =====
interface ToggleGroupProps {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

export function ToggleGroup({ value, onChange, children }: ToggleGroupProps) {
  return (
    <div className="csp-toggle-group">
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          const childProps = child.props as any;
          return React.cloneElement(child as React.ReactElement<any>, {
            active: childProps.value === value,
            onClick: () => onChange(childProps.value),
          });
        }
        return child;
      })}
    </div>
  );
}

interface ToggleGroupItemProps {
  value: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function ToggleGroupItem({ value, children, active, onClick }: ToggleGroupItemProps) {
  return (
    <button
      className={cn('csp-toggle-item', active && 'csp-toggle-item-active')}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ===== Checkbox =====
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({ checked, onChange, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn('csp-checkbox', checked && 'csp-checkbox-checked', className)}
      onClick={() => onChange(!checked)}
    >
      {checked && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}
