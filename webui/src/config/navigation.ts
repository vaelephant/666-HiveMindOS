import type { LucideIcon } from 'lucide-react';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';
import {
  BookOpen,
  Box,
  ClipboardList,
  Container,
  Database,
  FolderKanban,
  GraduationCap,
  Grid3x3,
  HardDrive,
  Home,
  Layers,
  LayoutDashboard,
  LineChart,
  ListTodo,
  MessageSquare,
  Network,
  Rocket,
  Server,
  Settings,
  Shield,
  Tags,
  Upload,
  Wrench,
} from 'lucide-react';

/** 与 docs/1-导航与路由-开发参考.md 对齐；本仓库 marketing 占用 `/`，平台首页使用 `/home`。 */
export const PLATFORM_HOME_PATH = '/home' as const;

export type FactoryDomain = 'data' | 'model' | 'platform';

export type PrimaryNavKey =
  | 'home'
  | 'knowledge_base'
  | 'data_workshop'
  | 'data_center'
  | 'annotation'
  | 'training'
  | 'models'
  | 'evaluation'
  | 'inference'
  | 'platform'
  | 'registry'
  | 'resources'
  | 'storage'
  | 'ipfs_monitor';

export type AnnotationNavKey =
  | 'annotation_overview'
  | 'annotation_scenes'
  | 'annotation_projects'
  | 'annotation_my_tasks'
  | 'annotation_tag_templates';

