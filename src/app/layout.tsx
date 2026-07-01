"use client";

import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <title>私人法务 · Your Legal Counsel</title>
        <meta name="description" content="把合同压成你能读懂的关键要点与风险提示" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0a0a0a" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="私人法务" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Source+Han+Serif+SC:wght@400;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#fafafa]">
        {/* 顶部品牌栏 */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-ink-5">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent("youna:go-home"))}>
              <img src="/icon-192.png" alt="" className="w-9 h-9 rounded-lg shadow-sm" />
              <div className="flex items-baseline gap-2.5">
                <span className="font-serif text-lg font-bold text-ink tracking-tight">私人法务</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink-4 font-medium hidden sm:inline">
                  Your Legal Counsel
                </span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-5 text-xs text-ink-3">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                服务可用
              </span>
              <span className="text-ink-4">|</span>
              <span>合同不上传不外传</span>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("youna:go-home"))}
              className="text-xs text-ink-3 hover:text-ink transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ink-5 hover:border-ink-3"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              主页
            </button>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-ink-5 bg-white/50 backdrop-blur py-5 mt-12">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-4">
            <p>本工具仅供快速参考，不替代律师专业意见，关键条款请对照原文核对</p>
            <p className="text-ink-4">© 2026 私人法务 · AI 驱动 · 隐私优先</p>
          </div>
        </footer>
      </body>
    </html>
  );
}