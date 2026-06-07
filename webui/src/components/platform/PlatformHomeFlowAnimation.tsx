'use client';

import { motion } from 'motion/react';

/** viewBox 内坐标：五段主流程（与平台导航对应） */
const STAGES = [
  { label: '数据准备', sub: '接入 · 清洗 · 血缘', x: 100 },
  { label: '标注质检', sub: '场景 · 任务 · 验收', x: 300 },
  { label: '训练实验', sub: '作业 · 跟踪 · 制品', x: 500 },
  { label: '评测门禁', sub: '基准 · 对比 · 报告', x: 700 },
  { label: '推理上线', sub: '部署 · 路由 · 观测', x: 900 },
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
        className="text-slate-200"
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
    const left = STAGES[i].x + NODE_R;
    const right = STAGES[i + 1].x - NODE_R;
    connectors.push({ x1: left, x2: right, delay: i * 0.35 });
  }

  return (
    <section
      className="rounded-2xl border border-shell-border bg-shell-panel px-4 py-6 shadow-sm md:px-8 md:py-8"
      aria-label="端到端流水线示意"
    >
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-bold text-shell-text">模型流水线</h2>
        <p className="text-[11px] font-medium uppercase tracking-wider text-shell-muted">
          SVG 流程动画 · 演示
        </p>
      </div>
      <p className="mb-5 max-w-2xl text-xs leading-relaxed text-shell-muted">
        从数据进入到推理观测的链路概览。虚线表示任务在阶段间持续流动（示意，非真实任务进度）。
      </p>

      <div className="-mx-2 overflow-x-auto pb-1 md:mx-0">
        <div className="relative mx-auto min-w-[720px] max-w-5xl md:min-w-0">
          <svg
            viewBox="0 0 1000 178"
            className="h-auto w-full text-shell-subtext"
            role="img"
            aria-hidden="false"
          >
            <title>数据准备 → 标注质检 → 训练实验 → 评测门禁 → 推理上线</title>
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

            {/* 沿中心轨道的流动光点（SVG/SMIL，与 indigo 虚线同色系） */}
            <circle r={4} fill="var(--color-brand-primary)">
              <animateMotion
                dur="12s"
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
