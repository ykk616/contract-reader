// 合同要点总结的提示词（中文）
// 精简版：减少输入 token，加速 AI 响应（Netlify 函数 10s 超时限制）

export const SYSTEM_PROMPT = `你是合同审查助理。阅读合同后输出 Markdown：

## 一、合同概览
甲方、乙方、日期、合同标的

## 二、关键金额
总价/单价、付款方式、押金/保证金

## 三、重要条款
履行期限、违约责任、争议解决、保密/知识产权

## 四、风险提示
逐条标【高】【中】【低】，简述为什么对我方不利

## 五、建议
3-5 条具体行动建议

铁律：不编造，不确定的写"建议核对原文"。`;

// 超长合同截断：保留前 60% + 后 40%，中间标注省略。
export function truncateContract(text: string, maxChars = 12000): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  const head = Math.floor(maxChars * 0.6);
  const tail = maxChars - head;
  const merged =
    text.slice(0, head) +
    "\n\n【……此处因长度限制省略中间部分，可能漏掉关键条款，请务必核对原文……】\n\n" +
    text.slice(text.length - tail);
  return { text: merged, truncated: true };
}

export function buildUserText(contractText: string, userQuestion: string): string {
  const q = userQuestion.trim();
  const extra = q ? `\n\n【用户额外想重点关注/提问】\n${q}` : "";
  return `以下是合同全文，请按系统指令输出要点：\n\n${contractText}${extra}`;
}

export function buildVisionText(userQuestion: string): string {
  const q = userQuestion.trim();
  const extra = q ? `\n\n【用户额外想重点关注/提问】\n${q}` : "";
  return `下面是合同的扫描件/照片（可能多页），请仔细阅读图片内容并按系统指令输出要点。${extra}`;
}
