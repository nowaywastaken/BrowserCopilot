/**
 * Browser Pal - Service Worker (Manifest V3)
 * 核心后台脚本，处理扩展生命周期、全局快捷键和与侧边栏的通信
 *
 * 架构设计：
 * - 使用 Chrome Extension Manifest V3 Service Worker
 * - 支持全局快捷键 (Cmd/Ctrl+Shift+L) 触发侧边栏
 * - 通过 chrome.runtime.onMessage 与 sidepanel 通信
 * - 使用回调嵌套处理异步操作，确保错误被捕获
 */

import browser from 'webextension-polyfill';

// ============================================================================
// 类型定义
// ============================================================================

/** 侧边栏状态 */
interface SidePanelState {
  isOpen: boolean;
  lastActiveTabId: number | null;
  lastOpenTime: number;
}

/** 消息类型 */
type MessageType =
  | 'PING'
  | 'GET_STATE'
  | 'SET_STATE'
  | 'OPEN_SIDEPANEL'
  | 'CLOSE_SIDEPANEL'
  | 'TOGGLE_SIDEPANEL'
  | 'NOTIFY'
  | 'LOG';

/** 扩展消息接口 */
interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}

/** 扩展消息响应接口 */
interface ExtensionMessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/** 日志级别 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ============================================================================
// 常量定义
// ============================================================================

const STORAGE_KEYS = {
  STATE: 'bp_state',
  SETTINGS: 'bp_settings',
  API_KEY: 'bp_api_key',
} as const;

const DEFAULT_STATE: SidePanelState = {
  isOpen: false,
  lastActiveTabId: null,
  lastOpenTime: 0,
};

// ============================================================================
// 日志系统
// ============================================================================

class Logger {
  private static readonly PREFIX = '[Browser Pal]';
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private static currentLevel: LogLevel = 'info';

  static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private static shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] >= this.LOG_LEVELS[this.currentLevel];
  }

  private static formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `${this.PREFIX} [${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  static debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  static info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  static warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  static error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }
}

// ============================================================================
// 状态管理
// ============================================================================

class StateManager {
  private state: SidePanelState = { ...DEFAULT_STATE };
  private listeners: Set<(state: SidePanelState) => void> = new Set();

  async init(): Promise<void> {
    try {
      const result = await browser.storage.local.get(STORAGE_KEYS.STATE);
      if (result[STORAGE_KEYS.STATE]) {
        this.state = { ...DEFAULT_STATE, ...result[STORAGE_KEYS.STATE] };
      }
      Logger.info('状态管理器初始化完成', this.state);
    } catch (error) {
      Logger.error('状态管理器初始化失败', error);
      throw error;
    }
  }

  getState(): SidePanelState {
    return { ...this.state };
  }

  async setState(updates: Partial<SidePanelState>): Promise<void> {
    this.state = { ...this.state, ...updates };
    await browser.storage.local.set({ [STORAGE_KEYS.STATE]: this.state });
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getState());
      } catch (error) {
        Logger.error('状态监听器执行失败', error);
      }
    });
  }

  subscribe(listener: (state: SidePanelState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const stateManager = new StateManager();

// ============================================================================
// 侧边栏管理
// ============================================================================

class SidePanelManager {
  private openingTabs: Set<number> = new Set();

  /**
   * 获取当前活动标签页
   */
  private async getCurrentTab(): Promise<browser.Tabs.Tab | null> {
    try {
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      return tabs[0] || null;
    } catch (error) {
      Logger.error('获取当前标签页失败', error);
      return null;
    }
  }

  /**
   * 打开侧边栏
   * 使用回调嵌套处理异步调用，确保错误被捕获
   */
  async open(): Promise<boolean> {
    const tab = await this.getCurrentTab();
    if (!tab?.id) {
      Logger.warn('无法获取当前标签页，无法打开侧边栏');
      return false;
    }

    const tabId = tab.id;

    // 防止重复打开
    if (this.openingTabs.has(tabId)) {
      Logger.debug('侧边栏正在打开中，跳过重复请求');
      return true;
    }

    this.openingTabs.add(tabId);

    try {
      // 使用回调嵌套处理 chrome.sidePanel.open
      await new Promise<void>((resolve, reject) => {
        chrome.sidePanel.open({ tabId }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });

      await stateManager.setState({
        isOpen: true,
        lastActiveTabId: tabId,
        lastOpenTime: Date.now(),
      });

      Logger.info('侧边栏已打开', { tabId });
      return true;
    } catch (error) {
      Logger.error('打开侧边栏失败', error);
      return false;
    } finally {
      this.openingTabs.delete(tabId);
    }
  }

  /**
   * 关闭侧边栏
   */
  async close(): Promise<boolean> {
    const tab = await this.getCurrentTab();
    if (!tab?.id) {
      Logger.warn('无法获取当前标签页，无法关闭侧边栏');
      return false;
    }

    try {
      // Chrome API 限制：sidePanel.close 需要用户手势
      // 我们通过设置状态来标记关闭意图
      await stateManager.setState({
        isOpen: false,
        lastActiveTabId: null,
      });

      // 通知侧边栏关闭
      await this.notifySidePanel('CLOSE_REQUEST');

      Logger.info('侧边栏关闭请求已发送');
      return true;
    } catch (error) {
      Logger.error('关闭侧边栏失败', error);
      return false;
    }
  }

  /**
   * 切换侧边栏状态
   */
  async toggle(): Promise<boolean> {
    const state = stateManager.getState();
    return state.isOpen ? this.close() : this.open();
  }

  /**
   * 通知侧边栏
   */
  private async notifySidePanel(
    action: string,
    data?: unknown
  ): Promise<void> {
    try {
      await browser.runtime.sendMessage({
        type: 'SIDEPANEL_ACTION',
        action,
        data,
      });
    } catch (error) {
      // 侧边栏可能未打开，忽略错误
      Logger.debug('通知侧边栏失败（可能未打开）', error);
    }
  }
}

