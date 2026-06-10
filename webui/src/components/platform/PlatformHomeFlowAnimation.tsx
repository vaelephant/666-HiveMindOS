'use client';

import { motion } from 'motion/react';

/** 自主任务引擎主链路：Plan → Execute → Reflect → 沉淀 */
const STAGES = [
  { label: '规划', sub: '目标拆解 · 委员会', x: 130 },
  { label: '执行', sub: '工具调用 · 逐步落地', x: 370 },
  { label: '复盘', sub: 'Rubric · 质量把关', x: 610 },
  { label: '沉淀', sub: '经验 · Wiki · 交付物', x: 850 },
] as const;

const NODE_Y = 72;
const NODE_R = 24;
const LABEL_Y = 128;

function LinkSegment({
  x1,
  x2,
  y,
  delay,
}: {
  x1: number;
  x2: number;
  y: number;
  delay: number;
}) {
  return (
    <>
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke="var(--color-shell-border)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <motion.line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke="var(--color-brand-primary)"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeDasharray="10 14"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -96 }}
        transition={{
          duration: 2.8,
          repeat: Infinity,
          ease: 'linear',
          delay,
        }}
      />
    </>
  );
}

export default function PlatformHomeFlowAnimation() {
  const connectors: { x1: number; x2: number; delay: number }[] = [];
  for (let i = 0; i < STAGES.length - 1; i++) {
    connectors.push({
      x1: STAGES[i].x + NODE_R,
      x2: STAGES[i + 1].x - NODE_R,
      delay: i * 0.35,
    });
  }

  return (
    <section
      className="rounded-2xl border border-shell-border bg-shell-panel px-4 py-6 shadow-sm md:px-8 md:py-8"
      aria-label="自主执行链路示意"
    >
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-bold text-shell-text">自主执行链路</h2>
        <p className="text-[11px] font-medium uppercase tracking-wider text-shell-muted">
          Plan → Execute → Reflect
        </p>
      </div>
      <p className="mb-5 max-w-2xl text-xs leading-relaxed text-shell-muted">
        说出业务目标后，规划委员会拆任务、Executor 逐步执行、Reflect 复盘把关，高分路径自动沉淀为可复用经验。
      </p>

      <div className="-mx-2 overflow-x-auto pb-1 md:mx-0">
        <div className="relative mx-auto min-w-[640px] max-w-5xl md:min-w-0">
          <svg viewBox="0 0 980 178" className="h-auto w-full" role="img">
            <title>规划 → 执行 → 复盘 → 沉淀</title>
            <defs>
              <linearGradient id="flow-node-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {connectors.map((c) => (
              <LinkSegment key={`${c.x1}-${c.x2}`} x1={c.x1} x2={c.x2} y={NODE_Y} delay={c.delay} />
            ))}

            {STAGES.map((stage, i) => (
              <g key={stage.label}>
                <motion.circle
                  cx={stage.x}
                  cy={NODE_Y}
                  r={NODE_R + 4}
                  fill="url(#flow-node-ring)"
                  initial={{ opacity: 0.5, scale: 0.92 }}
                  animate={{ opacity: [0.45, 0.85, 0.45], scale: [0.94, 1.02, 0.94] }}
                  transition={{
                    duration: 3.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.55,
                  }}
                />
                <circle
                  cx={stage.x}
                  cy={NODE_Y}
                  r={NODE_R}
                  fill="var(--color-shell-panel)"
                  stroke="var(--color-shell-border)"
                  strokeWidth={2}
                />
                <text
                  x={stage.x}
                  y={NODE_Y + 5}
                  textAnchor="middle"
                  fill="var(--color-brand-primary)"
                  className="text-[15px] font-bold"
                  style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  {i + 1}
                </text>
                <text
                  x={stage.x}
                  y={LABEL_Y}
                  textAnchor="middle"
                  fill="var(--color-shell-text)"
                  className="text-[13px] font-semibold"
                  style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  {stage.label}
                </text>
                <text
                  x={stage.x}
                  y={LABEL_Y + 18}
                  textAnchor="middle"
                  fill="var(--color-shell-muted)"
                  className="text-[11px]"
                  style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                >
                  {stage.sub}
                </text>
              </g>
            ))}

            <circle r={4} fill="var(--color-brand-primary)">
              <animateMotion
                dur="10s"
                repeatCount="indefinite"
                calcMode="linear"
                path={STAGES.map((s, i) =>
                  i === 0 ? `M ${s.x} ${NODE_Y}` : `L ${s.x} ${NODE_Y}`,
                ).join(' ')}
              />
            </circle>
          </svg>
        </div>
      </div>
    </section>
  );
}
