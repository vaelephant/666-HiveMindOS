import { code } from '@streamdown/code';
import { cjk } from '@streamdown/cjk';
import { mermaid } from '@streamdown/mermaid';
import type { PluginConfig } from 'streamdown';
import { ChatChartBlock } from '@/components/chat/charts';

export const chatMarkdownPlugins: PluginConfig = {
  code,
  cjk,
  mermaid,
  renderers: [{ language: 'chart', component: ChatChartBlock }],
};
