import { ReactNode, createContext, useContext, useState } from 'react';
import { AppSidebar } from '@/components/AppSidebar';

const HeaderActionsContext = createContext<{
  actions: ReactNode | null;
  setActions: (actions: ReactNode | null) => void;
}>({ actions: null, setActions: () => {} });

export function useHeaderActions() {
  return useContext(HeaderActionsContext);
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [actions, setActions] = useState<ReactNode | null>(null);

  return (
    <HeaderActionsContext.Provider value={{ actions, setActions }}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-14 items-center border-b bg-card px-6">
            {actions}
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </HeaderActionsContext.Provider>
  );
}
