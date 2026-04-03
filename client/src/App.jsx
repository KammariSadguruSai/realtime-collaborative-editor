import React, { useState, useEffect } from 'react';
import Editor from './Editor';
import Login from './Login';
import './App.css';
import { Sun, Moon, LogOut, Share2, Plus } from 'lucide-react';

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('collab-user');
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('collab-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('collab-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('collab-user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('collab-user');
  };

  if (!user) {
    return (
      <div className="app-wrapper">
        <button className="theme-toggle-fixed" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
        <Login onLogin={handleLogin} />
      </div>
    );
  }

  const params = new URLSearchParams(window.location.search);
  const docId = params.get('doc') || 'shared-document';

  return (
    <div className="app-main">
      <header className="app-navbar">
        <div className="logo">
          <div className="logo-icon">C</div>
          <span>CollabEdit</span>
        </div>
        <div className="nav-actions">
          <button className="btn-new" onClick={() => {
            const secretId = 'private-' + Math.random().toString(36).substring(2, 12);
            window.location.href = window.location.pathname + '?doc=' + secretId;
          }} title="Create a new private document">
            <Plus size={16} />
            <span className="hide-mobile">New Secret Doc</span>
          </button>
          <button className="icon-btn theme-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="btn-share" onClick={() => {
            const url = window.location.href.split('?')[0] + `?doc=${docId}`;
            if (navigator.clipboard) {
              navigator.clipboard.writeText(url).then(() => {
                alert('Link copied! Share it to collaborate.');
              });
            }
          }}>
            <Share2 size={16} />
            <span>Share Link</span>
          </button>
          
          <div className="user-profile">
            <div className="profile-circle">{user.name.charAt(0).toUpperCase()}</div>
            <button className="icon-btn logout-btn" onClick={handleLogout} title="Log Out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      
      <main className="content">
        <Editor docId={docId} user={user} />
      </main>
    </div>
  );
}

export default App;
