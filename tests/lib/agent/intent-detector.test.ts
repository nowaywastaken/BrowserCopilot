/**
 * Tests for Intent Detector
 */

import { describe, it, expect } from 'vitest';
import {
  detectIntent,
  detectIntentSync,
} from '../../../src/lib/agent/intent-detector';

describe('IntentDetector', () => {
  describe('detectIntentSync', () => {
    describe('screenshot request detection', () => {
      it('should detect Chinese screenshot request', async () => {
        const result = detectIntentSync('给我截个屏看看');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('screenshot');
        expect(result.confidence).toBe('high');
      });

      it('should detect Chinese 截图 request', async () => {
        const result = detectIntentSync('请帮我截图当前页面');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('screenshot');
        expect(result.confidence).toBe('high');
      });

      it('should detect English screenshot request', async () => {
        const result = detectIntentSync('take a screenshot of the page');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('screenshot');
        expect(result.confidence).toBe('high');
      });

      it('should detect capture keyword', async () => {
        const result = detectIntentSync('capture the current screen');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('screenshot');
        expect(result.confidence).toBe('high');
      });
    });

    describe('script request detection', () => {
      it('should detect Chinese script request', async () => {
        const result = detectIntentSync('帮我写一个脚本');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('script');
        expect(result.confidence).toBe('high');
      });

      it('should detect userscript keyword', async () => {
        const result = detectIntentSync('I need a userscript for this page');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('script');
        expect(result.confidence).toBe('high');
      });

      it('should detect tampermonkey keyword', async () => {
        const result = detectIntentSync('create a tampermonkey script');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('script');
        expect(result.confidence).toBe('high');
      });
    });

    describe('page interaction detection', () => {
      it('should detect click request', async () => {
        const result = detectIntentSync('帮我点击这个按钮');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('page-interaction');
        expect(result.confidence).toBe('high');
      });

      it('should detect auto-click request', async () => {
        const result = detectIntentSync('自动点击所有链接');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('page-interaction');
        expect(result.confidence).toBe('high');
      });

      it('should detect auto-operation request', async () => {
        const result = detectIntentSync('帮我自动操作这个页面');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('page-interaction');
        expect(result.confidence).toBe('high');
      });
    });

    describe('chat-only question detection', () => {
      it('should detect 是什么 question', async () => {
        const result = detectIntentSync('这是什么网站？');
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('high');
      });

      it('should detect 解释一下 question', async () => {
        const result = detectIntentSync('请解释一下这个功能是什么');
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('high');
      });

      it('should detect 什么意思 question', async () => {
        const result = detectIntentSync('这个术语什么意思？');
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('high');
      });

      it('should detect 帮我理解 question', async () => {
        const result = detectIntentSync('帮我理解这个概念');
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('high');
      });

      it('should detect 原理 question', async () => {
        const result = detectIntentSync('这个工作的原理是什么？');
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('high');
      });
    });

    describe('mixed intent handling', () => {
      it('should detect mixed agent tasks', async () => {
        const result = detectIntentSync('截图并帮我点击所有按钮');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('mixed');
        expect(result.confidence).toBe('high');
      });

      it('should detect DOM analysis request', async () => {
        const result = detectIntentSync('获取页面元素信息');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('dom');
        expect(result.confidence).toBe('high');
      });

      it('should detect page analysis request', async () => {
        const result = detectIntentSync('分析当前页面结构');
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('dom');
        expect(result.confidence).toBe('high');
      });
    });

    describe('ambiguous cases (sync defaults to chat)', () => {
      it('should default to chat for ambiguous messages without clear triggers', async () => {
        const result = detectIntentSync('你好');
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('low');
      });

      it('should default to chat for very short messages', async () => {
        const result = detectIntentSync('hi');
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('low');
      });
    });
  });

  describe('detectIntent (async with LLM fallback)', () => {
    describe('screenshot request detection', () => {
      it('should detect screenshot request with high confidence', async () => {
        const result = await detectIntent('截屏当前页面看看', false);
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('screenshot');
        expect(result.confidence).toBe('high');
      });
    });

    describe('script request detection', () => {
      it('should detect script request with high confidence', async () => {
        const result = await detectIntent('写一个脚本自动填表', false);
        expect(result.requiresAgent).toBe(true);
        expect(result.taskType).toBe('script');
        expect(result.confidence).toBe('high');
      });
    });

    describe('chat-only detection', () => {
      it('should detect chat-only query with high confidence', async () => {
        const result = await detectIntent('什么是JavaScript？', false);
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('high');
      });

      it('should detect explanation request', async () => {
        const result = await detectIntent('请解释一下闭包是什么', false);
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
        expect(result.confidence).toBe('high');
      });
    });

    describe('LLM fallback behavior', () => {
      it('should use LLM fallback when disabled and return agent for ambiguous case', async () => {
        const result = await detectIntent('打开这个页面', false);
        expect(result.requiresAgent).toBe(true);
        expect(result.confidence).toBe('low');
      });

      it('should use heuristic fallback for action verbs', async () => {
        const result = await detectIntent('滚动到页面底部', false);
        expect(result.requiresAgent).toBe(true);
        expect(result.confidence).toBe('high');
      });

      it('should default to chat for question-like messages', async () => {
        const result = await detectIntent('为什么这个页面加载很慢？', false);
        expect(result.requiresAgent).toBe(false);
        expect(result.taskType).toBe('chat');
      });
    });

    describe('reasoning field', () => {
      it('should include reasoning for high confidence results', async () => {
        const result = await detectIntent('截图', false);
        expect(result.reasoning).toBeDefined();
        expect(result.reasoning).toContain('trigger');
      });

      it('should include reasoning for chat-only results', async () => {
        const result = await detectIntent('这是什么？', false);
        expect(result.reasoning).toBeDefined();
        expect(result.reasoning).toContain('chat');
      });
    });
  });

  describe('Task Type Determination', () => {
    it('should correctly identify screenshot task type', () => {
      const result = detectIntentSync('请截图');
      expect(result.taskType).toBe('screenshot');
    });

    it('should correctly identify script task type', () => {
      const result = detectIntentSync('写个脚本');
      expect(result.taskType).toBe('script');
    });

    it('should correctly identify page-interaction task type', () => {
      const result = detectIntentSync('点击按钮');
      expect(result.taskType).toBe('page-interaction');
    });

    it('should correctly identify dom task type', () => {
      const result = detectIntentSync('查看DOM结构');
      expect(result.taskType).toBe('dom');
    });

    it('should return mixed for multiple task types', () => {
      const result = detectIntentSync('截图并点击按钮');
      expect(result.taskType).toBe('mixed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', async () => {
      const result = detectIntentSync('');
      expect(result.requiresAgent).toBe(false);
      expect(result.taskType).toBe('chat');
    });

    it('should handle whitespace only', async () => {
      const result = detectIntentSync('   ');
      expect(result.requiresAgent).toBe(false);
      expect(result.taskType).toBe('chat');
    });

    it('should handle case insensitive matching', async () => {
      const result = detectIntentSync('SCREENSHOT the page');
      expect(result.requiresAgent).toBe(true);
      expect(result.taskType).toBe('screenshot');
    });

    it('should handle mixed case Chinese', async () => {
      const result = detectIntentSync('请帮我截图');
      expect(result.requiresAgent).toBe(true);
      expect(result.taskType).toBe('screenshot');
    });

    it('should handle long messages with chat triggers', async () =>
    {
      const longMessage = '请帮我理解一下什么是闭包（Closure），这是一个非常重要的JavaScript概念，它允许函数访问其外部作用域的变量。我不太理解这个概念，请详细解释一下。';
      const result = detectIntentSync(longMessage);
      expect(result.requiresAgent).toBe(false);
      expect(result.taskType).toBe('chat');
    });
  });

  describe('Help/action patterns', () => {
    it('should detect 帮我做 pattern', () => {
      const result = detectIntentSync('帮我做这个操作');
      expect(result.requiresAgent).toBe(true);
      expect(result.taskType).toBe('mixed');
    });

    it('should detect 帮我处理 pattern', () => {
      const result = detectIntentSync('帮我处理这个表单');
      expect(result.requiresAgent).toBe(true);
      expect(result.taskType).toBe('mixed');
    });

    it('should detect 帮我 pattern with action context', () => {
      const result = detectIntentSync('帮我打开这个链接');
      expect(result.requiresAgent).toBe(true);
    });
  });
});
