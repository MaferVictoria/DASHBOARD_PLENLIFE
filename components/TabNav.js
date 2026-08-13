'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Resumen general' },
  { href: '/meta', label: 'Meta' },
  { href: '/google', label: 'Google' },
  { href: '/shopify', label: 'Shopify' },
];

export default function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-line">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={[
              'relative px-4 py-3 font-display text-sm font-medium transition-colors',
              active ? 'text-brand' : 'text-ink/50 hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {active && <span className="absolute inset-x-3 -bottom-px h-[2px] bg-brand-bright" />}
          </Link>
        );
      })}
    </nav>
  );
}
