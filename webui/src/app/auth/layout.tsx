import { Instrument_Serif, Inter } from 'next/font/google';

const landingSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-landing-serif',
  display: 'swap',
});

const landingSans = Inter({
  subsets: ['latin'],
  variable: '--font-landing-sans',
  display: 'swap',
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${landingSerif.variable} ${landingSans.variable} min-h-screen bg-auth-deep text-zinc-100 antialiased [font-family:var(--font-landing-sans),ui-sans-serif,system-ui,sans-serif]`}
    >
      {children}
    </div>
  );
}
