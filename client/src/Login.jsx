import React, { useState, useEffect } from 'react';
import './Login.css';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { loadCaptchaEnginge, LoadCanvasTemplate, validateCaptcha } from 'react-simple-captcha';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:5000`;

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login', 'signup', 'forgot'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    organization: '',
    institute: '',
    captcha: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === 'forgot') {
      loadCaptchaEnginge(6);
    }
  }, [mode]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const res = await axios.post(`${API_BASE}/register`, formData);
        onLogin(res.data.user);
      } else if (mode === 'login') {
        const res = await axios.post(`${API_BASE}/login`, { email: formData.email, password: formData.password });
        onLogin(res.data.user);
      } else if (mode === 'forgot') {
        if (!validateCaptcha(formData.captcha)) {
          alert('Captcha Does Not Match');
          return;
        }
        await axios.post(`${API_BASE}/forgot-password`, { email: formData.email, captcha: true });
        alert('Password reset link sent!');
        setMode('login');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
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

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign In</button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign Up</button>
        </div>

        <h1 className="login-title">
          {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
        </h1>
        
        <form onSubmit={handleAuth} className="login-form">
          {mode === 'signup' && (
            <>
              <div className="input-group">
                <label>Full Name</label>
                <input name="name" placeholder="John Doe" onChange={handleChange} required />
              </div>
              <div className="input-group">
                <label>Organization</label>
                <input name="organization" placeholder="e.g. Google" onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Institute / College</label>
                <input name="institute" placeholder="e.g. Stanford" onChange={handleChange} />
              </div>
            </>
          )}

          <div className="input-group">
            <label>Email address</label>
            <input name="email" type="email" placeholder="you@example.com" onChange={handleChange} required />
          </div>

          {mode !== 'forgot' && (
            <div className="input-group">
              <label>Password</label>
              <input name="password" type="password" placeholder="••••••••" onChange={handleChange} required />
            </div>
          )}

          {mode === 'forgot' && (
            <div className="captcha-container">
              <LoadCanvasTemplate />
              <input 
                name="captcha" 
                placeholder="Enter Captcha" 
                className="captcha-input"
                onChange={handleChange} 
                required 
              />
            </div>
          )}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
          
          {mode === 'login' && (
            <button type="button" className="text-btn" onClick={() => setMode('forgot')}>
              Forgot Password?
            </button>
          )}
        </form>

        {(mode === 'login' || mode === 'signup') && (
          <>
            <div className="login-divider"><span>Or continue with</span></div>
            <div className="google-btn-wrapper">
              <GoogleLogin onSuccess={handleGoogleSuccess} theme="filled_blue" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
