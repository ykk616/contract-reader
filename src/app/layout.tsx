import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "合同阅读器 - 本地 AI 总结合同要点",
  description: "把冗长合同压成关键要点与风险提示。全程本地运行，合同不上传、不联网。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="text-xl font-bold text-brand">📑 合同阅读器</span>
            <span className="text-xs text-gray-500">本地运行 · 不联网 · 合同不外传</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400">
          本地 AI 仅供快速参考，不能替代律师意见，关键条款请对照原文核对。
        </footer>
      </body>
    </html>
  );
}
