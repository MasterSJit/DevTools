import Providers from './providers';
import MainLayout from './layout/MainLayout';
// Fonts are bundled from npm (Fontsource) — self-hosted, no request to Google, no network needed at build time.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import '@/styles/global.css';
import { TOOLS } from '@/constants/tools';
import { SITE_URL } from '@/constants/site';

const description = `${TOOLS.length} free developer and cybersecurity tools — code formatters, JSON, JWT, hashing, encryption, certificates, DNS, WHOIS, SEO and security header checks. Everything runs in your browser.`;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'DevForge — Free Developer & Security Tools (in your browser)',
  description,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', siteName: 'DevForge', title: 'DevForge — Developer & Security Tools', description, url: '/' },
  twitter: { card: 'summary', title: 'DevForge — Developer & Security Tools', description },
  robots: { index: true, follow: true },
};

// Applies the saved theme before first paint so there is no light/dark flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('devforge-theme')||'{}').state;var c=(s&&s.colorScheme)||'system';if(c==='system')c=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var r=document.documentElement;r.classList.add(c);r.setAttribute('data-mantine-color-scheme',c);}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
