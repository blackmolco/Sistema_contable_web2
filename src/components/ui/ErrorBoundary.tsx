import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.moduleName ? ` - ${this.props.moduleName}` : ''}]`, error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {this.props.moduleName ? `Error en ${this.props.moduleName}` : 'Algo salió mal'}
        </h2>
        <p className="text-sm text-gray-500 mb-6 max-w-md">
          Ocurrió un error inesperado. El resto de la aplicación sigue funcionando.
        </p>
        {this.state.error && (
          <details className="mb-6 text-left w-full max-w-lg">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
              Detalle técnico
            </summary>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          </details>
        )}
        <button
          onClick={this.reset}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2D5A87] transition-colors text-sm"
        >
          <RefreshCw size={16} />
          Intentar de nuevo
        </button>
      </div>
    );
  }
}
