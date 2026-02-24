import { useEffect, useState } from 'react';
import { getApiService } from '../config/apiSwitch';
import apiClient from '../services/apiClient';
import { mockCloud } from '../services/mockCloud';

/**
 * 自动选择合适的 API 服务的 hook
 * 支持后端不可用时自动降级到 mock
 */
export const useApiService = () => {
  const [service, setService] = useState<typeof apiClient | typeof mockCloud>(mockCloud);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initService = async () => {
      const apiService = await getApiService();
      setService(apiService);
      setInitialized(true);
    };

    initService();
  }, []);

  return { service, initialized };
};
