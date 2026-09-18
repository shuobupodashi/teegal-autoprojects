/**
 * JSON 解析工具
 * 多层容错解析，处理 LLM 返回的非标准 JSON
 */

/**
 * 🔥 常见 LaTeX 命令字典（仅收录首字母为 t/n/r/b/f/u 的命令）
 *
 * 背景：JSON 合法转义符恰好是 \t \n \r \b \f \u \" \\ \/
 * 当 LLM 在 JSON 字符串里写单反斜杠 LaTeX（如 $\theta$）时，
 * \theta 会被 JSON.parse 静默解析成 TAB + "heta"，\nu 变成换行 + "u"，
 * \rho 变成回车 + "ho"，\frac 变成换页 + "rac" —— 公式被无声破坏。
 * 其他首字母的命令（\sum \ge \gamma 等）不是合法转义，走通用修复即可，无需字典。
 */
const LATEX_TNRBFU_COMMANDS = /\\(?:t(?:h(?:ickapprox|erefore|eta)?|ilde|imes|o|an(?:h)?|op|riangle|frac|ext(?:rm|bf|it|tt)?)|n(?:abla|ewline|eq|ot|eg|mid|u)|r(?:ight(?:arrow|leftharpoons)?|floor|ceil|angle|brack|brace|vert|ho)|b(?:oldsymbol|ullet|owtie|eta|ar|ig(?:g|l|r)?|ot|mod)|f(?:rown|orall|rac)|u(?:nder(?:brace|line)|psilon))(?![a-zA-Z])/g;

/**
 * 🔥 修复 JSON 源文本中的无效转义（LaTeX 反斜杠场景）
 * 统一供 safeJSONParse 第2/4层复用
 */
export function repairJSONEscapes(jsonStr: string): string {
  let fixed = jsonStr;
  // 1. 先把合法的双反斜杠（\\）替换为占位符，保护它们不被误改
  const PLACEHOLDER = '\u0000';
  fixed = fixed.replace(/\\\\/g, PLACEHOLDER);
  // 2. 🔥 保护 LaTeX 命令占位（\theta/\times/\neq 等首字母恰为 JSON 合法转义符的命令）
  const latexPlaceholders: string[] = [];
  fixed = fixed.replace(LATEX_TNRBFU_COMMANDS, (m) => {
    latexPlaceholders.push(m);
    return `\u0001${latexPlaceholders.length - 1}\u0001`;
  });
  // 3. 修复无效转义：\x -> \\x（x 不是合法 JSON 转义字符，如 \sum 的 \s）
  fixed = fixed.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
  // 4. 还原双反斜杠占位符
  fixed = fixed.replace(/\u0000/g, '\\\\');
  // 5. 🔥 还原 LaTeX 命令（补一个反斜杠：raw \theta → \\theta，解析后值中才是 \theta 原样）
  fixed = fixed.replace(/\u0001(\d+)\u0001/g, (_, i) => '\\' + latexPlaceholders[parseInt(i)]);
  return fixed;
}

/**
 * 🔥 检测"合法转义"造成的静默破坏
 *
 * 背景：\theta 的 \t 恰好是合法 JSON 转义符，JSON.parse 会"成功"但把 \theta
 * 静默解析成 TAB+"heta"（\nu → 换行+"u"、\rho → 回车+"ho" 同理）。
 * 这种破坏不抛错，直接走第1层返回脏数据，必须解析后检测。
 *
 * 模式：控制字符（\t \n \r \b \f）后紧跟对应命令的剩余字母，且后面不是字母。
 * （\u 开头的命令不会静默破坏：\u 后非4位十六进制会让 JSON.parse 直接抛错，自然走修复层）
 */
const SILENT_LATEX_CORRUPTION = /(?:[\t](?:h(?:ickapprox|erefore|eta)?|ilde|imes|o|an(?:h)?|op|riangle|frac|ext(?:rm|bf|it|tt)?)|[\n](?:abla|ewline|eq|ot|eg|mid|u)|[\r](?:ight(?:arrow|leftharpoons)?|floor|ceil|angle|brack|brace|vert|ho)|[\b](?:oldsymbol|ullet|owtie|eta|ar|ig(?:g|l|r)?|ot|mod)|[\f](?:rown|orall|rac))(?![a-zA-Z])/;

/** 递归检查解析结果中是否有被静默破坏的 LaTeX 命令 */
function hasSilentLatexCorruption(value: unknown): boolean {
  if (typeof value === 'string') return SILENT_LATEX_CORRUPTION.test(value);
  if (Array.isArray(value)) return value.some(hasSilentLatexCorruption);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasSilentLatexCorruption);
  }
  return false;
}

/**
 * 🔥 反转义 JSON 字符串字面量内容（不含首尾引号）
 * 用于 SummaryModule fallback 等从原始文本正则提取字段后的还原
 */
export function unescapeJSONString(raw: string): string {
  // 优先走标准解析（内含 LaTeX 命令保护）
  const parsed = safeJSONParse(`"${raw}"`);
  if (typeof parsed === 'string') return parsed;

  // 兜底：手动反转义（带 LaTeX 命令保护，避免 \nu → 换行+u、\theta → TAB+heta）
  let s = raw;
  const latexPh: string[] = [];
  s = s.replace(LATEX_TNRBFU_COMMANDS, (m) => {
    latexPh.push(m);
    return `\u0001${latexPh.length - 1}\u0001`;
  });
  s = s.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
    .replace(/\\b/g, '\b').replace(/\\f/g, '\f')
    .replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => latexPh[parseInt(i)]);
  return s;
}

