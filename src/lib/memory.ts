/**
 * 本地记忆系统 - 基于 LangChain.js + IndexedDB 的 RAG 记忆管理
 *
 * 特性：
 * - 向量检索实现（基于 MemoryVectorStore）
 * - RAG 上下文注入
 * - 记忆持久化到 IndexedDB
 * - 相似度搜索
 * - 内存管理优化（LRU 淘汰、定期清理）
 * - 支持 Apple Silicon 优化（使用适当的批处理大小）
 * - 完整的错误处理和内存泄漏防护
 */

import { get, set, del, createStore, type UseStore } from 'idb-keyval';
import { Document } from '@langchain/core/documents';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';

// ============================================================================
// 类型定义
// ============================================================================

/** 记忆数据接口 */
export interface Memory {
  id: string;
  content: string;
  metadata: MemoryMetadata;
  embedding?: number[];
}

/** 记忆元数据 */
export interface MemoryMetadata {
  timestamp: number;
  sessionId?: string;
  source?: string;
  type?: 'conversation' | 'fact' | 'preference' | 'context';
  importance?: number; // 0-1，重要性分数
  accessCount?: number;
  lastAccessed?: number;
  [key: string]: unknown;
}

/** 记忆管理器配置 */
export interface MemoryManagerConfig {
  apiKey: string;
  embeddingModel?: string;
  similarityK?: number;
  maxMemories?: number;
  maxMemoryAge?: number; // 毫秒，默认 30 天
  minSimilarityScore?: number; // 最小相似度阈值
  batchSize?: number; // 批处理大小（Apple Silicon 优化）
  dbName?: string;
  storeName?: string;
}

/** 搜索结果接口 */
export interface SearchResult {
  id: string;
  content: string;
  metadata: MemoryMetadata;
  score: number;
}

/** RAG 上下文结果 */
export interface RAGContext {
  context: string;
  memories: SearchResult[];
  totalTokens: number;
}

/** 内存统计 */
export interface MemoryStats {
  totalCount: number;
  totalSize: number;
  oldestMemory: number;
  newestMemory: number;
  averageImportance: number;
}

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_CONFIG: Required<
  Omit<MemoryManagerConfig, 'apiKey' | 'dbName' | 'storeName'>
> = {
  embeddingModel: 'text-embedding-3-small',
  similarityK: 5,
  maxMemories: 500,
  maxMemoryAge: 30 * 24 * 60 * 60 * 1000, // 30 天
  minSimilarityScore: 0.7,
  batchSize: 32, // Apple Silicon 优化的批处理大小
};

const DB_KEYS = {
  MEMORIES: 'memories_v2',
  METADATA: 'memory_metadata',
  INDEX: 'memory_index',
} as const;

// Apple Silicon 检测
const isAppleSilicon = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.includes('mac') && (
    userAgent.includes('arm64') ||
    (typeof navigator.platform === 'string' && navigator.platform.includes('arm'))
  );
};

// ============================================================================
// 日志工具
// ============================================================================

class Logger {
  private static readonly PREFIX = '[MemoryManager]';
  private static enabled = true;

  static setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  static debug(...args: unknown[]): void {
    if (this.enabled) {
      console.debug(this.PREFIX, ...args);
    }
  }

  static info(...args: unknown[]): void {
    if (this.enabled) {
      console.info(this.PREFIX, ...args);
    }
  }

  static warn(...args: unknown[]): void {
    if (this.enabled) {
      console.warn(this.PREFIX, ...args);
    }
  }

  static error(...args: unknown[]): void {
    if (this.enabled) {
      console.error(this.PREFIX, ...args);
    }
  }
}

// ============================================================================
// 本地记忆管理器
// ============================================================================

export class LocalMemoryManager {
  private config: Required<MemoryManagerConfig>;
  private vectorStore: MemoryVectorStore | null = null;
  private embeddings: OpenAIEmbeddings | null = null;
  private initialized = false;
  private memoryCache: Map<string, Memory> = new Map();
  private customStore: UseStore | undefined;
  private initPromise: Promise<boolean> | null = null;
  private lastCleanupTime = 0;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 分钟

