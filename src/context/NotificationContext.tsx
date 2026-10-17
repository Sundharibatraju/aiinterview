import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X, HelpCircle } from 'lucide-react';

export type NotificationType = 'error' | 'success' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export interface AlertDialogOptions {
  title?: string;
  message: string;
  type?: NotificationType;
  buttonLabel?: string;
}

interface NotificationContextType {
  showToast: (message: string, type?: NotificationType, title?: string, duration?: number) => void;
  showError: (message: string, title?: string) => void;
  showSuccess: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  showAlert: (message: string, title?: string, type?: NotificationType) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Standalone global trigger so window.alert can be safely intercepted anywhere
let globalNotifyFn: ((message: string, type?: NotificationType, title?: string) => void) | null = null;
let globalAlertFn: ((message: string, title?: string, type?: NotificationType) => Promise<void>) | null = null;

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmDialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const [alertModalState, setAlertModalState] = useState<{
    isOpen: boolean;
    options: AlertDialogOptions;
    resolve: () => void;
  } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: NotificationType = 'info', title?: string, duration = 5000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, title, message, duration };
      setToasts(prev => [newToast, ...prev.slice(0, 5)]); // Keep maximum 6 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showError = useCallback(
    (message: string, title = 'Error') => {
      showToast(message, 'error', title, 6000);
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (message: string, title = 'Success') => {
      showToast(message, 'success', title, 4500);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, title = 'Attention') => {
      showToast(message, 'warning', title, 5000);
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, title = 'Information') => {
      showToast(message, 'info', title, 4500);
    },
    [showToast]
  );

  const showConfirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const showAlert = useCallback(
    (message: string, title = 'Notification', type: NotificationType = 'error'): Promise<void> => {
      return new Promise(resolve => {
        setAlertModalState({
          isOpen: true,
          options: { message, title, type },
          resolve,
        });
      });
    },
    []
  );

  // Set up global hooks to intercept any browser alert() or unhandled runtime rejection
  useEffect(() => {
    globalNotifyFn = showToast;
    globalAlertFn = showAlert;

    const originalAlert = window.alert;
    // Intercept native browser alert
    window.alert = (msg?: any) => {
      const text = typeof msg === 'string' ? msg : String(msg ?? '');
      if (globalAlertFn) {
        globalAlertFn(text, 'Notice', 'error');
      } else if (globalNotifyFn) {
        globalNotifyFn(text, 'error', 'Notice');
      }
    };

    return () => {
      window.alert = originalAlert;
      globalNotifyFn = null;
      globalAlertFn = null;
    };
  }, [showToast, showAlert]);

  return (
    <NotificationContext.Provider
      value={{
        showToast,
        showError,
        showSuccess,
        showWarning,
        showInfo,
        showConfirm,
        showAlert,
      }}
    >
      {children}

      {/* IN-APP FLOATING TOASTS NOTIFICATIONS CONTAINER */}
      <div
        id="app-notification-toast-container"
        className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isSuccess = toast.type === 'success';
          const isWarning = toast.type === 'warning';

          const bgColor = isError
            ? 'bg-rose-50 border-rose-200 text-rose-950'
            : isSuccess
            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
            : isWarning
            ? 'bg-amber-50 border-amber-200 text-amber-950'
            : 'bg-blue-50 border-blue-200 text-blue-950';

          const iconColor = isError
            ? 'text-rose-600'
            : isSuccess
            ? 'text-emerald-600'
            : isWarning
            ? 'text-amber-600'
            : 'text-blue-600';

          return (
            <div
              key={toast.id}
              id={`toast-${toast.id}`}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${bgColor}`}
            >
              <div className="shrink-0 mt-0.5">
                {isError && <AlertCircle className={`w-5 h-5 ${iconColor}`} />}
                {isSuccess && <CheckCircle2 className={`w-5 h-5 ${iconColor}`} />}
                {isWarning && <AlertTriangle className={`w-5 h-5 ${iconColor}`} />}
                {!isError && !isSuccess && !isWarning && <Info className={`w-5 h-5 ${iconColor}`} />}
              </div>

              <div className="flex-1 min-w-0">
                {toast.title && (
                  <h4 className="text-xs font-bold leading-tight mb-0.5 tracking-tight">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs font-medium leading-relaxed break-words">{toast.message}</p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-black/5 transition cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* IN-APP ALERT MODAL (Replaces blocking window.alert with a clean in-app UI) */}
      {alertModalState?.isOpen && (
        <div
          id="in-app-alert-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center transform transition-all">
            <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-rose-100 text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-2">
              {alertModalState.options.title || 'Attention Required'}
            </h3>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-6">
              <p className="text-xs font-medium text-slate-700 leading-relaxed text-left whitespace-pre-line">
                {alertModalState.options.message}
              </p>
            </div>

            <button
              type="button"
              id="btn-alert-modal-dismiss"
              onClick={() => {
                const resolve = alertModalState.resolve;
                setAlertModalState(null);
                resolve();
              }}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
            >
              {alertModalState.options.buttonLabel || 'Understood'}
            </button>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION MODAL (Replaces blocking window.confirm) */}
      {confirmState?.isOpen && (
        <div
          id="in-app-confirm-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center transform transition-all">
            <div
              className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                confirmState.options.isDestructive
                  ? 'bg-rose-100 text-rose-600'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              {confirmState.options.isDestructive ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <HelpCircle className="w-6 h-6" />
              )}
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-2">
              {confirmState.options.title}
            </h3>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {confirmState.options.message}
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                id="btn-confirm-cancel"
                onClick={() => {
                  const resolve = confirmState.resolve;
                  setConfirmState(null);
                  resolve(false);
                }}
                className="flex-1 py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
              >
                {confirmState.options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                id="btn-confirm-proceed"
                onClick={() => {
                  const resolve = confirmState.resolve;
                  setConfirmState(null);
                  resolve(true);
                }}
                className={`flex-1 py-2.5 px-4 font-bold text-xs rounded-xl shadow-sm transition cursor-pointer text-white ${
                  confirmState.options.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmState.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
