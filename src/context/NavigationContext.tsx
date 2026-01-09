import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type NavigationContextType = {
  confirmNavigation: (path: string) => Promise<boolean>;
  registerNavigationGuard: (guard: () => boolean) => void;
  unregisterNavigationGuard: () => void;
};

const NavigationContext = createContext<NavigationContextType | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigationGuard, setNavigationGuard] = useState<(() => boolean) | null>(null);

  const confirmNavigation = useCallback(async (path: string): Promise<boolean> => {
    if (navigationGuard && !navigationGuard()) {
      return false;
    }
    return true;
  }, [navigationGuard]);

  const registerNavigationGuard = useCallback((guard: () => boolean) => {
    setNavigationGuard(() => guard);
  }, []);

  const unregisterNavigationGuard = useCallback(() => {
    setNavigationGuard(null);
  }, []);

  return (
    <NavigationContext.Provider value={{ confirmNavigation, registerNavigationGuard, unregisterNavigationGuard }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