const sidePanelManager = new SidePanelManager();

// ============================================================================
// 消息处理器
// ============================================================================

class MessageHandler {
  /**
   * 处理来自内容脚本或侧边栏的消息
   */
  async handleMessage(
    message: ExtensionMessage,
    sender: browser.Runtime.MessageSender
  ): Promise<ExtensionMessageResponse> {
    Logger.debug('收到消息', { type: message.type, sender: sender.id });

    try {
      switch (message.type) {
        case 'PING':
          return { success: true, data: { pong: true, timestamp: Date.now() } };

        case 'GET_STATE':
          return { success: true, data: stateManager.getState() };

        case 'SET_STATE':
          if (message.payload && typeof message.payload === 'object') {
            await stateManager.setState(message.payload as Partial<SidePanelState>);
            return { success: true, data: stateManager.getState() };
          }
          return { success: false, error: '无效的状态数据' };

        case 'OPEN_SIDEPANEL':
          const openResult = await sidePanelManager.open();
          return { success: openResult };

        case 'CLOSE_SIDEPANEL':
          const closeResult = await sidePanelManager.close();
          return { success: closeResult };

        case 'TOGGLE_SIDEPANEL':
          const toggleResult = await sidePanelManager.toggle();
          return { success: toggleResult };

        case 'NOTIFY':
          await this.handleNotification(message.payload);
          return { success: true };

        case 'LOG':
          this.handleLog(message.payload);
          return { success: true };

        default:
          return { success: false, error: `未知消息类型: ${message.type}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      Logger.error('消息处理失败', { type: message.type, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 处理通知消息
   */
  private async handleNotification(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== 'object') return;

    const { title, message } = payload as {
      title?: string;
      message?: string;
      type?: 'info' | 'warning' | 'error';
    };

    if (!title || !message) return;

    try {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.svg',
        title,
        message,
      });
    } catch (error) {
      Logger.error('创建通知失败', error);
    }
  }

  /**
   * 处理日志消息
   */
  private handleLog(payload: unknown): void {
    if (!payload || typeof payload !== 'object') return;

    const { level, message, data } = payload as {
      level?: LogLevel;
      message?: string;
      data?: unknown;
    };

    if (!message) return;

    switch (level) {
      case 'debug':
        Logger.debug(message, data);
        break;
      case 'warn':
        Logger.warn(message, data);
        break;
      case 'error':
        Logger.error(message, data);
        break;
      default:
        Logger.info(message, data);
    }
  }
}

const messageHandler = new MessageHandler();

// ============================================================================
// 生命周期管理
// ============================================================================

/**
 * 扩展安装时初始化
 */
browser.runtime.onInstalled.addListener((details) => {
  Logger.info('Browser Pal 扩展已安装', { reason: details.reason });

  // 初始化状态
  stateManager.init().catch((error) => {
    Logger.error('初始化状态失败', error);
  });

  // 设置侧边栏行为：点击扩展图标时打开侧边栏
  chrome.sidePanel.setPanelBehavior(
    { openPanelOnActionClick: true },
    () => {
      if (chrome.runtime.lastError) {
        Logger.error('设置侧边栏行为失败', chrome.runtime.lastError);
      } else {
        Logger.info('侧边栏行为设置成功');
      }
    }
  );

  // 根据安装原因执行不同操作
  if (details.reason === 'install') {
    // 首次安装，打开欢迎页面
    browser.tabs.create({
      url: browser.runtime.getURL('welcome.html'),
    }).catch((error) => {
      Logger.error('打开欢迎页面失败', error);
    });
  } else if (details.reason === 'update') {
    Logger.info('扩展已更新', { previousVersion: details.previousVersion });
  }
});

/**
 * 扩展启动时（浏览器启动或扩展重新加载）
 */
browser.runtime.onStartup.addListener(() => {
  Logger.info('Browser Pal 扩展已启动');

  // 重新初始化状态
  stateManager.init().catch((error) => {
    Logger.error('启动时初始化状态失败', error);
  });

  // 确保侧边栏行为设置在启动时也生效
  chrome.sidePanel.setPanelBehavior(
    { openPanelOnActionClick: true },
    () => {
      if (chrome.runtime.lastError) {
        Logger.error('启动时设置侧边栏行为失败', chrome.runtime.lastError);
      }
    }
  );
});

// ============================================================================
// 快捷键监听
// ============================================================================

/**
 * 监听快捷键命令
 * manifest.json 中定义的命令：
 * - _execute_action: 默认打开侧边栏（由 Chrome 处理）
 * - toggle_sidebar: 自定义切换命令
 */
browser.commands.onCommand.addListener(async (command) => {
  Logger.info('收到快捷键命令', { command });

  if (command === 'toggle_sidebar') {
    const result = await sidePanelManager.toggle();
    Logger.info('切换侧边栏结果', { result });
  }
});

// ============================================================================
// 消息监听
// ============================================================================

/**
 * 监听来自内容脚本、侧边栏或弹出窗口的消息
 */
browser.runtime.onMessage.addListener((
  message: ExtensionMessage,
  sender: browser.Runtime.MessageSender,
  sendResponse: (response: ExtensionMessageResponse) => void
) => {
  // 使用 Promise 处理异步消息
  messageHandler
    .handleMessage(message, sender)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error) => {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      Logger.error('消息处理异常', error);
      sendResponse({ success: false, error: errorMessage });
    });

  // 返回 true 表示将异步发送响应
  return true;
});

// ============================================================================
// 标签页事件监听
// ============================================================================

/**
 * 监听标签页切换，更新状态
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
  Logger.debug('标签页切换', { tabId: activeInfo.tabId });

  const state = stateManager.getState();
  if (state.isOpen && state.lastActiveTabId !== activeInfo.tabId) {
    // 如果侧边栏是打开的，但切换到了不同标签页
    // 在新标签页重新打开侧边栏
    try {
      await chrome.sidePanel.open({ tabId: activeInfo.tabId });
      await stateManager.setState({ lastActiveTabId: activeInfo.tabId });
    } catch (error) {
      Logger.error('切换标签页后打开侧边栏失败', error);
    }
  }
});

/**
 * 监听标签页关闭，清理状态
 */
browser.tabs.onRemoved.addListener((tabId) => {
  const state = stateManager.getState();
  if (state.lastActiveTabId === tabId) {
    stateManager.setState({
      isOpen: false,
      lastActiveTabId: null,
    }).catch((error) => {
      Logger.error('清理标签页状态失败', error);
    });
  }
});

// ============================================================================
// 错误处理
// ============================================================================

/**
 * 全局错误处理
 */
self.addEventListener('error', (event) => {
  Logger.error('Service Worker 未捕获的错误', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
  });
});

/**
 * 未处理的 Promise 拒绝
 */
self.addEventListener('unhandledrejection', (event) => {
  Logger.error('未处理的 Promise 拒绝', {
    reason: event.reason,
  });
});

// ============================================================================
// 导出（用于测试）
// ============================================================================

export { Logger, StateManager, SidePanelManager, MessageHandler, stateManager, sidePanelManager };
