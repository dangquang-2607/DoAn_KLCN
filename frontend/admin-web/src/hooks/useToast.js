import { useState, useCallback } from 'react';

// Simple global toast hook (nếu muốn dùng thư viện như react-hot-toast thì cài đặt sau)
export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove sau 3 giây
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainer = () => (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 animate-slide-up flex items-center gap-2 pointer-events-auto
            ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
              toast.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
              toast.type === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-blue-50 text-blue-700 border-blue-200'}
          `}
        >
          {toast.type === 'success' && <span>✅</span>}
          {toast.type === 'error' && <span>❌</span>}
          {toast.type === 'warning' && <span>⚠️</span>}
          {toast.type === 'info' && <span>ℹ️</span>}
          <span>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="ml-2 text-current opacity-50 hover:opacity-100">&times;</button>
        </div>
      ))}
    </div>
  );

  return { addToast, ToastContainer };
}
