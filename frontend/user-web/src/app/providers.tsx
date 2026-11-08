'use client';

/** Cấp một React Query client ổn định cho toàn bộ cây ứng dụng phía trình duyệt. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { syncRememberedSession } from "@/dung-chung/connect-api/api";
import { installHorizontalWheel } from '@/dung-chung/tien-ich/horizontalWheel';

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(installHorizontalWheel, []);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== "user_refresh_token" && event.key !== "user_access_token" && event.key !== null) return;
      if (!syncRememberedSession()) {
        void queryClient.cancelQueries(); queryClient.clear();
        window.location.replace("/login");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
