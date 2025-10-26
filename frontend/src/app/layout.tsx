'use client';

import { Inter, JetBrains_Mono, Crimson_Text } from 'next/font/google';
import { useState } from 'react';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap'
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap'
});

const crimsonText = Crimson_Text({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-crimson-text',
  display: 'swap'
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Academic Notebook Cloud Platform</title>
        <meta name="description" content="Cloud-based academic notebook platform with real-time collaboration, active backups, and AI-powered search" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1e40af" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${crimsonText.variable} font-sans antialiased`}>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
          {children}
        </div>
        
        {/* Simple toast container */}
        <div id="toast-container" className="fixed top-4 right-4 z-50"></div>
      </body>
    </html>
  );
}