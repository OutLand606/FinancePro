
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';

interface Props {
  children?: ReactNode;
  moduleName?: string;
  isGlobal?: boolean;
  // Included key to avoid TS errors in some strict environments where intrinsic attributes aren't inferred correctly for custom classes
  key?: React.Key; 
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  // Explicitly declare props to satisfy strict TypeScript checks
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[CRITICAL] Error in ${this.props.moduleName || 'App Root'}:`, error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHardReset = () => {
      if (confirm("Thao tác này sẽ XÓA TOÀN BỘ dữ liệu cục bộ để sửa lỗi trắng trang. Bạn có chắc chắn?")) {
          localStorage.clear();
          window.location.href = '/';
      }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.isGlobal) {
          // Fallback UI for Global Crash (White Screen Fix)
          return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center font-sans">
                <div className="bg-white p-6 rounded-full shadow-xl mb-6">
                    <AlertTriangle className="text-red-600 w-16 h-16" />
                </div>
                <h1 className="text-2xl font-black text-slate-900 mb-2">Đã xảy ra lỗi hệ thống</h1>
                <p className="text-slate-500 mb-8 max-w-md mx-auto">
                    Hệ thống gặp sự cố nghiêm trọng khi khởi động. Đừng lo, dữ liệu của bạn vẫn an toàn trên đám mây (nếu đã đồng bộ).
                </p>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-left text-xs font-mono text-red-800 mb-8 w-full max-w-lg overflow-auto max-h-32 mx-auto">
                    {this.state.error?.toString() || "Unknown Error"}
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button 
                        onClick={this.handleReload}
                        className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center"
                    >
                        <RefreshCcw size={18} className="mr-2"/> Thử tải lại
                    </button>
                    <button 
                        onClick={this.handleHardReset}
                        className="px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center"
                    >
                        <Trash2 size={18} className="mr-2"/> Đặt lại hệ thống (Hard Reset)
                    </button>
                </div>
            </div>
          );
      }

      // Standard Module Fallback
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 rounded-xl border border-red-200 text-center animate-in fade-in">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <AlertTriangle className="text-red-600 w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Đã xảy ra lỗi tại phân hệ: {this.props.moduleName || 'Hệ thống'}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Hệ thống gặp sự cố không mong muốn khi hiển thị chức năng này.
          </p>
          <div className="flex gap-3">
            <button 
                onClick={this.handleReload}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm"
            >
                <RefreshCcw size={16} className="mr-2"/> Tải Lại Trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
