
// Utility for generating conversation titles from user content
export const generateTitle = (content: string): string => {
  if (!content || content.trim() === '') {
    return '新会话';
  }
  
  // 🔥 修复：检测并处理 AgentForm 消息
  if (content.includes('__AGENT_FORM_SUBMISSION__')) {
    return extractTitleFromAgentFormContent(content);
  }
  
  // 🔥 修复：处理结构化参数内容
  if (content.includes('【AgentForm】')) {
    return extractTitleFromAgentFormConfirmation(content);
  }
  
  // 清理内容，移除多余空白
  const cleanContent = content.trim().replace(/\s+/g, ' ');
  
  // 如果内容很短，直接返回
  if (cleanContent.length <= 15) {
    return cleanContent;
  }
  
  // 尝试提取有意义的关键词
  const meaningfulTitle = extractMeaningfulTitle(cleanContent);
  if (meaningfulTitle) {
    return meaningfulTitle;
  }
  
  // 默认使用前15个字符
  return `${cleanContent.substring(0, 15)}...`;
};

// 🔥 从 AgentForm 确认消息中提取标题
const extractTitleFromAgentFormConfirmation = (content: string): string => {
  try {
    // 查找用户实际输入的内容
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      // 跳过标题行和系统信息
      if (trimmedLine.startsWith('【') || trimmedLine.startsWith('[') || trimmedLine === '') {
        continue;
      }
      
      // 查找包含实际用户输入的行
      if (trimmedLine.includes('：') || trimmedLine.includes(':')) {
        const parts = trimmedLine.split(/[：:]/);
        if (parts.length > 1) {
          const userInput = parts[1].trim();
          if (userInput.length > 0 && !userInput.startsWith('data:')) {
            return userInput.length > 15 ? userInput.substring(0, 15) + '...' : userInput;
          }
        }
      } else if (trimmedLine.length > 0 && !trimmedLine.startsWith('data:')) {
        // 直接的用户输入
        return trimmedLine.length > 15 ? trimmedLine.substring(0, 15) + '...' : trimmedLine;
      }
    }
    
    return 'AgentForm执行';
  } catch (error) {
    console.error('Error extracting title from AgentForm confirmation:', error);
    return '新对话';
  }
};

// 🔥 新增：从 AgentForm 内容中提取标题
const extractTitleFromAgentFormContent = (content: string): string => {
  try {
    // 查找用户输入
    const inputMatch = content.match(/•\s*input:\s*([^\n•]+)/);
    const userInput = inputMatch ? inputMatch[1].trim() : '';
    
    // 查找 Agent 名称
    const agentMatch = content.match(/Agent:\s*([^A]+)/);
    const agentName = agentMatch ? agentMatch[1].trim() : '';
    
    // 优先使用用户输入
    if (userInput && userInput.length > 0) {
      const cleanInput = userInput.replace(/[^\w\s\u4e00-\u9fff]/g, '').trim();
      if (cleanInput.length > 0) {
        return cleanInput.length > 15 ? cleanInput.substring(0, 15) + '...' : cleanInput;
      }
    }
    
    // 使用 Agent 名称
    if (agentName) {
      return agentName.length > 15 ? agentName.substring(0, 15) + '...' : agentName;
    }
    
    return '工作流执行';
    
  } catch (error) {
    console.error('Error extracting title from AgentForm content:', error);
    return '新会话';
  }
};

// 🔥 提取有意义的标题
const extractMeaningfulTitle = (content: string): string | null => {
  // 移除常见的停用词和符号
  const cleanedContent = content
    .replace(/^(请|帮我|帮忙|可以|能否|我想|我要|需要)/g, '')
    .replace(/[，。！？,.!?]/g, '')
    .trim();
  
  if (cleanedContent.length === 0) {
    return null;
  }
  
  // 如果清理后的内容较短，直接使用
  if (cleanedContent.length <= 15) {
    return cleanedContent;
  }
  
  // 尝试找到第一个完整的词或短语
  const words = cleanedContent.split(/\s+/);
  let title = '';
  for (const word of words) {
    if ((title + word).length <= 15) {
      title += (title ? ' ' : '') + word;
    } else {
      break;
    }
  }
  
  return title || cleanedContent.substring(0, 15);
};
