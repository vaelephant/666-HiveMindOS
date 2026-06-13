import type { ChatTurn } from '@/lib/kb-types';
import { MEMORY_TYPE_LABEL } from '@/lib/kb-labels';

/** 将单轮回答格式化为可分享的 Markdown（含出处） */
export function formatTurnForCopy(turn: ChatTurn): string {
  const lines: string[] = [turn.answer.trim(), ''];

  const sources = turn.sources ?? [];
  const memories = turn.memories_used ?? [];
  const skills = turn.skills_used ?? [];

  if (sources.length > 0 || memories.length > 0 || skills.length > 0) {
    lines.push('---', '', '**引用来源**', '');
  }

  sources.forEach((s, i) => {
    lines.push(`${i + 1}. Wiki · ${s.name}${s.path ? ` (${s.path})` : ''}`);
  });

  memories.forEach((m) => {
    lines.push(`- 智慧 · ${m.title}（${MEMORY_TYPE_LABEL[m.memory_type] ?? m.memory_type}）`);
  });

  skills.forEach((s) => {
    lines.push(`- Skill · ${s.description || s.name}`);
  });

  if (turn.question.trim()) {
    lines.push('', '---', '', `**原问题：** ${turn.question.trim()}`);
  }

  return lines.join('\n');
}