/**
 * 尝试修复常见的 JSON 格式问题
 */
export function fixMalformedJSON(jsonStr: string): string {
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch {
    // 继续尝试修复
  }

  let result = jsonStr;

  // 修复1：处理多行字符串值（将换行符转为 \n）
  const stringValuePattern = /"([^"]+)"\s*:\s*"([\s\S]*?)"(?=\s*[,}])/g;
  let match;
  const replacements: Array<{ start: number; end: number; fixed: string }> = [];

  while ((match = stringValuePattern.exec(jsonStr)) !== null) {
    const fullMatch = match[0];
    const key = match[1];
    let value = match[2];
    const matchStart = match.index;
    const matchEnd = matchStart + fullMatch.length;

    let needsFix = false;

    if (value.includes('\n') || value.includes('\r')) {
      needsFix = true;
    }

    for (let i = 0; i < value.length; i++) {
      if (value[i] === '"') {
        let backslashCount = 0;
        for (let j = i - 1; j >= 0 && value[j] === '\\'; j--) {
          backslashCount++;
        }
        if (backslashCount % 2 === 0) {
          needsFix = true;
          break;
        }
      }
    }

    if (needsFix) {
      let fixedValue = '';
      for (let i = 0; i < value.length; i++) {
        const char = value[i];
        if (char === '\n') {
          fixedValue += '\\n';
        } else if (char === '\r') {
          fixedValue += '\\r';
        } else if (char === '\t') {
          fixedValue += '\\t';
        } else if (char === '"') {
          let backslashCount = 0;
          for (let j = i - 1; j >= 0 && value[j] === '\\'; j--) {
            backslashCount++;
          }
          if (backslashCount % 2 === 0) {
            fixedValue += '\\"';
          } else {
            fixedValue += char;
          }
        } else if (char === '\\') {
          const nextChar = value[i + 1];
          if (nextChar && ['n', 'r', 't', '"', '\\', 'b', 'f', 'u'].includes(nextChar)) {
            fixedValue += char;
          } else {
            fixedValue += '\\\\';
          }
        } else {
          fixedValue += char;
        }
      }
      const fixed = `"${key}": "${fixedValue}"`;
      replacements.push({ start: matchStart, end: matchEnd, fixed });
    }
  }

  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, fixed } = replacements[i];
    result = result.substring(0, start) + fixed + result.substring(end);
  }

  // 修复2：括号不匹配（使用栈 + 字符串感知，正确处理嵌套顺序）
  // 旧实现先补 } 再补 ]，对 { "tools": [ ... } 这种嵌套会生成 }]（非法），
  // 应该先关内层 ] 再关外层 }。用栈记录打开顺序，逆序闭合即可。
  // 同时跳过 JSON 字符串值内的括号（如 task 里的 [-3,3]），避免误计数。
  const bracketStack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < result.length; i++) {
    const char = result[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === '{' || char === '[') {
      bracketStack.push(char);
    } else if (char === '}' || char === ']') {
      const top = bracketStack[bracketStack.length - 1];
      if (top === '{' && char === '}') bracketStack.pop();
      else if (top === '[' && char === ']') bracketStack.pop();
    }
  }
  for (let i = bracketStack.length - 1; i >= 0; i--) {
    result += bracketStack[i] === '{' ? '}' : ']';
  }

  return result;
}

/**
 * 安全的 JSON 解析
 * 多层尝试：直接解析 → 修复无效转义序列 → 修复后解析
 */
export function safeJSONParse(jsonStr: string): any | null {
  // 第1层：直接解析
  // 🔥 注意：含单反斜杠 LaTeX（如 \theta）的 JSON 是"合法"JSON（\t 是合法转义符），
  // JSON.parse 会成功但把 \theta 静默解析成 TAB+"heta"，必须解析后检测并重修
  try {
    const result = JSON.parse(jsonStr);
    if (!hasSilentLatexCorruption(result)) {
      return result;
    }
    // 检测到静默破坏：带 LaTeX 命令保护重新解析
    try {
      return JSON.parse(repairJSONEscapes(jsonStr));
    } catch {
      return result; // 修复失败则回退原结果（宁可脏数据也不能丢数据）
    }
  } catch {
    // 继续尝试
  }

  // 第2层：修复无效的转义序列（如 \a, \[, \] 等 LaTeX 公式中的反斜杠）
  // 🔥 含 LaTeX 命令保护（\theta/\times/\neq 等首字母恰为 JSON 合法转义符的命令）
  try {
    return JSON.parse(repairJSONEscapes(jsonStr));
  } catch (e) {
    // 继续尝试
  }

  // 第3层：使用 fixMalformedJSON 修复（处理多行字符串等）
  try {
    const fixed = fixMalformedJSON(jsonStr);
    if (fixed !== jsonStr) {
      const result = JSON.parse(fixed);
      // 🔥 同样检测静默 LaTeX 破坏（多行字符串 + \theta 共存时）
      if (!hasSilentLatexCorruption(result)) {
        return result;
      }
      try {
        return JSON.parse(repairJSONEscapes(fixed));
      } catch {
        return result;
      }
    }
  } catch {
    // 继续尝试
  }

  // 第4层：尝试提取 JSON 对象（从第一个 { 到最后一个 }）
  try {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonContent = jsonStr.substring(firstBrace, lastBrace + 1);
      // 再次尝试修复转义（含 LaTeX 命令保护）
      return JSON.parse(repairJSONEscapes(jsonContent));
    }
  } catch {
    // 继续尝试
  }

  return null;
}
