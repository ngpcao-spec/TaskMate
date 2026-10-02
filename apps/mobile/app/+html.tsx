import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/** Gabarit HTML racine (web) : métadonnées PWA, installation iOS/Android, couleur de thème. */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
        <title>TaskMate</title>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#1E88F5" />
        <meta name="description" content="Việc nhà của gia đình — TaskMate" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="TaskMate" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: focusCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/** Focus clavier visible (W2) — l'anneau ne s'affiche qu'à la navigation au clavier. */
const focusCss = `
:focus-visible { outline: 3px solid #1E88F5 !important; outline-offset: 2px; border-radius: 8px; }
body { background-color: #F5F9FF; overscroll-behavior-y: none; }
`;
