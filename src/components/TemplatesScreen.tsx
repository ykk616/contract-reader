"use client";

import { useState } from "react";
import { TEMPLATES, TEMPLATE_CATEGORIES, type Template } from "@/lib/templates";

export default function TemplatesScreen({
  onBack,
  onHome,
}: {
  onBack: () => void;
  onHome: () => void;
}) {
  const [templateCat, setTemplateCat] = useState("全部");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  function handleBack() {
    setSelectedTemplate(null);
    setTemplateCat("全部");
    setTemplateSearch("");
    onBack();
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={handleBack} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          返回
        </button>
        <button onClick={onHome} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1" title="主页">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          主页
        </button>
        <span className="text-ink-5">/</span>
        <span className="text-sm text-ink-3">合同模板</span>
      </div>

      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-eyebrow text-ink-4 mb-2">TEMPLATES</div>
          <h1 className="font-serif text-h1 text-ink">合同模板库</h1>
          <p className="text-sm text-ink-3 mt-2">199 份常用合同范本 · 14 个类别 · 一键复制</p>
        </div>
        <div className="hidden sm:block text-right">
          <div className="font-serif text-3xl font-bold text-ink font-num">{TEMPLATES.length}</div>
          <div className="text-xs text-ink-4 mt-1">总模板数</div>
        </div>
      </div>

      {selectedTemplate ? (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-h2 text-ink">{selectedTemplate.title}</h2>
            <button onClick={() => setSelectedTemplate(null)} className="text-sm text-ink-3 hover:text-ink transition-colors">← 返回列表</button>
          </div>
          <div className="p-8 bg-white border border-ink-5 rounded-xl">
            <pre className="text-sm leading-[1.85] text-ink-2 whitespace-pre-wrap font-sans">{selectedTemplate.content}</pre>
          </div>
          <button onClick={() => navigator.clipboard.writeText(selectedTemplate.content)} className="mt-4 px-5 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all">
            复制全文
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-5">
            <input type="text" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="搜索模板名称..." className="w-full border border-ink-5 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-ink-2/10 focus:border-ink outline-none" />
          </div>
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-2 px-2">
            {[{name:"全部",icon:"",count:199}, ...TEMPLATE_CATEGORIES].map((c) => (
              <button key={c.name} onClick={() => setTemplateCat(c.name)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${templateCat === c.name ? "bg-ink text-white" : "bg-white border border-ink-5 text-ink-3 hover:border-ink-3"}`}>
                {c.name}{c.count ? ` · ${c.count}` : ""}
              </button>
            ))}
          </div>
          <div className="grid gap-px sm:grid-cols-2 bg-ink-5 rounded-xl overflow-hidden">
            {TEMPLATES.filter((t) => {
              if (templateCat !== "全部" && t.category !== templateCat) return false;
              if (templateSearch && !t.title.includes(templateSearch)) return false;
              return true;
            }).map((t) => (
              <button key={t.id} onClick={() => setSelectedTemplate(t)} className="bg-white p-4 text-left hover:bg-ink-6/40 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink mb-1 truncate">{t.title}</div>
                    <div className="text-[10px] text-ink-4 tracking-[0.1em] uppercase">{t.category}</div>
                  </div>
                  <span className="text-ink-4 group-hover:text-ink">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
