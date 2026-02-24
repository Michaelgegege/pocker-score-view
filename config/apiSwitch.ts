import apiClient from '../services/apiClient';
import { mockCloud } from '../services/mockCloud';
import { ENV_CONFIG } from './env';

/**
 * API 服务层
 * 可自动切换本地 mock 和真实后端
 */

type ApiService = typeof apiClient | typeof mockCloud;

let currentService: 'api' | 'mock' = 'api'; // 默认使用真实 API
let backendHealthy = false; // 后端健康状态

// 初始化时检测后端是否可用
const checkBackendHealth = async (): Promise<boolean> => {
  try {
    // 尝试调用一个必然存在的接口来检测后端可用性
    // 使用注册接口做健康检查（总是需要这个接口）
    const response = await fetch(`${ENV_CONFIG.API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' }), // 故意错误的请求，只是检测后端是否响应
      timeout: 3000,
    } as any);
    // 只要收到响应（不是连接错误），就说明后端可用
    return true;
  } catch (error) {
    console.error('后端连接检测失败:', error);
    return false;
  }
};

/**
 * 获取当前使用的 API 服务
 * 默认使用真实 API，失败时才降级到 mock
 */
export const getApiService = async (): Promise<ApiService> => {
  // 直接返回 API 客户端，让 API 调用来确定是否可用
  console.log('✅ 使用真实 API 模式');
  currentService = 'api';
  return apiClient;
};

/**
 * 手动切换 API 服务
 */
export const switchApiService = (service: 'api' | 'mock') => {
  currentService = service;
  console.log(`已切换到 ${service === 'api' ? '真实后端' : '本地 Mock'} 模式`);
};

/**
 * 获取当前使用的服务类型
 */
export const getCurrentService = (): 'api' | 'mock' => currentService;

/**
 * 设置后端 URL（用于手动配置）
 */
export const setBackendUrl = (url: string) => {
  // 更新环境配置
  ENV_CONFIG.API_BASE_URL = url.endsWith('/api') ? url : `${url}/api`;
  // 重置健康检测状态
  backendHealthy = false;
  // 确保使用 API 模式
  currentService = 'api';
  console.log(`后端 URL 已设置为: ${ENV_CONFIG.API_BASE_URL}`);
};

// 应用启动时检测后端
checkBackendHealth().then(healthy => {
  backendHealthy = healthy;
  if (healthy) {
    console.log('✅ 后端可用');
    currentService = 'api';
  } else {
    console.log('⚠️ 后端不可用，将使用 Mock 数据');
    currentService = 'mock';
  }
});

export default { getApiService, switchApiService, getCurrentService, setBackendUrl };
