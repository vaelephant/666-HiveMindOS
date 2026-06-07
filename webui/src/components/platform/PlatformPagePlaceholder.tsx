import Link from 'next/link';
import { PLATFORM_HOME_PATH } from '@/config/navigation';

export type PlatformPagePlaceholderProps = {
  title: string;
  path: string;
  segments: string[];
};

export default function PlatformPagePlaceholder({
  title,
  path,
  segments,
}: PlatformPagePlaceholderProps) {
  const isScenes = path.startsWith('/annotation/scenes');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-shell-muted">
          {isScenes ? '标注中心 / 标注场景' : '星海 · AI 中台'}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-shell-text md:text-3xl">
          {title}
        </h1>
        <p className="font-mono text-xs text-shell-muted">路由：`{path}`</p>
        <p className="max-w-2xl text-sm leading-relaxed text-shell-subtext">
          占位页面：后续在此接入真实模块。主导航与路由约定见{' '}
          <code className="rounded bg-shell-panel-hover px-1 py-0.5 text-[11px] text-shell-text">
            docs/1-导航与路由-开发参考.md
          </code>
          ；菜单数据源为{' '}
          <code className="rounded bg-shell-panel-hover px-1 py-0.5 text-[11px] text-shell-text">
            src/config/navigation.ts
          </code>
          。
        </p>
      </div>

      {isScenes && segments.length >= 3 ? (
        <div className="rounded-xl border border-shell-border bg-shell-panel p-4 text-sm text-shell-subtext shadow-sm">
          <p className="font-medium text-shell-text">场景分类</p>
          <p className="mt-1 text-shell-subtext">
            当前分类路径段：<span className="font-mono text-xs">{segments.slice(2).join(' / ')}</span>
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Link
          href={PLATFORM_HOME_PATH}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dim"
        >
          返回首页
        </Link>
        <Link
          href="/annotation/scenes"
          className="rounded-lg border border-slate-300 bg-shell-panel px-4 py-2 text-sm font-medium text-shell-text hover:bg-shell-bg"
        >
          标注场景
        </Link>
      </div>
    </div>
  );
}
