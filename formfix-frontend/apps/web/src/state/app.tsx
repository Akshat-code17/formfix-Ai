import type { AppConfig } from '@formfix/contracts';
import { useQuery } from '@tanstack/react-query';
import { createContext, use, type ReactNode } from 'react';
import { FormFixApiError, api } from '../lib/api';

type AppContextValue = {
  config: AppConfig | undefined;
  isLoading: boolean;
  error: FormFixApiError | null;
  retry: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = use(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['bootstrap'],
    queryFn: async ({ signal }) => {
      const config = await api.getConfig(signal);
      // Creates a guest session, or resumes the one the cookie still names.
      // No registration, no email, no account.
      await api.createSession();
      return config;
    },
    staleTime: Infinity,
    retry: 1,
  });

  const value: AppContextValue = {
    config: query.data,
    isLoading: query.isPending,
    error: query.error instanceof FormFixApiError ? query.error : null,
    retry: () => void query.refetch(),
  };

  return <AppContext value={value}>{children}</AppContext>;
}