export type AnnotationChild = {
  navKey: AnnotationNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type KnowledgeBaseNavKey =
  | 'kb_overview'
  | 'kb_ingest'
  | 'kb_wiki'
  | 'kb_query'
  | 'kb_graph';

export type KnowledgeBaseChild = {
  navKey: KnowledgeBaseNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type IpfsMonitorNavKey =
  | 'ipfs_dashboard'
  | 'ipfs_nodes'
  | 'ipfs_analytics'
  | 'ipfs_settings';

export type IpfsMonitorChild = {
  navKey: IpfsMonitorNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type PrimaryNavItem =
  | {
      navKey: Exclude<PrimaryNavKey, 'annotation' | 'ipfs_monitor' | 'knowledge_base'>;
      label: string;
      href: string;
      icon: LucideIcon;
      factory: FactoryDomain;
    }
  | {
      navKey: 'annotation';
      label: string;
      icon: LucideIcon;
      factory: FactoryDomain;
      children: AnnotationChild[];
    }
  | {
      navKey: 'ipfs_monitor';
      label: string;
      icon: LucideIcon;
      factory: FactoryDomain;
      children: IpfsMonitorChild[];
    }
  | {
      navKey: 'knowledge_base';
      label: string;
      icon: LucideIcon;
      factory: FactoryDomain;
      children: KnowledgeBaseChild[];
    };

export const ANNOTATION_CHILDREN: AnnotationChild[] = [
  {
    navKey: 'annotation_overview',
    label: '概览',
    href: '/annotation/overview',
    icon: LayoutDashboard,
  },
  {
    navKey: 'annotation_scenes',
    label: '标注场景',
    href: '/annotation/scenes',
    icon: Grid3x3,
  },
  {
    navKey: 'annotation_projects',
    label: '标注项目',
    href: '/annotation/projects',
    icon: FolderKanban,
  },
  {
    navKey: 'annotation_my_tasks',
    label: '我的任务',
    href: '/annotation/tasks',
    icon: ListTodo,
  },
  {
    navKey: 'annotation_tag_templates',
    label: '标签模板',
    href: '/annotation/tag-templates',
    icon: Tags,
  },
];

export const IPFS_MONITOR_CHILDREN: IpfsMonitorChild[] = [
  {
    navKey: 'ipfs_dashboard',
    label: '仪表板',
    href: IPFS_MONITOR_BASE_PATH,
    icon: LayoutDashboard,
  },
  {
    navKey: 'ipfs_nodes',
    label: '节点',
    href: `${IPFS_MONITOR_BASE_PATH}/nodes`,
    icon: Network,
  },
  {
    navKey: 'ipfs_analytics',
    label: '分析',
    href: `${IPFS_MONITOR_BASE_PATH}/analytics`,
    icon: LineChart,
  },
  {
    navKey: 'ipfs_settings',
    label: '设置',
    href: `${IPFS_MONITOR_BASE_PATH}/settings`,
    icon: Settings,
  },
];

/** 仪表板仅匹配 `/ipfs-monitor`，避免子路由误高亮 */
export function isIpfsMonitorChildActive(child: IpfsMonitorChild, pathname: string): boolean {
  if (child.navKey === 'ipfs_dashboard') {
    return pathname === child.href || pathname === `${child.href}/`;
  }
  return pathname === child.href || pathname.startsWith(`${child.href}/`);
}

export const KB_BASE_PATH = '/knowledge-base' as const;

export const KNOWLEDGE_BASE_CHILDREN: KnowledgeBaseChild[] = [
  { navKey: 'kb_overview', label: '概览',     href: `${KB_BASE_PATH}/overview`, icon: LayoutDashboard },
  { navKey: 'kb_ingest',   label: '上传资料', href: `${KB_BASE_PATH}/ingest`,   icon: Upload },
  { navKey: 'kb_wiki',     label: 'Wiki 浏览', href: `${KB_BASE_PATH}/wiki`,    icon: BookOpen },
  { navKey: 'kb_query',    label: '知识问答', href: `${KB_BASE_PATH}/query`,    icon: MessageSquare },
  { navKey: 'kb_graph',    label: '实体图谱', href: `${KB_BASE_PATH}/graph`,    icon: Network },
];

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { navKey: 'home', label: '首页', href: PLATFORM_HOME_PATH, icon: Home, factory: 'platform' },
  {
    navKey: 'knowledge_base',
    label: '知识库',
    icon: Database,
    factory: 'platform',
    children: KNOWLEDGE_BASE_CHILDREN,
  },
  {
    navKey: 'data_workshop',
    label: '数据工坊',
    href: '/data/workshop',
    icon: Wrench,
    factory: 'data',
  },
  {
    navKey: 'data_center',
    label: '数据中心',
    href: '/data/center',
    icon: Database,
    factory: 'data',
  },
  {
    navKey: 'annotation',
    label: '标注中心',
    icon: Tags,
    factory: 'data',
    children: ANNOTATION_CHILDREN,
  },
  {
    navKey: 'training',
    label: '训练中心',
    href: '/training',
    icon: GraduationCap,
    factory: 'model',
  },
  { navKey: 'models', label: '模型中心', href: '/models', icon: Box, factory: 'model' },
  {
    navKey: 'evaluation',
    label: '评测中心',
    href: '/evaluation',
    icon: ClipboardList,
    factory: 'model',
  },
  { navKey: 'inference', label: '推理服务', href: '/inference', icon: Rocket, factory: 'model' },
  { navKey: 'platform', label: '平台管理', href: '/platform', icon: Shield, factory: 'platform' },
  {
    navKey: 'registry',
    label: '镜像中心',
    href: '/registry',
    icon: Container,
    factory: 'model',
  },
  { navKey: 'resources', label: '资源中心', href: '/resources', icon: Server, factory: 'model' },
  {
    navKey: 'storage',
    label: '存储中心',
    href: '/storage',
    icon: HardDrive,
    factory: 'data',
  },
  {
    navKey: 'ipfs_monitor',
    label: 'IPFS 监控',
    icon: Network,
    factory: 'platform',
    children: IPFS_MONITOR_CHILDREN,
  },
];

export type TopNavKey = 'hologram' | 'middle_platform' | 'model_market';

export type TopNavItem = {
  navKey: TopNavKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

export const TOP_NAV: TopNavItem[] = [
  { navKey: 'hologram', label: '能力全景', href: '/hologram', icon: LayoutDashboard },
  { navKey: 'middle_platform', label: 'AI 中台', href: PLATFORM_HOME_PATH, icon: Layers },
  { navKey: 'model_market', label: '模型市场', href: '/market/models', icon: Box },
];

/** 用于校验「无更深动态段」的静态路由是否存在 */
export function collectStaticPlatformPaths(): Set<string> {
  const paths = new Set<string>();
  for (const item of PRIMARY_NAV) {
    if (
      item.navKey === 'annotation' ||
      item.navKey === 'ipfs_monitor' ||
      item.navKey === 'knowledge_base'
    ) {
      for (const child of item.children) paths.add(child.href);
    } else {
      paths.add(item.href);
    }
  }
  for (const t of TOP_NAV) paths.add(t.href);
  return paths;
}

const STATIC_PLATFORM_PATHS = collectStaticPlatformPaths();

export function isPlatformPathAllowed(segments: string[] | undefined): boolean {
  if (!segments?.length) return false;
  const path = `/${segments.join('/')}`;
  if (STATIC_PLATFORM_PATHS.has(path)) return true;
  if (path.startsWith('/annotation/scenes')) return true;
  if (path === IPFS_MONITOR_BASE_PATH || path.startsWith(`${IPFS_MONITOR_BASE_PATH}/`)) return true;
  if (path === KB_BASE_PATH || path.startsWith(`${KB_BASE_PATH}/`)) return true;
  return false;
}

export function getTitleFromSegments(segments: string[] | undefined): string {
  if (!segments?.length) return '页面';
  const path = `/${segments.join('/')}`;
  for (const item of PRIMARY_NAV) {
    if (item.navKey === 'annotation') {
      for (const c of item.children) {
        if (c.href === path) return c.label;
      }
    } else if (item.navKey === 'ipfs_monitor') {
      for (const c of item.children) {
        if (c.navKey === 'ipfs_dashboard' && (path === c.href || path === `${c.href}/`)) return c.label;
        if (c.href === path) return c.label;
      }
    } else if (item.navKey === 'knowledge_base') {
      for (const c of item.children) {
        if (c.href === path) return c.label;
      }
    } else if (item.href === path) {
      return item.label;
    }
  }
  for (const t of TOP_NAV) {
    if (t.href === path) return t.label;
  }
  if (path.startsWith('/annotation/scenes')) return '标注场景';
  if (path.startsWith(`${IPFS_MONITOR_BASE_PATH}/nodes/`)) return '节点详情';
  if (path.startsWith(`${IPFS_MONITOR_BASE_PATH}/nodes`)) return '节点';
  if (path.startsWith(`${IPFS_MONITOR_BASE_PATH}/analytics`)) return '分析';
  if (path.startsWith(`${IPFS_MONITOR_BASE_PATH}/settings`)) return '设置';
  if (path.startsWith(`${IPFS_MONITOR_BASE_PATH}/`)) return 'IPFS 监控';
  return '页面';
}
