import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Force no-referrer on all admin pages so Instagram CDN images load correctly
// in ImageGridSelector and poster previews.
export const metadata: Metadata = {
  other: {
    referrer: 'no-referrer',
  },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
