
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';

const rootElement = document.getElementById('root');

// --- EMERGENCY RESCUE UI ---
// Nếu React không thể mount (lỗi trắng trang), hiển thị nút này
const renderRescueUI = (errorMsg: string) => {
    if (!rootElement) return;
    rootElement.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f8fafc;padding:20px;text-align:center;">
            <div style="background:#fee2e2;color:#b91c1c;padding:15px;border-radius:10px;margin-bottom:20px;max-width:600px;word-break:break-word;">
                <strong>Lỗi Hệ Thống:</strong> ${errorMsg}
            </div>
            <h2 style="color:#1e293b;margin-bottom:10px;">Ứng dụng không thể khởi động</h2>
            <p style="color:#64748b;margin-bottom:30px;">Có thể dữ liệu cũ đang gây xung đột. Hãy thử làm mới lại.</p>
            <button id="rescue-btn" style="background:#ef4444;color:white;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:16px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
                🗑️ Xóa Dữ Liệu & Khởi Động Lại
            </button>
        </div>
    `;
    document.getElementById('rescue-btn')?.addEventListener('click', () => {
        if(confirm("Thao tác này sẽ xóa toàn bộ dữ liệu lưu trên trình duyệt để sửa lỗi. Bạn có chắc chắn?")) {
            localStorage.clear();
            window.location.reload();
        }
    });
};

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary isGlobal={true}>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
} catch (e: any) {
    console.error("Critical Mount Error:", e);
    renderRescueUI(e.message || "Unknown Error");
}

// Global Error Handler for non-React errors (Import errors, Syntax errors)
window.onerror = function(message, source, lineno, colno, error) {
    console.error("Global Error:", message);
    // Chỉ hiển thị Rescue UI nếu Root chưa được mount (tức là trang trắng)
    if (rootElement.innerHTML === "") {
        renderRescueUI(typeof message === 'string' ? message : "Lỗi tải tệp tin script");
    }
};
