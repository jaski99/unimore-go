import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'UnimoreGo · Il tempo giusto per partire',
  description: 'Pianifica il tragitto verso la tua sede UNIMORE tra treno regionale, piedi e bici.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
