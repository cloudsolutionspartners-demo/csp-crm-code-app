import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Dialog } from './Layout';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((o: ConfirmOptions = {}) => {
    setOpts(o);
    return new Promise<boolean>(resolve => {
      setResolver(() => resolve);
    });
  }, []);

  const handle = (value: boolean) => {
    resolver?.(value);
    setResolver(null);
    setOpts(null);
  };

  const destructive = opts?.destructive !== false;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onClose={() => handle(false)} title={opts?.title || 'Are you sure?'} maxWidth="28rem">
        <p style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))', marginBottom: '1.5rem' }}>
          {opts?.description || 'Are you sure you want to delete this record? This action cannot be undone.'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button className="csp-btn csp-btn-outline" onClick={() => handle(false)}>
            {opts?.cancelLabel || 'No'}
          </button>
          <button
            className={destructive ? 'csp-btn csp-btn-destructive' : 'csp-btn csp-btn-primary'}
            onClick={() => handle(true)}
          >
            {opts?.confirmLabel || 'Yes'}
          </button>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
