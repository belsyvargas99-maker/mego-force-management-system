import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'Ha ocurrido un error inesperado.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) {
        readable = `Error de base de datos (${parsed.operationType || 'operación'}): ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }
    return { hasError: true, message: readable };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#141414] border border-[#292929] rounded-lg p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-lg bg-[#ED1010]/15 border border-[#ED1010]/40 flex items-center justify-center text-[#ED1010]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-display text-2xl tracking-wide uppercase">
              Error en la aplicación
            </h2>
            <p className="text-sm text-[#888888] break-words">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#ED1010] hover:bg-[#c80d0d] text-white text-sm font-semibold rounded-md transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Recargar sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
