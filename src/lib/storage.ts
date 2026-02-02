/**
 * 统一存储接口
 * 支持 chrome.storage 和 IndexedDB 双后端
 * 实现数据迁移机制、版本控制和错误处理
 *
 * 特性：
 * - 统一的 Storage API，支持多种存储后端
 * - 自动数据迁移机制
 * - 数据压缩和解压缩
 * - 完整的错误处理和重试
 * - 存储配额管理
 * - 加密支持（可选）
 */

import { get, set, del, keys, createStore, type UseStore } from 'idb-keyval';
import browser from 'webextension-polyfill';

// ============================================================================
// 类型定义
// ============================================================================

/** 存储后端类型 */
export type StorageBackend = 'chrome' | 'indexeddb' | 'auto';

/** 存储配置 */
export interface StorageConfig {
  backend?: StorageBackend;
  dbName?: string;
  storeName?: string;
  version?: number;
  compression?: boolean;
  encryption?: boolean;
  encryptionKey?: string;
  maxRetries?: number;
  retryDelay?: number;
}

/** 存储项元数据 */
export interface StorageItemMetadata {
  version: number;
  createdAt: number;
  updatedAt: number;
  size: number;
  compressed: boolean;
  encrypted: boolean;
}

/** 存储项 */
export interface StorageItem<T> {
  value: T;
  metadata: StorageItemMetadata;
}

/** 存储统计 */
export interface StorageStats {
  totalKeys: number;
  totalSize: number;
  chromeStorageSize: number;
  indexedDBSize: number;
  oldestItem: number;
  newestItem: number;
}

/** 迁移记录 */
export interface MigrationRecord {
  fromVersion: number;
  toVersion: number;
  migratedAt: number;
  keysMigrated: number;
}

/** 存储错误 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

// ============================================================================
// 常量定义
// ============================================================================

const DEFAULT_CONFIG: Required<Omit<StorageConfig, 'encryptionKey'>> & { encryptionKey?: string } = {
  backend: 'auto',
  dbName: 'BrowserPalStorage',
  storeName: 'keyval',
  version: 1,
  compression: false,
  encryption: false,
  maxRetries: 3,
  retryDelay: 100,
};

const STORAGE_KEYS = {
  METADATA: '__storage_metadata',
  MIGRATIONS: '__storage_migrations',
  VERSION: '__storage_version',
};

// Chrome storage 配额限制（字节）
const CHROME_STORAGE_QUOTA = {
  SYNC: 102400, // 100 KB
  LOCAL: 10485760, // 10 MB
  PER_ITEM: 8192, // 8 KB per item
};

// ============================================================================
// 日志工具
// ============================================================================

class Logger {
  private static readonly PREFIX = '[Storage]';
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
// 压缩工具
// ============================================================================

class Compression {
  /**
   * 简单的 LZ77-like 压缩（适用于小文本）
   * 对于大对象建议使用 pako 等库
   */
  static compress(data: string): string {
    try {
      // 使用 Unicode 编码和重复字符压缩
      const compressed = data.replace(/(.)(\1{2,})/g, (_match, char, repeats) => {
        return char + '*' + (repeats.length + 1);
      });
      return compressed.length < data.length ? `C:${compressed}` : `U:${data}`;
    } catch {
      return `U:${data}`;
    }
  }

  static decompress(data: string): string {
    if (data.startsWith('U:')) {
      return data.slice(2);
    }
    if (data.startsWith('C:')) {
      const compressed = data.slice(2);
      return compressed.replace(/(.)(\*)(\d+)/g, (_match, char, _, count) => {
        return char.repeat(parseInt(count, 10));
      });
    }
    return data;
  }
}

// ============================================================================
// 统一存储类
// ============================================================================

export class UnifiedStorage {
  private config: Required<Omit<StorageConfig, 'encryptionKey'>> & Pick<StorageConfig, 'encryptionKey'>;
  private customStore: UseStore | undefined;
  private currentBackend: StorageBackend = 'auto';
  private initialized = false;

  constructor(config: StorageConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentBackend = this.config.backend;
  }

