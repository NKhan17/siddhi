import { QueryClient } from '@tanstack/react-query';

// One cache for the lifetime of the authenticated app. Keeping route data warm
// prevents sidebar switches from flashing a page-wide loading state.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: { retry: 0 },
  },
});
