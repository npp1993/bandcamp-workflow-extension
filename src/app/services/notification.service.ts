import {Logger} from '../utils/logger';

/**
 * Service for displaying toast-style notifications to users
 */
export class NotificationService {
  private static readonly NOTIFICATION_CONTAINER_ID = 'bandcamp-workflow-notifications';
  private static readonly NOTIFICATION_CLASS = 'bandcamp-workflow-notification';
  private static readonly DEFAULT_DURATION = 5000; // 5 seconds
  private static notificationCounter = 0;

  /**
   * Initialize the notification system by creating the container
   */
  private static initializeContainer(): HTMLElement {
    let container = document.getElementById(this.NOTIFICATION_CONTAINER_ID);
    
    if (!container) {
      container = document.createElement('div');
      container.id = this.NOTIFICATION_CONTAINER_ID;
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
    
    return container;
  }

  /**
   * Show a toast notification
   * 
   * @param message The message to display
   * @param type The type of notification (success, warning, error, info)
   * @param duration Duration in milliseconds (0 = permanent until clicked)
   */
  public static show(
    message: string, 
    type: 'success' | 'warning' | 'error' | 'info' = 'info',
    duration: number = this.DEFAULT_DURATION
  ): void {
    try {
      Logger.info(`Showing ${type} notification: ${message}`);
      
      const container = this.initializeContainer();
      const notification = this.createNotificationElement(message, type);
      
      // Add to container
      container.appendChild(notification);
      
      // Animate in
      setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
      }, 10);
      
      // Auto-remove after duration (if not permanent)
      if (duration > 0) {
        setTimeout(() => {
          this.removeNotification(notification);
        }, duration);
      }
      
      // Click to dismiss
      notification.addEventListener('click', () => {
        this.removeNotification(notification);
      });
      
    } catch (error) {
      Logger.error('Error showing notification:', error);
      // Fallback to alert if notification system fails
      window.alert(message);
    }
  }

  /**
   * Show a success notification
   */
  public static success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }

  /**
   * Show a warning notification
   */
  public static warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }

  /**
   * Show an error notification
   */
  public static error(message: string, duration?: number): void {
    this.show(message, 'error', duration);
  }

  /**
   * Show an info notification
   */
  public static info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }

  /**
   * Create a notification element
   */
  private static createNotificationElement(message: string, type: string): HTMLElement {
    const notification = document.createElement('div');
    this.notificationCounter++;
    
    const typeColors: Record<string, { bg: string; icon: string }> = {
      success: { bg: '#4CAF50', icon: '✓' },
      warning: { bg: '#FF9800', icon: '⚠' },
      error: { bg: '#F44336', icon: '✕' },
      info: { bg: '#2196F3', icon: 'ℹ' }
    };
    
    const colors = typeColors[type] || typeColors.info;
    
    notification.className = this.NOTIFICATION_CLASS;
    notification.style.cssText = `
      background: ${colors.bg};
      color: white;
      padding: 12px 16px;
      margin-bottom: 10px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
      max-width: 100%;
      word-wrap: break-word;
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease-in-out;
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    
    notification.innerHTML = `
      <span style="font-weight: bold; font-size: 16px;">${colors.icon}</span>
      <span style="flex: 1;">${this.escapeHtml(message)}</span>
      <span style="opacity: 0.8; font-size: 12px;">Click to dismiss</span>
    `;
    
    return notification;
  }

  /**
   * Remove a notification with animation
   */
  private static removeNotification(notification: HTMLElement): void {
    if (!notification || !notification.parentNode) {
      return;
    }
    
    // Animate out
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    // Remove from DOM
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  /**
   * Clear all notifications
   */
  public static clearAll(): void {
    const container = document.getElementById(this.NOTIFICATION_CONTAINER_ID);
    if (container) {
      const notifications = container.querySelectorAll(`.${this.NOTIFICATION_CLASS}`);
      notifications.forEach(notification => {
        this.removeNotification(notification as HTMLElement);
      });
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