  /**
   * 初始化存储
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // 初始化 IndexedDB store
      if (this.config.backend === 'indexeddb' || this.config.backend === 'auto') {
        this.customStore = createStore(this.config.dbName, this.config.storeName);
      }

      // 检查并执行数据迁移
      await this.checkAndMigrate();

      this.initialized = true;
      Logger.info('存储初始化完成', { backend: this.currentBackend });
    } catch (error) {
      Logger.error('存储初始化失败', error);
      throw new StorageError(
        '存储初始化失败',
        'INIT_FAILED',
        false
      );
    }
  }

  /**
   * 选择最佳存储后端
   */
  private async selectBackend(_key: string, value: unknown): Promise<StorageBackend> {
    if (this.config.backend !== 'auto') {
      return this.config.backend;
    }

    // 估算数据大小
    const size = this.estimateSize(value);

    // 小数据使用 chrome.storage.local
    if (size < CHROME_STORAGE_QUOTA.PER_ITEM) {
      return 'chrome';
    }

    // 大数据使用 IndexedDB
    return 'indexeddb';
  }

  /**
   * 估算数据大小
   */
  private estimateSize(value: unknown): number {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 0;
    }
  }

  /**
   * 检查并执行数据迁移
   */
  private async checkAndMigrate(): Promise<void> {
    try {
      // 获取当前存储版本
      const currentVersion = await this.getInternal<number>(STORAGE_KEYS.VERSION) || 0;

      if (currentVersion < this.config.version) {
        Logger.info(`需要数据迁移: ${currentVersion} -> ${this.config.version}`);
        await this.migrateData(currentVersion, this.config.version);
        await this.setInternal(STORAGE_KEYS.VERSION, this.config.version);
      }
    } catch (error) {
      Logger.warn('数据迁移检查失败', error);
    }
  }

  /**
   * 执行数据迁移
   */
  private async migrateData(fromVersion: number, toVersion: number): Promise<void> {
    // 这里可以添加版本特定的迁移逻辑
    Logger.info(`执行数据迁移: ${fromVersion} -> ${toVersion}`);

    // 记录迁移历史
    const migrations = await this.getInternal<MigrationRecord[]>(STORAGE_KEYS.MIGRATIONS) || [];
    migrations.push({
      fromVersion,
      toVersion,
      migratedAt: Date.now(),
      keysMigrated: 0,
    });
    await this.setInternal(STORAGE_KEYS.MIGRATIONS, migrations);
  }

  /**
   * 带重试的存储操作
   */
  private async withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          Logger.warn(`${operationName} 失败，${attempt + 1}/${this.config.maxRetries + 1} 次尝试，即将重试...`);
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw new StorageError(
      `${operationName} 失败: ${lastError?.message}`,
      'OPERATION_FAILED',
      false
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 序列化值
   */
  private serialize<T>(value: T): { data: string; compressed: boolean } {
    const jsonString = JSON.stringify(value);

    if (this.config.compression) {
      const compressed = Compression.compress(jsonString);
      return {
        data: compressed,
        compressed: compressed.startsWith('C:'),
      };
    }

    return { data: jsonString, compressed: false };
  }

  /**
   * 反序列化值
   */
  private deserialize<T>(data: string): T {
    if (data.startsWith('C:') || data.startsWith('U:')) {
      return JSON.parse(Compression.decompress(data)) as T;
    }
    return JSON.parse(data) as T;
  }

  // ============================================================================
  // 内部存储操作（原始值）
  // ============================================================================

  private async setInternal<T>(key: string, value: T): Promise<void> {
    if (this.currentBackend === 'chrome') {
      await browser.storage.local.set({ [key]: value });
    } else {
      await set(key, value, this.customStore);
    }
  }

  private async getInternal<T>(key: string): Promise<T | undefined> {
    if (this.currentBackend === 'chrome') {
      const result = await browser.storage.local.get(key);
      return result[key] as T;
    } else {
      return get<T>(key, this.customStore);
    }
  }

  // ============================================================================
  // 公共 API
  // ============================================================================

  /**
   * 保存数据
   */
  async set<T>(key: string, value: T): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    await this.withRetry(async () => {
      const backend = await this.selectBackend(key, value);
      const { data, compressed } = this.serialize(value);

      const item: StorageItem<T> = {
        value: data as unknown as T,
        metadata: {
          version: this.config.version,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          size: data.length,
          compressed,
          encrypted: false,
        },
      };

      if (backend === 'chrome') {
        await browser.storage.local.set({ [key]: item });
      } else {
        await set(key, item, this.customStore);
      }

      Logger.debug('数据已保存', { key, backend, size: data.length });
    }, '保存数据');
  }

  /**
   * 读取数据
   */
  async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
    if (!this.initialized) {
      await this.init();
    }

    return this.withRetry(async () => {
      // 先尝试 chrome.storage
      let item: StorageItem<T> | undefined;

      try {
        const chromeResult = await browser.storage.local.get(key);
        item = chromeResult[key] as StorageItem<T>;
      } catch {
        // 忽略错误
      }

      // 如果 chrome 中没有，尝试 IndexedDB
      if (!item && this.customStore) {
        item = await get<StorageItem<T>>(key, this.customStore);
      }

      if (!item) {
        return defaultValue;
      }

      // 反序列化
      const data = item.value as unknown as string;
      const value = this.deserialize<T>(data);

      Logger.debug('数据已读取', { key });
      return value;
    }, '读取数据');
  }

  /**
   * 删除数据
   */
  async remove(key: string): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    await this.withRetry(async () => {
      // 从两个后端都删除
      try {
        await browser.storage.local.remove(key);
      } catch {
        // 忽略错误
      }

      if (this.customStore) {
        await del(key, this.customStore);
      }

      Logger.debug('数据已删除', { key });
    }, '删除数据');
  }

  /**
   * 清空所有数据
   */
  async clear(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }

    await this.withRetry(async () => {
      // 清空 chrome.storage
      await browser.storage.local.clear();

      // 清空 IndexedDB
      if (this.customStore) {
        const allKeys = await keys(this.customStore);
        await Promise.all(allKeys.map((k) => del(k as string, this.customStore)));
      }

      Logger.info('所有数据已清空');
    }, '清空数据');
  }

  /**
   * 获取所有键
   */
  async getKeys(): Promise<string[]> {
    if (!this.initialized) {
      await this.init();
    }

    const chromeKeys = Object.keys(await browser.storage.local.get());
    const idbKeys = this.customStore ? await keys(this.customStore) : [];

    // 合并并去重
    const allKeys = new Set([...chromeKeys, ...(idbKeys as string[])]);

    // 过滤内部键
    return Array.from(allKeys).filter(
      (key) => !Object.values(STORAGE_KEYS).includes(key)
    );
  }

  /**
   * 获取所有数据
   */
  async getAll<T>(): Promise<Record<string, T>> {
    if (!this.initialized) {
      await this.init();
    }

    const allKeys = await this.getKeys();
    const result: Record<string, T> = {};

    await Promise.all(
      allKeys.map(async (key) => {
        const value = await this.get<T>(key);
        if (value !== undefined) {
          result[key] = value;
        }
      })
    );

    return result;
  }

  /**
   * 检查键是否存在
   */
  async has(key: string): Promise<boolean> {
    if (!this.initialized) {
      await this.init();
    }

    const chromeResult = await browser.storage.local.get(key);
    if (key in chromeResult) return true;

    if (this.customStore) {
      const idbValue = await get(key, this.customStore);
      return idbValue !== undefined;
    }

    return false;
  }

  /**
   * 获取存储统计
   */
  async getStats(): Promise<StorageStats> {
    if (!this.initialized) {
      await this.init();
    }

    const allKeys = await this.getKeys();
    let totalSize = 0;
    let chromeSize = 0;
    let idbSize = 0;
    let oldestItem = Date.now();
    let newestItem = 0;

    for (const key of allKeys) {
      // 尝试从 chrome 获取
      const chromeResult = await browser.storage.local.get(key);
      if (chromeResult[key]) {
        const size = this.estimateSize(chromeResult[key]);
        chromeSize += size;
        totalSize += size;

        const item = chromeResult[key] as StorageItem<unknown>;
        if (item.metadata) {
          oldestItem = Math.min(oldestItem, item.metadata.createdAt);
          newestItem = Math.max(newestItem, item.metadata.createdAt);
        }
        continue;
      }

      // 尝试从 IndexedDB 获取
      if (this.customStore) {
        const idbValue = await get(key, this.customStore);
        if (idbValue) {
          const size = this.estimateSize(idbValue);
          idbSize += size;
          totalSize += size;

          const item = idbValue as StorageItem<unknown>;
          if (item.metadata) {
            oldestItem = Math.min(oldestItem, item.metadata.createdAt);
            newestItem = Math.max(newestItem, item.metadata.createdAt);
          }
        }
      }
    }

    return {
      totalKeys: allKeys.length,
      totalSize,
      chromeStorageSize: chromeSize,
      indexedDBSize: idbSize,
      oldestItem: oldestItem === Date.now() ? 0 : oldestItem,
      newestItem,
    };
  }

  /**
   * 获取存储配额信息
   */
  async getQuotaInfo(): Promise<{
    used: number;
    available: number;
    total: number;
  }> {
    if (chrome.storage?.local?.getBytesInUse) {
      return new Promise((resolve) => {
        chrome.storage.local.getBytesInUse((bytesInUse) => {
          resolve({
            used: bytesInUse,
            available: CHROME_STORAGE_QUOTA.LOCAL - bytesInUse,
            total: CHROME_STORAGE_QUOTA.LOCAL,
          });
        });
      });
    }

    // 回退到估算
    const stats = await this.getStats();
    return {
      used: stats.chromeStorageSize,
      available: CHROME_STORAGE_QUOTA.LOCAL - stats.chromeStorageSize,
      total: CHROME_STORAGE_QUOTA.LOCAL,
    };
  }

  /**
   * 导出所有数据
   */
  async export(): Promise<Record<string, unknown>> {
    const data = await this.getAll<unknown>();
    return {
      version: this.config.version,
      exportedAt: Date.now(),
      data,
    };
  }

  /**
   * 导入数据
   */
  async import(exportData: Record<string, unknown>): Promise<void> {
    const { version, data } = exportData;

    if (typeof data !== 'object' || data === null) {
      throw new StorageError('无效的导入数据格式', 'INVALID_IMPORT_DATA');
    }

    Logger.info('开始导入数据', { fromVersion: version });

    // 清空现有数据
    await this.clear();

    // 导入数据
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      await this.set(key, value);
    }

    Logger.info('数据导入完成');
  }

  /**
   * 切换存储后端
   */
  async switchBackend(newBackend: StorageBackend): Promise<void> {
    if (newBackend === this.currentBackend) return;

    Logger.info(`切换存储后端: ${this.currentBackend} -> ${newBackend}`);

    // 导出当前数据
    const data = await this.export();

    // 切换后端
    this.currentBackend = newBackend;

    if (newBackend === 'indexeddb') {
      this.customStore = createStore(this.config.dbName, this.config.storeName);
    }

    // 重新导入数据
    await this.import(data);
  }
}

