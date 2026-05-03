// src/lib/queryClient.ts
// Shared TanStack Query client. Wrap App in <QueryClientProvider client={queryClient}>.
//
// Defaults are tuned for a mobile app on flaky networks:
//  - staleTime 30s: avoid hammering Supabase on every screen focus
//  - retry once: don't get stuck retrying failed requests forever
//  - refetchOnWindowFocus: true → app foreground triggers a refresh
//
// Usage in screens:
//   const { data, isLoading } = useQuery({
//     queryKey: ['tasks', orgId],
//     queryFn: () => supabase.from('tasks').select('*').eq('org_id', orgId),
//   });

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
