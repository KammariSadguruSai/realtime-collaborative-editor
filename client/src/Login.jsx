import React, { useState } from 'react';
import './Login.css';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      onLogin({ email, name: email.split('@')[0] });
    }
  };

  const handleGoogleSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    onLogin({ 
      email: decoded.email, 
      name: decoded.name,
      picture: decoded.picture 
    });
  };

  const handleGoogleError = () => {
    console.log('Login Failed');
    alert('Google Login Failed. Please try again.');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Welcome to CollabEdit</h1>
        <p className="login-subtitle">Sign in to collaborate on documents in real-time.</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Email address</label>
            <input 
              type="email" 
              placeholder="you@example.com" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className="primary-btn">Sign In</button>
        </form>

        <div className="login-divider">
          <span>Or create account with</span>
        </div>

        <div className="google-btn-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            useOneTap
            width="100%"
            theme="filled_blue"
            text="continue_with"
            shape="pill"
          />
        </div>
      </div>
    </div>
  );
}
