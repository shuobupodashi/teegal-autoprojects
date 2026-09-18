import { DesktopApp } from '@/components/workspace/DesktopModule/types/DesktopAppTypes';

interface DesktopAppCacheManagerOptions {
  pageSize?: number;
  cacheTimeout?: number;
}

interface CacheEntry {
  apps: DesktopApp[];
  timestamp: number;
  totalCount: number;
}

class DesktopAppCacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private pageSize: number;
  private cacheTimeout: number;

  constructor(options: DesktopAppCacheManagerOptions = {}) {
    this.pageSize = options.pageSize || 4;
    this.cacheTimeout = options.cacheTimeout || 5 * 60 * 1000; // 5分钟
  }

  get(userId: string): CacheEntry | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.cacheTimeout) {
      this.cache.delete(userId);
      return null;
    }

    return entry;
  }

  set(userId: string, apps: DesktopApp[], totalCount: number): void {
    this.cache.set(userId, {
      apps,
      timestamp: Date.now(),
      totalCount,
    });
  }

  updateApp(userId: string, appId: string, updates: Partial<DesktopApp>): void {
    const entry = this.cache.get(userId);
    if (!entry) return;

    const updatedApps = entry.apps.map(app =>
      app.id === appId ? { ...app, ...updates } : app
    );

    this.cache.set(userId, {
      apps: updatedApps,
      timestamp: entry.timestamp,
      totalCount: entry.totalCount,
    });
  }

  addApp(userId: string, newApp: DesktopApp): void {
    const entry = this.cache.get(userId);
    if (!entry) {
      this.set(userId, [newApp], 1);
      return;
    }

    this.cache.set(userId, {
      apps: [newApp, ...entry.apps],
      timestamp: entry.timestamp,
      totalCount: entry.totalCount + 1,
    });
  }

  removeApp(userId: string, appId: string): void {
    const entry = this.cache.get(userId);
    if (!entry) return;

    const filteredApps = entry.apps.filter(app => app.id !== appId);

    this.cache.set(userId, {
      apps: filteredApps,
      timestamp: entry.timestamp,
      totalCount: Math.max(0, entry.totalCount - 1),
    });
  }

  clear(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
    } else {
      this.cache.clear();
    }
  }

  clearExpired(): void {
    const now = Date.now();
    for (const [userId, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(userId);
      }
    }
  }

  getPageSize(): number {
    return this.pageSize;
  }

  hasCache(userId: string): boolean {
    return this.cache.has(userId);
  }
}

export const desktopAppCacheManager = new DesktopAppCacheManager();
