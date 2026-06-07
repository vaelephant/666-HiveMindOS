import type { Metadata } from 'next';
import LoginView from '@/components/LoginView';

export const metadata: Metadata = {
  title: '登录 · WareMind OS',
  description: '登录 WareMind 仓储指挥中心（演示）。',
};

export default function LoginPage() {
  return <LoginView />;
}
