import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      // Custom fallback UI or use provided fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <h1 style={{ color: '#dc3545', marginBottom: '1rem' }}>
            🚨 Something went wrong
          </h1>
          <p style={{ color: '#6c757d', marginBottom: '2rem', maxWidth: '600px' }}>
            We encountered an unexpected error. This might be due to a temporary issue or invalid data.
          </p>
          <div style={{ marginBottom: '2rem' }}>
            <button 
              onClick={this.handleRetry}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '1rem',
                marginRight: '1rem'
              }}
            >
              🔄 Try Again
            </button>
            <button 
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              🔃 Reload Page
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ 
              backgroundColor: '#f8f9fa', 
              border: '1px solid #dee2e6',
              borderRadius: '0.375rem',
              padding: '1rem',
              marginTop: '1rem',
              maxWidth: '800px',
              width: '100%'
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                🐛 Debug Information (Development Only)
              </summary>
              <pre style={{ 
                marginTop: '1rem', 
                fontSize: '0.875rem', 
                whiteSpace: 'pre-wrap',
                color: '#dc3545'
              }}>
                {this.state.error.toString()}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 