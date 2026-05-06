import * as React from 'react';
import { useState, createContext, useContext, useCallback, useEffect } from 'react';
import { cn } from '../lib/utils';
import { CheckSquare, Power, PowerOff, Trash2, Download, Loader2 } from './Icons';

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
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  entityLabel?: string;
  showActivate?: boolean;
  showDeactivate?: boolean;
  showDelete?: boolean;
  showDownload?: boolean;
  extraActions?: React.ReactNode;
}

export function SelectionActionBar({
  count, onClearSelection, onActivate, onDeactivate, onDelete, onDownload,
  entityLabel = 'records',
  showActivate = true, showDeactivate = true, showDelete = true, showDownload = true,
  extraActions,
}: SelectionActionBarProps) {
  const { toast } = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (count === 0) return null;

  const runAction = async (name: string, callback?: () => void | Promise<void>, fallbackToast?: string) => {
    if (loadingAction) return; // prevent double-click / concurrent actions
    setLoadingAction(name);
    try {
      if (callback) {
        await callback();
      } else if (fallbackToast) {
        toast.success(fallbackToast);
        onClearSelection();
      }
    } finally {
      // Keep spinner visible briefly so user sees feedback
      setTimeout(() => setLoadingAction(null), 400);
    }
  };

  const isLoading = !!loadingAction;

  return (
    <div className="csp-selection-bar">
      <span className="csp-selection-count">
        <CheckSquare className="csp-icon-inline" />{count} selected
      </span>
      {showActivate && (
        <button
          className="csp-btn csp-btn-outline csp-btn-sm csp-btn-activate"
          disabled={isLoading}
          onClick={() => runAction('activate', onActivate, `${count} ${entityLabel} activated`)}
        >
          {loadingAction === 'activate'
            ? <Loader2 className="csp-icon-inline csp-animate-spin" />
            : <Power className="csp-icon-inline" />}
          {loadingAction === 'activate' ? 'Activating...' : 'Activate'}
        </button>
      )}
      {showDeactivate && (
        <button
          className="csp-btn csp-btn-outline csp-btn-sm csp-btn-deactivate"
          disabled={isLoading}
          onClick={() => runAction('deactivate', onDeactivate, `${count} ${entityLabel} deactivated`)}
        >
          {loadingAction === 'deactivate'
            ? <Loader2 className="csp-icon-inline csp-animate-spin" />
            : <PowerOff className="csp-icon-inline" />}
          {loadingAction === 'deactivate' ? 'Deactivating...' : 'Deactivate'}
        </button>
      )}
      {showDelete && (
        <button
          className="csp-btn csp-btn-destructive csp-btn-sm"
          disabled={isLoading}
          onClick={() => runAction('delete', onDelete, `${count} ${entityLabel} deleted`)}
        >
          {loadingAction === 'delete'
            ? <Loader2 className="csp-icon-inline csp-animate-spin" />
            : <Trash2 className="csp-icon-inline" />}
          {loadingAction === 'delete' ? 'Deleting...' : 'Delete'}
        </button>
      )}
      {showDownload && (
        <button
          className="csp-btn csp-btn-outline csp-btn-sm"
          disabled={isLoading}
          onClick={() => runAction('download', onDownload, `Downloading ${count} ${entityLabel}`)}
        >
          {loadingAction === 'download'
            ? <Loader2 className="csp-icon-inline csp-animate-spin" />
            : <Download className="csp-icon-inline" />}
          {loadingAction === 'download' ? 'Exporting...' : 'Download'}
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
  onActivate?: () => void;
  onDeactivate?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
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
  const effectiveWidth = width || '560px';
  return (
    <div className="csp-sheet-overlay">
      <div
        className="csp-sheet"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 'auto',
          width: effectiveWidth,
          maxWidth: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          backgroundColor: 'hsl(var(--background))',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            right: 16,
            top: 16,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            color: 'hsl(var(--muted-foreground))',
            lineHeight: 1,
            padding: 4,
            borderRadius: 4,
            zIndex: 10,
          }}
        >{'×'}</button>
        {title && (
          <div className="csp-sheet-header" style={{ flexShrink: 0 }}>
            <div className="csp-sheet-title">{title}</div>
          </div>
        )}
        <div className="csp-sheet-body" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
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
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="csp-dialog-overlay">
      <div
        className="csp-dialog"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {title && (
          <div className="csp-dialog-header">
            <h2 className="csp-dialog-title">{title}</h2>
            <button className="csp-dialog-close" onClick={onClose} aria-label="Close">&times;</button>
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
    <div
      className="csp-toggle-group"
      style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 0 }}
    >
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
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: active ? 'hsl(var(--muted))' : 'transparent',
        color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        padding: '4px 10px',
        borderRadius: 6,
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
      }}
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
