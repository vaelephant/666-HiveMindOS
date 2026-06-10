type AuthBrandPanelProps = {
  brand?: string;
  kicker: string;
  title: string;
  description: string;
  footer?: string;
};

/** 登录 / 注册页左侧 — 品牌色渐变 + 白色简约文案 */
export function AuthBrandPanel({
  brand = 'HiveMind OS',
  kicker,
  title,
  description,
  footer,
}: AuthBrandPanelProps) {
  return (
    <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
      <div
        className="absolute inset-0 bg-gradient-to-br from-brand-primary via-auth-accent to-auth-accent-soft"
        aria-hidden
      />
      <div
        className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/[0.12] blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-black/[0.08] blur-3xl"
        aria-hidden
      />

      <div className="relative z-10">
        <p className="text-sm font-semibold tracking-tight text-white">{brand}</p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/70">
          {kicker}
        </p>
      </div>

      <div className="relative z-10 max-w-md space-y-5">
        <h2 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-white xl:text-[2.125rem]">
          {title}
        </h2>
        <p className="text-sm font-medium leading-relaxed text-white/80">{description}</p>
      </div>

      <p className="relative z-10 text-[11px] font-medium text-white/45">
        {footer ?? `© ${new Date().getFullYear()} ${brand}`}
      </p>
    </div>
  );
}
