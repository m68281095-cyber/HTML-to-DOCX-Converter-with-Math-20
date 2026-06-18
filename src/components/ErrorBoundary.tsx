import React, { ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 border border-red-200 rounded-lg max-w-lg mx-auto my-12 shadow-sm select-none">
          <AlertOctagon className="h-10 w-10 text-red-600 mb-3" />
          <h3 className="text-sm font-bold text-red-950 uppercase tracking-wide">সিস্টেম রেন্ডারিং ব্যর্থতা</h3>
          <p className="text-xs text-red-700 font-medium mt-1 leading-relaxed">
            কোনো সমীকরণ বিন্যাসে বা রেন্ডারিং প্রক্রিয়ায় এরর ঘটেছে। অ্যাপ্লিকেশনটি ক্র্যাশ করা ছাড়াই আপনাকে রক্ষা করা হয়েছে।
          </p>
          {this.state.error && (
            <pre className="text-[10px] text-red-900 bg-red-105/50 border border-red-200 p-2.5 rounded font-mono mt-3 max-w-full overflow-x-auto text-left leading-normal">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="mt-4 inline-flex items-center space-x-1.5 bg-red-600 hover:bg-red-700 text-white rounded px-4 py-1.5 font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>পুনরায় লোড করুন</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