  constructor(config: MemoryManagerConfig) {
    if (!config.apiKey) {
      throw new Error('API Key 是必需的');
    }

    // Apple Silicon 优化：调整批处理大小
    const appleSiliconBatchSize = isAppleSilicon() ? 16 : 32;

    this.config = {
      ...DEFAULT_CONFIG,
      batchSize: appleSiliconBatchSize,
      ...config,
      dbName: config.dbName || 'BrowserPalMemory',
      storeName: config.storeName || 'memories',
    };

    Logger.info('初始化记忆管理器', {
      embeddingModel: this.config.embeddingModel,
      batchSize: this.config.batchSize,
      isAppleSilicon: isAppleSilicon(),
    });
  }

  /**
   * 初始化 - 从 IndexedDB 加载历史记忆
   * 使用单例模式防止重复初始化
   */
  async init(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    // 防止并发初始化
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<boolean> {
    try {
      // 创建自定义 IndexedDB store
      this.customStore = createStore(this.config.dbName, this.config.storeName);

      // 初始化 Embedding 模型
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: this.config.apiKey,
        modelName: this.config.embeddingModel,
        batchSize: this.config.batchSize,
      });

      // 初始化向量存储
      this.vectorStore = new MemoryVectorStore(this.embeddings);

      // 从 IndexedDB 加载记忆
      await this.loadMemoriesFromDB();

      this.initialized = true;
      Logger.info('记忆管理器初始化完成', {
        memoryCount: this.memoryCache.size,
      });

      return true;
    } catch (error) {
      Logger.error('初始化失败', error);
      this.initialized = false;
      return false;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * 从 IndexedDB 加载记忆
   */
  private async loadMemoriesFromDB(): Promise<void> {
    try {
      const storedMemories = await get<Memory[]>(DB_KEYS.MEMORIES, this.customStore);

      if (!storedMemories || storedMemories.length === 0) {
        Logger.debug('没有存储的记忆需要加载');
        return;
      }

      // 过滤过期记忆
      const now = Date.now();
      const validMemories = storedMemories.filter((memory) => {
        const age = now - memory.metadata.timestamp;
        return age < this.config.maxMemoryAge;
      });

      if (validMemories.length < storedMemories.length) {
        Logger.info(`过滤了 ${storedMemories.length - validMemories.length} 条过期记忆`);
      }

      // 批量添加到向量存储（Apple Silicon 优化）
      await this.batchAddToVectorStore(validMemories);

      // 更新缓存
      for (const memory of validMemories) {
        this.memoryCache.set(memory.id, memory);
      }

      Logger.info(`已加载 ${validMemories.length} 条记忆`);
    } catch (error) {
      Logger.error('从 IndexedDB 加载记忆失败', error);
      throw error;
    }
  }

  /**
   * 批量添加到向量存储
   */
  private async batchAddToVectorStore(memories: Memory[]): Promise<void> {
    if (!this.vectorStore || memories.length === 0) return;

    const batchSize = this.config.batchSize;

    for (let i = 0; i < memories.length; i += batchSize) {
      const batch = memories.slice(i, i + batchSize);
      const documents = batch.map((m) => this.memoryToDocument(m));

      try {
        await this.vectorStore.addDocuments(documents);
      } catch (error) {
        Logger.error(`批量添加记忆失败 (批次 ${i / batchSize + 1})`, error);
        throw error;
      }

      // 给事件循环喘息的机会（防止阻塞 UI）
      if (i + batchSize < memories.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.vectorStore) {
      throw new Error('MemoryManager 尚未初始化，请先调用 init()');
    }
  }

  /**
   * 添加记忆
   */
  async addMemory(
    text: string,
    metadata: Partial<MemoryMetadata> = {}
  ): Promise<Memory> {
    this.ensureInitialized();

    // 检查是否需要清理
    await this.maybeCleanup();

    // 创建记忆对象
    const memory: Memory = {
      id: crypto.randomUUID(),
      content: text,
      metadata: {
        timestamp: Date.now(),
        type: 'conversation',
        importance: 0.5,
        accessCount: 0,
        lastAccessed: Date.now(),
        ...metadata,
      },
    };

    // 添加到向量存储
    const document = this.memoryToDocument(memory);
    await this.vectorStore!.addDocuments([document]);

    // 更新缓存
    this.memoryCache.set(memory.id, memory);

    // 异步持久化到 IndexedDB
    await this.persistMemories();

    Logger.debug('添加记忆成功', { id: memory.id, contentLength: text.length });

    return memory;
  }

  /**
   * 批量添加记忆
   */
  async addMemories(
    items: Array<{ text: string; metadata?: Partial<MemoryMetadata> }>
  ): Promise<Memory[]> {
    this.ensureInitialized();

    const memories: Memory[] = items.map((item) => ({
      id: crypto.randomUUID(),
      content: item.text,
      metadata: {
        timestamp: Date.now(),
        type: 'conversation',
        importance: 0.5,
        accessCount: 0,
        lastAccessed: Date.now(),
        ...item.metadata,
      },
    }));

    // 批量添加到向量存储
    await this.batchAddToVectorStore(memories);

    // 更新缓存
    for (const memory of memories) {
      this.memoryCache.set(memory.id, memory);
    }

    // 持久化
    await this.persistMemories();

    Logger.info(`批量添加 ${memories.length} 条记忆`);

    return memories;
  }

  /**
   * RAG 上下文检索 - 获取格式化的上下文字符串
   */
  async getRAGContext(query: string, maxTokens: number = 2000): Promise<RAGContext> {
    this.ensureInitialized();

    const results = await this.searchMemories(query, this.config.similarityK * 2);

    // 过滤低相似度结果
    const filteredResults = results.filter(
      (r) => r.score >= this.config.minSimilarityScore
    );

    if (filteredResults.length === 0) {
      return { context: '', memories: [], totalTokens: 0 };
    }

    // 按重要性排序
    const sortedResults = filteredResults.sort((a, b) => {
      const importanceDiff = (b.metadata.importance || 0.5) - (a.metadata.importance || 0.5);
      if (importanceDiff !== 0) return importanceDiff;
      return b.score - a.score;
    });

    // 构建上下文（简单的 token 估算：1 token ≈ 4 字符）
    const contextParts: string[] = [];
    let currentTokens = 0;
    const selectedMemories: SearchResult[] = [];

    for (const result of sortedResults) {
      const estimatedTokens = Math.ceil(result.content.length / 4);

      if (currentTokens + estimatedTokens > maxTokens) {
        break;
      }

      contextParts.push(`[${selectedMemories.length + 1}] ${result.content}`);
      selectedMemories.push(result);
      currentTokens += estimatedTokens;

      // 更新访问统计
      this.updateAccessStats(result.id);
    }

    return {
      context: contextParts.join('\n\n'),
      memories: selectedMemories,
      totalTokens: currentTokens,
    };
  }

  /**
   * 搜索相关记忆
   */
  async searchMemories(query: string, k?: number): Promise<SearchResult[]> {
    this.ensureInitialized();

    const topK = k || this.config.similarityK;

    const results = await this.vectorStore!.similaritySearchWithScore(query, topK);

    return results.map(([doc, score]) => {
      const memory = this.extractMemoryFromDocument(doc);
      return {
        id: memory.id,
        content: memory.content,
        metadata: memory.metadata,
        score,
      };
    });
  }

  /**
   * 检索相关记忆（返回格式化字符串）
   */
  async searchRelevantContext(query: string, k?: number): Promise<string> {
    const results = await this.searchMemories(query, k);

    if (results.length === 0) {
      return '';
    }

    return results
      .map(
        (result, index) =>
          `[${index + 1}] (相似度: ${(result.score * 100).toFixed(1)}%)\n${result.content}`
      )
      .join('\n\n');
  }

  /**
   * 获取所有记忆
   */
  async getAllMemories(): Promise<Memory[]> {
    const memories = Array.from(this.memoryCache.values());
    return memories.sort((a, b) => b.metadata.timestamp - a.metadata.timestamp);
  }

  /**
   * 根据 ID 获取记忆
   */
  async getMemory(id: string): Promise<Memory | null> {
    const memory = this.memoryCache.get(id);
    if (memory) {
      this.updateAccessStats(id);
    }
    return memory || null;
  }

  /**
   * 获取记忆数量
   */
  async getMemoryCount(): Promise<number> {
    return this.memoryCache.size;
  }

  /**
   * 获取内存统计
   */
  async getStats(): Promise<MemoryStats> {
    const memories = Array.from(this.memoryCache.values());

    if (memories.length === 0) {
      return {
        totalCount: 0,
        totalSize: 0,
        oldestMemory: 0,
        newestMemory: 0,
        averageImportance: 0,
      };
    }

    const timestamps = memories.map((m) => m.metadata.timestamp);
    const importances = memories.map((m) => m.metadata.importance || 0.5);

    // 估算总大小（JSON 序列化后的字符数）
    const totalSize = memories.reduce((sum, m) => {
      return sum + JSON.stringify(m).length;
    }, 0);

    return {
      totalCount: memories.length,
      totalSize,
      oldestMemory: Math.min(...timestamps),
      newestMemory: Math.max(...timestamps),
      averageImportance: importances.reduce((a, b) => a + b, 0) / importances.length,
    };
  }

  /**
   * 删除指定记忆
   */
  async deleteMemory(id: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // 从缓存中移除
      this.memoryCache.delete(id);

      // 重建向量存储
      await this.rebuildVectorStore();

      // 持久化
      await this.persistMemories();

      Logger.info('删除记忆成功', { id });
      return true;
    } catch (error) {
      Logger.error('删除记忆失败', error);
      return false;
    }
  }

  /**
   * 清空所有记忆
   */
  async clear(): Promise<boolean> {
    try {
      // 清空内存中的向量存储
      if (this.embeddings) {
        this.vectorStore = new MemoryVectorStore(this.embeddings);
      }

      // 清空缓存
      this.memoryCache.clear();

      // 清空 IndexedDB
      await del(DB_KEYS.MEMORIES, this.customStore);
      await del(DB_KEYS.METADATA, this.customStore);

      Logger.info('已清空所有记忆');
      return true;
    } catch (error) {
      Logger.error('清空记忆失败', error);
      return false;
    }
  }

  /**
   * 更新记忆重要性
   */
  async updateImportance(id: string, importance: number): Promise<boolean> {
    const memory = this.memoryCache.get(id);
    if (!memory) return false;

    memory.metadata.importance = Math.max(0, Math.min(1, importance));
    await this.persistMemories();

    return true;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 销毁管理器，释放资源
   */
  destroy(): void {
    this.vectorStore = null;
    this.embeddings = null;
    this.memoryCache.clear();
    this.initialized = false;
    Logger.info('记忆管理器已销毁');
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 将 Memory 转换为 LangChain Document
   */
  private memoryToDocument(memory: Memory): Document {
    return new Document({
      pageContent: memory.content,
      metadata: {
        id: memory.id,
        content: memory.content,
        timestamp: memory.metadata.timestamp,
        sessionId: memory.metadata.sessionId,
        type: memory.metadata.type,
        importance: memory.metadata.importance,
        accessCount: memory.metadata.accessCount,
        lastAccessed: memory.metadata.lastAccessed,
      },
    });
  }

  /**
   * 从 Document 提取 Memory
   */
  private extractMemoryFromDocument(doc: Document): Memory {
    const metadata = doc.metadata as Memory['metadata'] & { id: string; content: string };
    return {
      id: metadata.id,
      content: metadata.content,
      metadata: {
        timestamp: metadata.timestamp,
        sessionId: metadata.sessionId,
        source: metadata.source,
        type: metadata.type,
        importance: metadata.importance,
        accessCount: metadata.accessCount,
        lastAccessed: metadata.lastAccessed,
      },
    };
  }

  /**
   * 持久化记忆到 IndexedDB
   */
  private async persistMemories(): Promise<void> {
    try {
      const memories = Array.from(this.memoryCache.values());
      await set(DB_KEYS.MEMORIES, memories, this.customStore);
    } catch (error) {
      Logger.error('持久化记忆失败', error);
      throw error;
    }
  }

  /**
   * 重建向量存储
   */
  private async rebuildVectorStore(): Promise<void> {
    if (!this.embeddings) return;

    this.vectorStore = new MemoryVectorStore(this.embeddings);

    const memories = Array.from(this.memoryCache.values());
    if (memories.length > 0) {
      await this.batchAddToVectorStore(memories);
    }
  }

  /**
   * 更新访问统计
   */
  private updateAccessStats(id: string): void {
    const memory = this.memoryCache.get(id);
    if (memory) {
      memory.metadata.accessCount = (memory.metadata.accessCount || 0) + 1;
      memory.metadata.lastAccessed = Date.now();
    }
  }

  /**
   * 检查并执行清理
   */
  private async maybeCleanup(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupTime < this.CLEANUP_INTERVAL) {
      return;
    }

    this.lastCleanupTime = now;
    await this.cleanup();
  }

  /**
   * 清理过期和低重要性记忆
   */
  private async cleanup(): Promise<void> {
    const now = Date.now();
    const memories = Array.from(this.memoryCache.entries());
    let removedCount = 0;

    for (const [id, memory] of memories) {
      const age = now - memory.metadata.timestamp;
      const isExpired = age > this.config.maxMemoryAge;
      const isLowImportance = (memory.metadata.importance || 0.5) < 0.2;
      const isUnused = (memory.metadata.accessCount || 0) < 2 && age > 7 * 24 * 60 * 60 * 1000; // 7 天

      if (isExpired || (isLowImportance && isUnused)) {
        this.memoryCache.delete(id);
        removedCount++;
      }
    }

    // 如果超过最大记忆数，移除最旧的
    if (this.memoryCache.size > this.config.maxMemories) {
      const sortedMemories = Array.from(this.memoryCache.entries()).sort(
        (a, b) => a[1].metadata.timestamp - b[1].metadata.timestamp
      );

      const toRemove = sortedMemories.slice(0, this.memoryCache.size - this.config.maxMemories);
      for (const [id] of toRemove) {
        this.memoryCache.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      Logger.info(`清理完成，移除了 ${removedCount} 条记忆`);
      await this.rebuildVectorStore();
      await this.persistMemories();
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/**
 * 创建记忆管理器实例
 */
export function createMemoryManager(config: MemoryManagerConfig): LocalMemoryManager {
  return new LocalMemoryManager(config);
}

/**
 * 简单的记忆添加函数
 */
export async function addMemory(
  text: string,
  apiKey: string,
  metadata?: Partial<MemoryMetadata>
): Promise<Memory> {
  const manager = new LocalMemoryManager({ apiKey });
  await manager.init();
  return manager.addMemory(text, metadata);
}

/**
 * 简单的记忆搜索函数
 */
export async function searchMemories(
  query: string,
  apiKey: string,
  k?: number
): Promise<SearchResult[]> {
  const manager = new LocalMemoryManager({ apiKey });
  await manager.init();
  return manager.searchMemories(query, k);
}

/**
 * 获取 RAG 上下文
 */
export async function getRAGContext(
  query: string,
  apiKey: string,
  maxTokens?: number
): Promise<RAGContext> {
  const manager = new LocalMemoryManager({ apiKey });
  await manager.init();
  return manager.getRAGContext(query, maxTokens);
}

// ============================================================================
// 导出类型
// ============================================================================

export type {
  MemoryManagerConfig as LocalMemoryManagerConfig,
  Memory as LocalMemory,
};
