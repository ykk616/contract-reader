"use client";

type Screen = "landing" | "dashboard" | "analyze" | "templates" | "history";

export default function DashboardScreen({
  onNavigate,
  onHome,
  historyCount,
}: {
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
  historyCount: number;
}) {
  return (
    <div className="animate-fade-in">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <div className="text-eyebrow text-ink-4 mb-3">DASHBOARD</div>
          <h1 className="font-serif text-h1 text-ink">选择功能</h1>
        </div>
        <button onClick={onHome} className="flex items-center gap-1.5 text-xs text-ink-4 hover:text-ink transition-colors px-3 py-1.5 rounded-full border border-ink-5 hover:border-ink-3">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          主页
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <button onClick={() => onNavigate("analyze")} className="card-premium group p-8 text-left">
          <div className="w-11 h-11 rounded-lg bg-ink text-white flex items-center justify-center mb-6">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-serif text-h2 text-ink mb-2">分析合同</h3>
          <p className="text-sm text-ink-3 leading-relaxed">上传合同文件，AI 自动提取关键条款与风险</p>
          <div className="mt-6 flex items-center text-xs text-ink-3 group-hover:text-ink transition-colors">
            开始分析 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </button>

        <button onClick={() => onNavigate("history")} className="card-premium group p-8 text-left">
          <div className="w-11 h-11 rounded-lg bg-ink text-white flex items-center justify-center mb-6">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-serif text-h2 text-ink mb-2">历史记录</h3>
          <p className="text-sm text-ink-3 leading-relaxed">{historyCount > 0 ? `已保存 ${historyCount} 份分析结果` : "查看之前的分析结果"}</p>
          <div className="mt-6 flex items-center text-xs text-ink-3 group-hover:text-ink transition-colors">
            查看历史 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </button>

        <button onClick={() => onNavigate("templates")} className="card-premium group p-8 text-left">
          <div className="w-11 h-11 rounded-lg bg-ink text-white flex items-center justify-center mb-6">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
          </div>
          <h3 className="font-serif text-h2 text-ink mb-2">合同模板</h3>
          <p className="text-sm text-ink-3 leading-relaxed">199 份常用合同范本 · 14 个类别</p>
          <div className="mt-6 flex items-center text-xs text-ink-3 group-hover:text-ink transition-colors">
            浏览模板 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </button>
      </div>

      {/* 信任徽章 */}
      <div className="mt-12 grid grid-cols-3 gap-6 text-center">
        <div>
          <div className="font-serif text-2xl font-bold text-ink font-num">100%</div>
          <div className="text-xs text-ink-4 mt-1">本地 OCR</div>
        </div>
        <div>
          <div className="font-serif text-2xl font-bold text-ink font-num">0</div>
          <div className="text-xs text-ink-4 mt-1">广告</div>
        </div>
        <div>
          <div className="font-serif text-2xl font-bold text-ink font-num">24/7</div>
          <div className="text-xs text-ink-4 mt-1">随时可用</div>
        </div>
      </div>
    </div>
  );
}
