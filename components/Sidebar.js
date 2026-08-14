'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Resumen general' },
  { href: '/meta', label: 'Meta' },
  { href: '/google', label: 'Google' },
  { href: '/shopify', label: 'Shopify' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col bg-sidebar px-4 py-8">
      <div className="mb-10 flex justify-center">
        <Image
          src="/plenlife-logo-white.png"
          alt="Plenlife"
          width={160}
          height={43}
          priority
        />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-lg px-4 py-2.5 font-display text-sm font-medium transition-colors',
                active ? 'bg-white text-sidebar' : 'text-white/75 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
