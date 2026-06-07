import type { Metadata } from 'next';
import { Instrument_Serif, Inter } from 'next/font/google';
import MarketingHome from '@/components/MarketingHome';

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

export const metadata: Metadata = {
  title: 'WareMind OS — AI 仓储智能管理',
  description:
    'WareMind：仓库基础、入出库、库存、智能库位、盘点、设备自动化、数据分析与 AI 决策——从人工调度到智能执行。',
};

export default function HomePage() {
  return (
    <div
      className={`${landingSerif.variable} ${landingSans.variable} [font-family:var(--font-landing-sans),ui-sans-serif,system-ui,sans-serif]`}
    >
      <MarketingHome />
    </div>
  );
}
