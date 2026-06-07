import type { Metadata } from 'next';
import InvitePromoView from '@/components/InvitePromoView';

export const metadata: Metadata = {
  title: '产品与推广 · WareMind OS',
  description:
    'WareMind：物流仓库智能管理系统，AI 决策 + 智能执行。',
};

export default function InvitePage() {
  return <InvitePromoView />;
}
