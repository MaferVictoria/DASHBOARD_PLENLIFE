import { Poppins } from 'next/font/google';
import './globals.css';

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
        {children}
      </body>
    </html>
  );
}
