import React from 'react';
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import './App.css';
import { KanbanBoard } from './components/KanbanBoard';
import { ProjectSelector } from './components/ProjectSelector';
import ErrorBoundary from './components/ErrorBoundary';

interface AppProps {}

const App: React.FC<AppProps> = () => {
  const [apiStatus, setApiStatus] = React.useState<string>('Loading...');
  
  // Utilize Clerk's authentication hooks for programmatic access to auth state
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  React.useEffect(() => {
    const testApi = async (): Promise<void> => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setApiStatus(`API Status: ${data.status}`);
      } catch (error) {
        setApiStatus('API connection failed');
        console.error('API test failed:', error);
      }
    };

    testApi();
  }, []);

  // Show loading state while Clerk loads
  if (!isLoaded) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🎯 HobbyTrack</h1>
          <p>Loading authentication...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="App">
      {/* Header for authenticated users */}
      {isSignedIn && (
        <header className="App-header">
          <h1>🎯 HobbyTrack</h1>
          <div className="user-section">
            <span>Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
      )}

      {/* Landing page for non-authenticated users */}
      {!isSignedIn && (
        <div className="landing-page">
          <header className="landing-header">
            <div className="landing-nav">
              <h1>🎯 HobbyTrack</h1>
              <div className="api-status-badge">{apiStatus}</div>
            </div>
          </header>
          
          <main className="landing-main">
            <div className="hero-section">
              <div className="hero-content">
                <h1 className="hero-title">Modern project tracking for hobbyists</h1>
                <p className="hero-subtitle">
                  Transform your hobby projects with visual Kanban boards, file uploads, 
                  and progress tracking. Built on the powerful Trac foundation with a modern, 
                  user-friendly interface.
                </p>
                
                <div className="hero-features">
                  <div className="feature">
                    <span className="feature-icon">📋</span>
                    <span>Visual Kanban Boards</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">📁</span>
                    <span>File Attachments</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">🎯</span>
                    <span>Progress Tracking</span>
                  </div>
                </div>

                <div className="auth-card">
                  <h2>Get started with your projects</h2>
                  <p>Sign in to create and manage your hobby projects</p>
                  
                  <div className="auth-buttons">
                    <SignInButton mode="modal">
                      <button className="auth-button primary">Sign In</button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="auth-button secondary">Sign Up</button>
                    </SignUpButton>
                  </div>
                  
                  <div className="auth-providers">
                    <p>Quick sign-in options available</p>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}
      
      {/* Main app for authenticated users */}
      {isSignedIn && (
        <main>
          <ErrorBoundary>
            <div className="project-section">
              <ProjectSelector />
            </div>
            <KanbanBoard />
          </ErrorBoundary>
        </main>
      )}
    </div>
  );
};

export default App; 