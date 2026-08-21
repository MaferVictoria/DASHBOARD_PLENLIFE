'use client';

import { createContext, useContext, useState } from 'react';
import { defaultRange } from '@/lib/dateRanges';

const DateRangeContext = createContext(null);

// Lives in app/layout.js, which does NOT unmount on client-side navigation
// between pages (only `children` swaps) — so the selected date range now
// survives switching tabs instead of resetting to the default every time.
export function DateRangeProvider({ children }) {
  const [range, setRange] = useState(defaultRange());
  return <DateRangeContext.Provider value={{ range, setRange }}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error('useDateRange must be used inside <DateRangeProvider>');
  return ctx;
}
