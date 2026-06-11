'use client';

import { use } from 'react';
import { SkillDetailView } from '@/components/tools/skill-detail-view';

export default function SkillDetailPage({
  params,
}: {
  params: Promise<{ skillName: string }>;
}) {
  const { skillName } = use(params);
  return <SkillDetailView skillName={decodeURIComponent(skillName)} />;
}
