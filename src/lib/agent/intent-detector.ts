/**
 * Intent Detector for BrowserCopilot Agent Integration
 * Determines if a user message requires Agent mode or regular chat mode
 */

export type TaskType = 'screenshot' | 'script' | 'dom' | 'mixed' | 'page-interaction' | 'chat';

export interface IntentResult {
  requiresAgent: boolean;
  taskType: TaskType;
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

// Agent task triggers - keywords that indicate the user wants agent automation
// Sorted by specificity - more specific triggers first
const AGENT_TRIGGERS: Record<string, TaskType> = {
  // Screenshot triggers
  '帮我截图': 'screenshot',
  '截屏': 'screenshot',
  '截图': 'screenshot',
  '截个屏': 'screenshot',
  '截图看看': 'screenshot',
  'capture': 'screenshot',
  'screenshot': 'screenshot',

  // Script triggers
  '帮我写脚本': 'script',
  '写脚本': 'script',
  '脚本': 'script',
  'userscript': 'script',
  'tampermonkey': 'script',
  '油猴': 'script',

  // DOM and page analysis triggers
  '帮我获取元素': 'dom',
  '获取元素': 'dom',
  '获取页面元素': 'dom',
  '查看DOM': 'dom',
  '分析页面': 'dom',
  '页面分析': 'dom',
  '页面结构': 'dom',
  '分析当前': 'dom',

  // Page interaction triggers
  '帮我点击': 'page-interaction',
  '点击': 'page-interaction',
  '自动点击': 'page-interaction',
  '帮我自动操作': 'page-interaction',
  '自动操作': 'page-interaction',
  '自动填充': 'page-interaction',
  '表单填写': 'page-interaction',
  '帮我滚动': 'page-interaction',
  '滚动': 'page-interaction',

  // General help/action triggers (least specific, fallback)
  '帮我做': 'mixed',
  '帮我处理': 'mixed',
  '帮我完成': 'mixed',
  '帮我执行': 'mixed',
  '帮我打开': 'page-interaction',
  '帮我关闭': 'page-interaction',
  '帮我输入': 'page-interaction',
  '帮我': 'mixed',
};

// Chat-only triggers - keywords that indicate the user is asking a question
// These take priority over agent triggers when there's ambiguity
const CHAT_TRIGGERS: string[] = [
  '是什么',
  '什么是',
  '什么意思',
  '解释一下',
  '解释',
  '告诉我',
  '帮我理解',
  '概念',
  '原理',
  '为什么',
  '如何',
  '怎么',
  '怎样',
  '介绍一下',
];

// Keywords that suggest agent action when combined with page context
const ACTION_KEYWORDS: string[] = [
  '页面',
  '网站',
  '当前',
  '这里',
  '这个',
  '那个',
  '打开',
  '关闭',
  '滚动',
  '滑动',
  '输入',
  '选择',
];

/**
 * Detects if a message requires agent mode or regular chat mode
 * @param message - The user message to analyze
 * @param useLlmFallback - Whether to use LLM for ambiguous cases (optional, default: true)
 * @returns Promise<IntentResult>
 */
export async function detectIntent(
  message: string,
  useLlmFallback: boolean = true
): Promise<IntentResult> {
  // Check triggers
  const agentMatches = detectAgentTriggers(message);
  const chatMatches = detectChatTriggers(message);

  // Decision logic - check for chat triggers first (they take priority)
  if (chatMatches.length > 0) {
    // If there's a chat trigger, check if there's also an agent trigger
    // that would override the chat intent
    const hasAgentOverride = hasOverrideAgentTrigger(message, chatMatches);
    if (!hasAgentOverride) {
      return {
        requiresAgent: false,
        taskType: 'chat',
        confidence: 'high',
        reasoning: `Detected chat trigger: ${chatMatches[0]}`,
      };
    }
  }

  if (agentMatches.length > 0) {
    const taskType = determineTaskType(agentMatches, message);
    return {
      requiresAgent: true,
      taskType,
      confidence: 'high',
      reasoning: `Detected ${agentMatches.length} agent trigger(s): ${agentMatches.join(', ')}`,
    };
  }

  // Ambiguous case - mixed triggers or no clear pattern
  if (useLlmFallback) {
    return await llmFallback(message, agentMatches, chatMatches.length > 0);
  }

  // Default to agent mode with low confidence if no LLM fallback
  return {
    requiresAgent: true,
    taskType: 'mixed',
    confidence: 'low',
    reasoning: 'Ambiguous intent, defaulting to agent mode',
  };
}

/**
 * Checks if there's an agent trigger that should override a chat trigger
 * For example: "帮我理解" should be chat, but "帮我做" should be agent
 */
function hasOverrideAgentTrigger(message: string, chatMatches: string[]): boolean {
  // Check if any agent trigger is present AND not contained within a chat trigger
  const agentMatches = detectAgentTriggers(message);

  for (const agentTrigger of agentMatches) {
    // Skip "帮我" as it's too generic
    if (agentTrigger === '帮我') continue;

    // Check if this agent trigger is NOT covered by a chat trigger
    // For example, "帮我做" contains "帮我" but should be agent
    const isCoveredByChat = chatMatches.some(chatTrigger =>
      message.includes(chatTrigger) && agentTrigger.startsWith(chatTrigger)
    );

    if (!isCoveredByChat) {
      return true;
    }
  }

  return false;
}

/**
 * Detects agent triggers in the message
 * Returns matches prioritized by length (longer matches first)
 */
function detectAgentTriggers(message: string): string[] {
  const matches: string[] = [];

  for (const trigger of Object.keys(AGENT_TRIGGERS)) {
    // Check both original and lowercase versions
    const lowerTrigger = trigger.toLowerCase();
    if (message.includes(trigger) || message.toLowerCase().includes(lowerTrigger)) {
      matches.push(trigger);
    }
  }

  // Sort by length descending to prioritize longer matches
  return matches.sort((a, b) => b.length - a.length);
}

/**
 * Detects chat-only triggers in the message
 * Returns matches prioritized by length (longer matches first)
 */
function detectChatTriggers(message: string): string[] {
  const matches: string[] = [];

  for (const trigger of CHAT_TRIGGERS) {
    if (message.includes(trigger)) {
      matches.push(trigger);
    }
  }

  // Sort by length descending to prioritize longer matches
  return matches.sort((a, b) => b.length - a.length);
}

/**
 * Determines the task type based on detected triggers
 * Returns 'mixed' when multiple different task types are detected
 */
function determineTaskType(matches: string[], message: string): TaskType {
  if (matches.length === 0) {
    return 'mixed';
  }

  // Collect all unique task types from matches
  const uniqueTaskTypes = new Set<TaskType>();

  for (const match of matches) {
    const taskType = AGENT_TRIGGERS[match];
    if (taskType) {
      uniqueTaskTypes.add(taskType);
    }
  }

  // If we have both non-mixed and mixed types, prioritize non-mixed
  const hasNonMixed = ['screenshot', 'script', 'dom', 'page-interaction'].some(
    type => uniqueTaskTypes.has(type as TaskType)
  );

  if (hasNonMixed) {
    // If there are multiple different non-mixed types, return 'mixed'
    const nonMixedTypes = ['screenshot', 'script', 'dom', 'page-interaction'];
    const nonMixedTypesFound = nonMixedTypes.filter(type =>
      uniqueTaskTypes.has(type as TaskType)
    );

    if (nonMixedTypesFound.length > 1) {
      return 'mixed';
    }

    // Return the single non-mixed type
    return nonMixedTypesFound[0] as TaskType;
  }

  // If only 'mixed' type exists
  if (uniqueTaskTypes.has('mixed')) {
    return 'mixed';
  }

  // Check for action keywords that might indicate page interaction
  if (ACTION_KEYWORDS.some(keyword => message.includes(keyword))) {
    return 'page-interaction';
  }

  return 'mixed';
}

/**
 * Fallback LLM judgment for ambiguous cases
 * In a real implementation, this would call an LLM API
 */
async function llmFallback(
  message: string,
  agentMatches: string[],
  hasChatTrigger: boolean
): Promise<IntentResult> {
  // In production, this would call an actual LLM with a prompt like:
  // const llmPrompt = `Analyze this user message and determine if it requires browser automation...`
  // For now, we'll use heuristic fallback
  const shouldUseAgent = heuristicLlmFallback(message, agentMatches, hasChatTrigger);

  if (shouldUseAgent) {
    return {
      requiresAgent: true,
      taskType: 'mixed',
      confidence: 'medium',
      reasoning: 'LLM judgment: Message appears to require browser automation',
    };
  }

  return {
    requiresAgent: false,
    taskType: 'chat',
    confidence: 'medium',
    reasoning: 'LLM judgment: Message appears to be a chat query',
  };
}

/**
 * Heuristic fallback when LLM is not available
 */
function heuristicLlmFallback(
  message: string,
  agentMatches: string[],
  hasChatTrigger: boolean
): boolean {
  // If we have agent triggers that are not covered by chat, lean towards agent
  if (agentMatches.length > 0 && !hasChatTrigger) {
    return true;
  }

  // If the message is very short or very long, lean towards chat
  const wordCount = message.split(/\s+/).length;
  if (wordCount < 3 || wordCount > 100) {
    return false;
  }

  // Check for page-related action keywords
  const pageActionKeywords = ['页面', '滚动', '滑动', '点击', '输入', '底部', '顶部'];
  if (pageActionKeywords.some(keyword => message.includes(keyword))) {
    return true;
  }

  // Check for action verbs that suggest browser automation
  const actionVerbs = ['点击', '滚动', '打开', '关闭', '输入', '选择', '截图', '保存', '下载'];
  if (actionVerbs.some(verb => message.includes(verb))) {
    return true;
  }

  // Check for question words - lean towards chat
  const questionWords = ['什么', '为什么', '如何', '怎么', '哪个', '谁', '哪里', '何时'];
  if (questionWords.some(word => message.includes(word))) {
    return false;
  }

  // Default to chat for ambiguous cases without clear indicators
  return false;
}

/**
 * Quick detection function for synchronous checks
 * Returns only high-confidence results, defaults to chat for uncertain cases
 */
export function detectIntentSync(message: string): IntentResult {
  // Check triggers
  const agentMatches = detectAgentTriggers(message);
  const chatMatches = detectChatTriggers(message);

  // Decision logic - check for chat triggers first (they take priority)
  if (chatMatches.length > 0) {
    const hasAgentOverride = hasOverrideAgentTrigger(message, chatMatches);
    if (!hasAgentOverride) {
      return {
        requiresAgent: false,
        taskType: 'chat',
        confidence: 'high',
        reasoning: 'Clear chat query detected',
      };
    }
  }

  if (agentMatches.length > 0) {
    const taskType = determineTaskType(agentMatches, message);
    return {
      requiresAgent: true,
      taskType,
      confidence: 'high',
      reasoning: 'Clear agent task detected',
    };
  }

  // Uncertain cases default to chat
  return {
    requiresAgent: false,
    taskType: 'chat',
    confidence: 'low',
    reasoning: 'Uncertain intent, defaulting to chat mode',
  };
}
