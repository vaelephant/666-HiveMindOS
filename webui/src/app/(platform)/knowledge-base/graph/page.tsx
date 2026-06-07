'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getEntityDetail, listEntities } from '@/lib/kb-api';
import type { Entity, EntityDetail } from '@/lib/kb-types';

type FilterType = string | 'all';

const TYPE_LABEL: Record<string, string> = {
  customer: '客户', product: '产品', process: '流程',
  rule: '规则', person: '人员', contract: '合同', department: '部门',
};

function typeLabel(t: string) {
  return TYPE_LABEL[t] ?? t;
}

export default function GraphPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Derive available types from loaded entities
  const types = ['all', ...Array.from(new Set(entities.map((e) => e.entity_type)))];

  useEffect(() => {
    setLoadingList(true);
    setListError(null);
    listEntities(undefined, filter === 'all' ? undefined : filter)
      .then(setEntities)
      .catch((e: Error) => setListError(e.message))
      .finally(() => setLoadingList(false));
  }, [filter]);

  function selectEntity(entity: Entity) {
    setLoadingDetail(true);
    setDetail(null);
    getEntityDetail(entity.name)
      .then(setDetail)
      .catch(() => setDetail({ entity, neighbors: [] }))
      .finally(() => setLoadingDetail(false));
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-shell-border">
        <div className="px-4 py-5">
          <p className="text-[11px] font-medium tracking-wide text-shell-muted">实体列表</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-b border-shell-border px-4 pb-4">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`text-[12px] transition-colors ${
                filter === t
                  ? 'font-medium text-shell-text'
                  : 'text-shell-muted hover:text-shell-subtext'
              }`}
            >
              {t === 'all' ? '全部' : typeLabel(t)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-4 animate-spin text-shell-muted" />
            </div>
          ) : listError ? (
            <p className="px-4 py-6 text-[12px] text-status-error">{listError}</p>
          ) : entities.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-shell-muted">暂无实体，请先上传资料</p>
          ) : (
            <ul className="divide-y divide-shell-border">
              {entities.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => selectEntity(e)}
                    className={`w-full px-4 py-3.5 text-left transition-colors ${
                      detail?.entity.id === e.id
                        ? 'text-brand-primary'
                        : 'text-shell-subtext hover:text-shell-text'
                    }`}
                  >
                    <span className="text-[11px] text-shell-muted">{typeLabel(e.entity_type)}</span>
                    <p className="mt-0.5 truncate text-[14px] font-medium">{e.name}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto py-8">
        {loadingDetail ? (
          <div className="flex items-center gap-2 text-shell-muted">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-[14px]">加载中…</span>
          </div>
        ) : detail ? (
          <div className="w-full space-y-10">
            <header>
              <p className="text-[12px] text-shell-muted">{typeLabel(detail.entity.entity_type)}</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text">
                {detail.entity.name}
              </h1>
            </header>

            {Object.keys(detail.entity.attributes).length > 0 && (
              <section>
                <p className="text-[11px] font-medium tracking-wide text-shell-muted">属性</p>
                <dl className="mt-4 divide-y divide-shell-border">
                  {Object.entries(detail.entity.attributes).map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-8 py-3.5">
                      <dt className="text-[13px] text-shell-muted">{k}</dt>
                      <dd className="text-[14px] font-medium text-shell-text">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {detail.neighbors.length > 0 && (
              <section>
                <p className="text-[11px] font-medium tracking-wide text-shell-muted">
                  关联实体 · {detail.neighbors.length}
                </p>
                <ul className="mt-4 divide-y divide-shell-border">
                  {detail.neighbors.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => selectEntity(n)}
                        className="flex w-full items-baseline justify-between py-3.5 text-left transition-colors hover:text-brand-primary"
                      >
                        <span className="text-[14px] text-shell-text">{n.name}</span>
                        <span className="text-[12px] text-shell-muted">{typeLabel(n.entity_type)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <p className="pt-24 text-[15px] text-shell-muted">从左侧选择实体，查看详情与关联</p>
        )}
      </div>
    </div>
  );
}
