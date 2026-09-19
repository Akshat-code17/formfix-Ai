import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { FormFixApiError } from './lib/api';
import { startDemoBackend } from './mocks/start';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        error instanceof FormFixApiError && error.retryable && failureCount < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

async function bootstrap() {
  // In live mode this resolves immediately without importing any fixture.
  await startDemoBackend();

  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root');

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
