import { QueryClient } from '@tanstack/react-query'

// Shared by every React root of the plugin, so all of them show the same data.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The plugin pushes change events, so data is fresh until an event says otherwise.
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
})
