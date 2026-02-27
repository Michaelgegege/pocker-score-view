/**
 * 环境配置文件
 * 根据实际后端运行的地址修改 API_BASE_URL
 */

const normalizeApiBaseUrl = (url: string): string => {
  if (!url) return 'http://127.0.0.1:3000/api';
  const trimmed = url.trim();
  if (trimmed.endsWith('/api')) return trimmed;
  if (trimmed === '/api') return trimmed;
  return `${trimmed.replace(/\/$/, '')}/api`;
};

const LOCAL_API_BASE_URL = 'http://127.0.0.1:3000/api';
const NATIVE_FALLBACK_API_BASE_URL = 'http://8.148.81.221:3000/api';

const isNativeCapacitorRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  const capacitor = (window as any).Capacitor;
  if (!capacitor) return false;

  if (typeof capacitor.isNativePlatform === 'function') {
    try {
      return Boolean(capacitor.isNativePlatform());
    } catch {
      return false;
    }
  }

  return capacitor.platform != null && capacitor.platform !== 'web';
};

const resolveApiBaseUrl = (): string => {
  const viteApiUrl = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (viteApiUrl) {
    return normalizeApiBaseUrl(viteApiUrl);
  }

  const isDev = Boolean((import.meta as any)?.env?.DEV);

  if (isNativeCapacitorRuntime()) {
    return NATIVE_FALLBACK_API_BASE_URL;
  }

  if (isDev) {
    return LOCAL_API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }

  return LOCAL_API_BASE_URL;
};

export const ENV_CONFIG = {
  // 后端 API 基础 URL
  // 开发环境：http://localhost:3000
  // 生产环境：https://api.example.com
  API_BASE_URL: resolveApiBaseUrl(),

  // API 请求超时时间（毫秒）
  API_TIMEOUT: 10000,

  // 是否启用调试日志
  DEBUG: Boolean((import.meta as any)?.env?.DEV),

  // 本地存储的 key
  STORAGE_KEYS: {
    USER: 'poker_user',
    TOKEN: 'poker_token',
    ROOMS: 'poker_rooms',
  },
};

// 获取实际的 API URL（可在运行时覆盖）
export const getApiBaseUrl = (): string => {
  return ENV_CONFIG.API_BASE_URL;
};

// 设置 API URL（用于动态配置）
export const setApiBaseUrl = (url: string): void => {
  ENV_CONFIG.API_BASE_URL = normalizeApiBaseUrl(url);
};
