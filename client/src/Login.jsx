import React, { useState, useEffect } from 'react';
import './Login.css';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { loadCaptchaEnginge, LoadCanvasTemplate, validateCaptcha } from 'react-simple-captcha';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

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

  useEffect(() => {
    // Detect password reset token in URL (Supabase recovery)
    if (window.location.hash.includes('type=recovery')) {
      setMode('update-password');
    }
  }, []);

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
      } else if (mode === 'update-password') {
        const hash = window.location.hash;
        const accessToken = hash.split('access_token=')[1]?.split('&')[0];
        if (!accessToken) throw new Error('Invalid recovery link');

        await axios.post(`${API_BASE}/update-password`, { 
          password: formData.password,
          token: accessToken
        });
        alert('Your password has been updated!');
        window.location.hash = ''; // Clear the sensitive token
        setMode('login');
      }
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/google`, { 
        token: credentialResponse.credential 
      });
      onLogin(res.data.user);
    } catch (err) {
      alert(err.response?.data?.error || 'Google Login Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {mode !== 'update-password' && (
          <div className="login-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign In</button>
            <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign Up</button>
          </div>
        )}

        {mode === 'update-password' && (
          <div className="update-badge">🔐 Password Recovery</div>
        )}

        <h1 className="login-title">
          {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : mode === 'update-password' ? 'Set New Password' : 'Reset Password'}
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

          {mode !== 'update-password' && (
            <div className="input-group">
              <label>Email address</label>
              <input name="email" type="email" placeholder="you@example.com" onChange={handleChange} required />
            </div>
          )}

          {mode !== 'forgot' && (
            <div className="input-group">
              <label>{mode === 'update-password' ? 'New Password' : 'Password'}</label>
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
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'update-password' ? 'Update & Login' : 'Send Reset Link'}
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

        {mode === 'update-password' || mode === 'forgot' ? (
          <button type="button" className="text-btn" onClick={() => setMode('login')}>
            ← Back to Sign In
          </button>
        ) : null}
      </div>
    </div>
  );
}
