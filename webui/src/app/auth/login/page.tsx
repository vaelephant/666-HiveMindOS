import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginView from '@/components/LoginView';

export const metadata: Metadata = {
  title: '登录 · HiveMind OS',
  description: '登录 HiveMind OS 平台。',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-auth-deep" />}>
      <LoginView />
    </Suspense>
  );
}
