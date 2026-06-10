'use client';

import { useEffect, useState } from 'react';
import { Download, ExternalLink, FileQuestion, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sourceFileUrl } from '@/lib/kb-api';
import type { SourceRecord } from '@/lib/kb-types';
import { sourceTypeFromFilename } from '@/lib/source-file-formats';

export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other';

export function previewKind(filename: string): PreviewKind {
  const type = sourceTypeFromFilename(filename);
  if (type === 'image') return 'image';
  if (type === 'video') return 'video';
  if (type === 'audio') return 'audio';
  if (type === 'pdf') return 'pdf';
  if (type === 'text') return 'text';
  return 'other';
}

/** 图片 / 视频 / 音频 — 仅可预览，不参与编译 */
export function isMediaFile(filename: string): boolean {
  const kind = previewKind(filename);
  return kind === 'image' || kind === 'video' || kind === 'audio';
}

const MAX_TEXT_PREVIEW = 200_000;

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((text) => {
        if (cancelled) return;
        setContent(text.length > MAX_TEXT_PREVIEW ? `${text.slice(0, MAX_TEXT_PREVIEW)}\n\n…（内容过长，已截断）` : text);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) {
    return <p className="py-16 text-center text-[13px] text-shell-muted">无法加载文本内容</p>;
  }
  if (content === null) {
    return (
      <div className="flex items-center justify-center py-16 text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }
  return (
    <pre className="max-h-full overflow-auto whitespace-pre-wrap rounded-lg bg-shell-bg p-4 font-mono text-[12px] leading-relaxed text-shell-subtext">
      {content}
    </pre>
  );
}

export function SourcePreviewDialog({
  source,
  onClose,
}: {
  source: SourceRecord | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [source, onClose]);

  if (!source) return null;

  const kind = previewKind(source.filename);
  const url = sourceFileUrl(source.id);
  const downloadUrl = `${url}?download=true`;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 p-4 backdrop-blur-[2px] sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`预览 ${source.filename}`}
    >
      <div
        className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-shell-border bg-shell-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-shell-border px-5 py-3.5">
          <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-shell-text" title={source.filename}>
            {source.filename}
          </p>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<a href={url} target="_blank" rel="noreferrer" />}
            aria-label="新标签页打开"
          >
            <ExternalLink className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<a href={downloadUrl} />}
            aria-label="下载"
          >
            <Download className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-shell-bg/40 p-4">
          {kind === 'image' && (
            <div className="flex min-h-[320px] items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={source.filename} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
            </div>
          )}

          {kind === 'video' && (
            <div className="flex min-h-[320px] items-center justify-center">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={url} controls className="max-h-[70vh] max-w-full rounded-lg" />
            </div>
          )}

          {kind === 'audio' && (
            <div className="flex min-h-[200px] items-center justify-center">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={url} controls className="w-full max-w-md" />
            </div>
          )}

          {kind === 'pdf' && (
            <iframe src={url} title={source.filename} className="h-[70vh] w-full rounded-lg border-0 bg-white" />
          )}

          {kind === 'text' && <TextPreview url={url} />}

          {kind === 'other' && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-shell-bg">
                <FileQuestion className="size-5 text-shell-muted" strokeWidth={1.5} />
              </div>
              <p className="text-[14px] font-medium text-shell-text">该格式暂不支持在线预览</p>
              <p className="text-[12px] text-shell-muted">Word / Excel / PPT / WPS 等 Office 格式请下载后查看</p>
              <Button variant="outline" size="sm" className="mt-2" nativeButton={false} render={<a href={downloadUrl} />}>
                <Download data-icon="inline-start" />
                下载原文件
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
