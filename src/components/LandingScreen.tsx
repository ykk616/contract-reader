"use client";

export default function LandingScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[72vh] text-center">
      <div className="mb-12 animate-fade-in">
        <img src="/icon-192.png" alt="" className="w-20 h-20 rounded-2xl shadow-xl shadow-ink-900/10 mb-8 mx-auto" />
        <div className="text-eyebrow text-ink-4 mb-6 tracking-[0.2em]">YOUR LEGAL COUNSEL · 您的私人法务</div>
        <h1 className="font-serif text-display text-ink mb-6">
          把冗长合同<br />
          <span className="gradient-text">压成你能读懂的要点</span>
        </h1>
        <p className="text-ink-3 text-lg max-w-md mx-auto leading-relaxed">
          上传合同，AI 自动识别关键条款、金额风险与争议解决条款。<br />
          任何手机、任何浏览器、点开即用。
        </p>
      </div>

      {/* 数据条 */}
      <div className="grid grid-cols-3 gap-px max-w-md w-full bg-ink-5 rounded-xl overflow-hidden mb-12 animate-slide-up">
        <div className="bg-white p-4">
          <div className="font-serif text-2xl font-bold text-ink font-num">199</div>
          <div className="text-xs text-ink-4 mt-1">合同模板</div>
        </div>
        <div className="bg-white p-4">
          <div className="font-serif text-2xl font-bold text-ink font-num">14</div>
          <div className="text-xs text-ink-4 mt-1">合同类别</div>
        </div>
        <div className="bg-white p-4">
          <div className="font-serif text-2xl font-bold text-ink">15s</div>
          <div className="text-xs text-ink-4 mt-1">平均出结果</div>
        </div>
      </div>

      <button
        onClick={onStart}
        className="group px-10 py-4 bg-ink text-white rounded-full font-medium text-base hover:bg-ink-2 transition-all active:scale-[0.97] shadow-lg shadow-ink-900/10"
      >
        开始使用
        <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
      </button>

      <div className="mt-10 flex items-center gap-2 text-xs text-ink-4">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        合同不上传 · 不外传 · 隐私优先
      </div>
    </div>
  );
}
