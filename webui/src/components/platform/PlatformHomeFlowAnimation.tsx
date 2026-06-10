'use client';

import { motion } from 'motion/react';

/**
 * 自主执行闭环（Loop Engineering）：
 * 规划 → 执行 → 复盘 → 沉淀 → 经验回流到下一轮规划。
 * 不是线性流水线，而是每一轮都有反馈的闭环。
 */
const NODE_R = 26;
const TOP_Y = 110;
const BOTTOM_Y = 270;
const LEFT_X = 140;
const RIGHT_X = 900;

const NODES = [
  { id: 1, label: '规划', sub: '目标拆解 · 经验召回', x: LEFT_X, y: TOP_Y, labelPos: 'top' },
  { id: 2, label: '执行', sub: '工具调用 · 逐步落地', x: RIGHT_X, y: TOP_Y, labelPos: 'top' },
  { id: 3, label: '复盘', sub: 'Rubric 打分 · 质量把关', x: RIGHT_X, y: BOTTOM_Y, labelPos: 'bottom' },
  { id: 4, label: '沉淀', sub: '经验 · Wiki · 交付物', x: LEFT_X, y: BOTTOM_Y, labelPos: 'bottom' },
] as const;

/** 闭环四条边（按流向）：上 → 右 → 下 → 左（回流） */
const EDGES = [
  { x1: LEFT_X + NODE_R, y1: TOP_Y, x2: RIGHT_X - NODE_R, y2: TOP_Y, delay: 0 },
  { x1: RIGHT_X, y1: TOP_Y + NODE_R, x2: RIGHT_X, y2: BOTTOM_Y - NODE_R, delay: 0.35 },
  { x1: RIGHT_X - NODE_R, y1: BOTTOM_Y, x2: LEFT_X + NODE_R, y2: BOTTOM_Y, delay: 0.7 },
  { x1: LEFT_X, y1: BOTTOM_Y - NODE_R, x2: LEFT_X, y2: TOP_Y + NODE_R, delay: 1.05 },
] as const;

const CENTER_X = (LEFT_X + RIGHT_X) / 2;
const CENTER_Y = (TOP_Y + BOTTOM_Y) / 2;

function AnimatedEdge({
  x1,
  y1,
  x2,
  y2,
  delay,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
}) {
  return (
    <>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--color-shell-border)"
        strokeWidth={2.5}
        strokeLinecap="round"
        markerEnd="url(#loop-arrow)"
      />
      <motion.line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--color-brand-primary)"
        strokeWidth={2}
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
  return (
    <section
      className="rounded-2xl border border-shell-border bg-shell-panel px-4 py-6 shadow-sm md:px-8 md:py-8"
      aria-label="自主执行闭环示意"
    >
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-bold text-shell-text">自主执行闭环</h2>
        <p className="text-[11px] font-medium uppercase tracking-wider text-shell-muted">
          Plan → Execute → Reflect → Loop
        </p>
      </div>
      <p className="mb-4 max-w-2xl text-xs leading-relaxed text-shell-muted">
        不是一次性回答，而是持续运行的闭环：规划拆解、逐步执行、Rubric 复盘把关——未达标自动重试，高分经验回流到下一轮规划，系统越跑越聪明。
      </p>

      <div className="-mx-2 overflow-x-auto pb-1 md:mx-0">
        <div className="relative mx-auto min-w-[720px] md:min-w-0">
          <svg viewBox="0 0 1080 370" className="h-auto w-full" role="img">
            <title>规划 → 执行 → 复盘 → 沉淀 → 经验回流（闭环）</title>
            <defs>
              <linearGradient id="flow-node-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0.08" />
              </linearGradient>
              {/* userSpaceOnUse：箭头固定大小，不随线宽缩放 */}
              <marker
                id="loop-arrow"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="11"
                markerHeight="11"
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill="var(--color-brand-primary)" opacity="0.6" />
              </marker>
            </defs>

            {EDGES.map((e) => (
              <AnimatedEdge key={`${e.x1}-${e.y1}-${e.x2}-${e.y2}`} {...e} />
            ))}

            {/* 复盘 → 执行 的重试小回路 */}
            <path
              d={`M ${RIGHT_X + 28} ${BOTTOM_Y - 34} C ${RIGHT_X + 72} ${CENTER_Y + 26}, ${RIGHT_X + 72} ${CENTER_Y - 26}, ${RIGHT_X + 28} ${TOP_Y + 34}`}
              fill="none"
              stroke="var(--color-shell-subtext)"
              strokeWidth={1.5}
              strokeDasharray="4 6"
              opacity={0.6}
              markerEnd="url(#loop-arrow)"
            />
            <text
              x={RIGHT_X + 84}
              y={CENTER_Y + 4}
              textAnchor="start"
              fill="var(--color-shell-muted)"
              className="text-[11px]"
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
              未达标 · 重试
            </text>

            {/* 左侧回流边说明 */}
            <text
              x={LEFT_X - 22}
              y={CENTER_Y - 2}
              textAnchor="end"
              fill="var(--color-brand-primary)"
              className="text-[12px] font-semibold"
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
              经验回流
            </text>
            <text
              x={LEFT_X - 22}
              y={CENTER_Y + 16}
              textAnchor="end"
              fill="var(--color-shell-muted)"
              className="text-[11px]"
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
              下一轮更聪明
            </text>

            {/* 环中心：闭环的本质 */}
            <text
              x={CENTER_X}
              y={CENTER_Y - 6}
              textAnchor="middle"
              fill="var(--color-shell-text)"
              className="text-[14px] font-semibold"
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
              每一轮都有反馈
            </text>
            <text
              x={CENTER_X}
              y={CENTER_Y + 16}
              textAnchor="middle"
              fill="var(--color-shell-muted)"
              className="text-[11px]"
              style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
            >
              高分沉淀 · 低分重试 · 经验复用
            </text>

            {NODES.map((node, i) => {
              const labelAbove = node.labelPos === 'top';
              const labelY = labelAbove ? node.y - NODE_R - 32 : node.y + NODE_R + 26;
              const subY = labelAbove ? node.y - NODE_R - 14 : node.y + NODE_R + 44;
              return (
                <g key={node.id}>
                  <motion.circle
                    cx={node.x}
                    cy={node.y}
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
                    cx={node.x}
                    cy={node.y}
                    r={NODE_R}
                    fill="var(--color-shell-panel)"
                    stroke="var(--color-shell-border)"
                    strokeWidth={2}
                  />
                  <text
                    x={node.x}
                    y={node.y + 5}
                    textAnchor="middle"
                    fill="var(--color-brand-primary)"
                    className="text-[15px] font-bold"
                    style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                  >
                    {node.id}
                  </text>
                  <text
                    x={node.x}
                    y={labelY}
                    textAnchor="middle"
                    fill="var(--color-shell-text)"
                    className="text-[13px] font-semibold"
                    style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                  >
                    {node.label}
                  </text>
                  <text
                    x={node.x}
                    y={subY}
                    textAnchor="middle"
                    fill="var(--color-shell-muted)"
                    className="text-[11px]"
                    style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}
                  >
                    {node.sub}
                  </text>
                </g>
              );
            })}

            {/* 沿闭环流动的光点 */}
            <circle r={4} fill="var(--color-brand-primary)">
              <animateMotion
                dur="12s"
                repeatCount="indefinite"
                calcMode="linear"
                path={`M ${LEFT_X} ${TOP_Y} H ${RIGHT_X} V ${BOTTOM_Y} H ${LEFT_X} Z`}
              />
            </circle>
          </svg>
        </div>
      </div>
    </section>
  );
}
