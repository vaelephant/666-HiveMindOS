import type { Metadata } from 'next';
import RegisterView from '@/components/RegisterView';

export const metadata: Metadata = {
  title: '注册 · HiveMind OS',
  description: '注册 HiveMind OS 账号，获得独立知识库与任务工作空间。',
};

export default function RegisterPage() {
  return <RegisterView />;
}
