// 多合同对比的专用 prompt

export const COMPARE_PROMPT = `你是一名资深合同审查助理，请对比 A 和 B 两份合同，输出差异与风险评估。

【对比维度】
1. 合同主体：甲方/乙方是否相同
2. 金额：总价/单价/付款方式差异
3. 关键条款：履约期限、验收标准、违约责任、知识产权
4. 风险差异：哪份对我方更有利

【输出格式（Markdown）】
## 一、差异总表
| 条款 | 合同A | 合同B | 差异影响 |

## 二、逐条分析
（逐条展开，标对哪方有利）

## 三、风险排序【高/中/低】
- 哪份合同对我方更有利

## 四、建议
- 签哪份 / 如何修改`;

export function buildCompareText(
  textA: string,
  fileNameA: string,
  textB: string,
  fileNameB: string
): string {
  return `请对比以下两份合同（A 和 B），按系统指令输出差异报告：

## 合同 A（${fileNameA}）
${textA.slice(0, 5000)}

## 合同 B（${fileNameB}）
${textB.slice(0, 5000)}`;
}
