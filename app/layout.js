import { Poppins } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata = {
  title: 'Plenlife | Panel de Marketing',
  description: 'Panel de métricas de Meta Ads, Google Ads y Shopify para Plenlife.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${poppins.variable} font-body bg-paper text-ink antialiased`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
