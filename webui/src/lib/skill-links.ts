/** Deep link to a single org Skill (Chat 引用、工具箱列表共用). */
export function skillDetailHref(name: string): string {
  return `/tools/skills/${encodeURIComponent(name)}`;
}

/** Split agentskills.io SKILL.md frontmatter from body. */
export function parseSkillMarkdown(raw: string): { description: string; body: string } {
  let description = '';
  let body = raw.trim();
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3);
    if (end >= 0) {
      const frontmatter = body.slice(3, end);
      body = body.slice(end + 4).trim();
      const m = frontmatter.match(/^description:\s*(.+)$/m);
      if (m) description = m[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  return { description, body };
}