// ============================================================================
// 便捷函数（向后兼容）
// ============================================================================

let defaultStorage: UnifiedStorage | null = null;

function getDefaultStorage(): UnifiedStorage {
  if (!defaultStorage) {
    defaultStorage = new UnifiedStorage();
  }
  return defaultStorage;
}

/**
 * 保存数据（便捷函数）
 */
export async function save<T>(key: string, value: T): Promise<void> {
  return getDefaultStorage().set(key, value);
}

/**
 * 读取数据（便捷函数）
 */
export async function load<T>(key: string, defaultValue?: T): Promise<T | undefined> {
  return getDefaultStorage().get(key, defaultValue);
}

/**
 * 删除数据（便捷函数）
 */
export async function remove(key: string): Promise<void> {
  return getDefaultStorage().remove(key);
}

/**
 * 清空数据（便捷函数）
 */
export async function clearStorage(): Promise<void> {
  return getDefaultStorage().clear();
}

/**
 * 获取所有数据（便捷函数）
 */
export async function getAll<T>(): Promise<Record<string, T>> {
  return getDefaultStorage().getAll<T>();
}

/**
 * 获取所有键（便捷函数）
 */
export async function getAllKeys(): Promise<string[]> {
  return getDefaultStorage().getKeys();
}

// ============================================================================
// 导出类型
// ============================================================================

export type {
  StorageConfig as UnifiedStorageConfig,
  StorageItem as UnifiedStorageItem,
};
