import type { Metadata } from 'next';
import RegisterView from '@/components/RegisterView';

export const metadata: Metadata = {
  title: '注册 · HiveMind OS',
  description: '注册 HiveMind OS 账号，获得独立组织工作空间与 AI 自动执行能力。',
};

export default function RegisterPage() {
  return <RegisterView />;
}
