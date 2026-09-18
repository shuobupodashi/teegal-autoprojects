interface DesktopAppEvent {
  type: 'app_created' | 'app_updated' | 'app_deleted' | 'app_refreshed';
  appId: string;
  userId: string;
  data?: any;
  timestamp: number;
}

type DesktopAppEventListener = (event: DesktopAppEvent) => void;

class DesktopAppEventService {
  private listeners: Map<string, Set<DesktopAppEventListener>> = new Map();

  subscribe(eventType: string, listener: DesktopAppEventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    const listeners = this.listeners.get(eventType)!;
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  emit(event: DesktopAppEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in desktop app event listener for ${event.type}:`, error);
        }
      });
    }
  }

  emitAppCreated(appId: string, userId: string, data?: any): void {
    this.emit({
      type: 'app_created',
      appId,
      userId,
      data,
      timestamp: Date.now(),
    });
  }

  emitAppUpdated(appId: string, userId: string, data?: any): void {
    this.emit({
      type: 'app_updated',
      appId,
      userId,
      data,
      timestamp: Date.now(),
    });
  }

  emitAppDeleted(appId: string, userId: string): void {
    this.emit({
      type: 'app_deleted',
      appId,
      userId,
      timestamp: Date.now(),
    });
  }

  emitAppRefreshed(appId: string, userId: string, data?: any): void {
    this.emit({
      type: 'app_refreshed',
      appId,
      userId,
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const desktopAppEventService = new DesktopAppEventService();
