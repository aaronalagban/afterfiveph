import { Analytics } from "@vercel/analytics/react";
import './globals.css'; 
import type { Metadata, Viewport } from 'next';

// 1. Viewport settings (separate from metadata in Next.js 14+)
export const viewport: Viewport = {
  themeColor: '#000000', // Set this to your brand's primary color
  width: 'device-width',
  initialScale: 1,
};

// 2. Comprehensive Metadata
export const metadata: Metadata = {
  title: {
    default: 'AfterFivePH | Manila Nightlife Directory',
    template: '%s | AfterFivePH'
  },
  description: 'The definitive directory for Manila nightlife. Discover the best bars, clubs, speakeasies, and events in Makati, BGC, and across the metro. Find your vibe after five.',
  keywords: [
    'Manila Nightlife', 'Manila Bar Directory', 'BGC Clubs', 'Makati Bars', 
    'Quezon City Nightlife', 'Speakeasies Manila', 'Philippines Nightlife Guide', 
    'Best Bars in Manila', 'AfterFivePH', 'Manila Events'
  ],
  authors: [{ name: 'AfterFivePH' }],
  creator: 'AfterFivePH',
  publisher: 'AfterFivePH',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Social & Icons
  icons: {
    icon: [
      { url: '/logo-1.png' },
      { url: '/logo-1.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo-1.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/logo-1.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_PH',
    title: 'AfterFivePH | Manila Nightlife Directory',
    description: 'Explore Manila’s premier bars and clubs. Your curated guide to the city’s nightlife after five.',
    siteName: 'AfterFivePH',
    images: [{
      url: '/logo-1.png', // Ideally, use a 1200x630px image later for better social sharing
      width: 1200,
      height: 630,
      alt: 'AfterFivePH - Manila Nightlife Guide',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AfterFivePH | Manila Nightlife Directory',
    description: 'The best bars and clubs in Manila, all in one place.',
    images: ['/logo-1.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 3. JSON-LD Structured Data (The "Secret Sauce" for SEO)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Guide",
    "name": "AfterFivePH Manila Nightlife Directory",
    "description": "A comprehensive directory and guide to the best nightlife spots in Manila, Philippines.",
    "publisher": {
      "@type": "Organization",
      "name": "AfterFivePH",
      "logo": {
        "@type": "ImageObject",
        "url": "https://afterfive.ph/logo-1.png" // Update this later
      }
    },
    "about": {
      "@type": "Place",
      "name": "Manila",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Manila",
        "addressCountry": "PH"
      }
    }
  };

  return (
    <html lang="en">
      <head>
        {/* Structured Data for Search Engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}