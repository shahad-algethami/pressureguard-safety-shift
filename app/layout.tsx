import type { Metadata } from 'next';
import '@fontsource-variable/inter';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';
import { ExperienceProvider } from '@/components/experience-context';
export const metadata: Metadata = {
  title: 'PressureGuard AI | The Safety Shift',
  description:
    'A two-to-three-minute patient-safety experience. One patient. Your attention. A safer handoff.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <ExperienceProvider>{children}</ExperienceProvider>
      </body>
    </html>
  );
}
