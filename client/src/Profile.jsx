import React, { useState } from 'react';
import axios from 'axios';
import { User, Shield, Briefcase, School, Save, X } from 'lucide-react';
import './Profile.css';

const API_BASE = import.meta.env.VITE_API_BASE || `http://localhost:5000`;

export default function Profile({ user, onUpdate, onClose }) {
  const [formData, setFormData] = useState({
    name: user.name || '',
    organization: user.organization || '',
    institute: user.institute || '',
    avatar_url: user.avatar_url || '',
    newPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const data = new FormData();
    data.append('avatar', file);
    data.append('userId', user.id);

    try {
      const res = await axios.post(`${API_BASE}/upload-avatar`, data);
      setFormData({ ...formData, avatar_url: res.data.url });
    } catch (err) {
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Update Metadata
      const res = await axios.post(`${API_BASE}/update-profile`, {
        userId: user.id,
        name: formData.name,
        organization: formData.organization,
        institute: formData.institute,
        avatar_url: formData.avatar_url
      });

      // 2. Update Password if provided
      if (formData.newPassword) {
        await axios.post(`${API_BASE}/update-password-admin`, {
          userId: user.id,
          password: formData.newPassword
        });
      }

      onUpdate(res.data.user);
      alert('Profile updated successfully!');
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-overlay">
      <div className="profile-modal">
        <div className="profile-header">
          <h2><User size={20} /> User Profile</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleUpdate} className="profile-form">
          <div className="avatar-section">
            <div className="avatar-preview">
              {formData.avatar_url ? (
                <img src={formData.avatar_url} alt="Profile" />
              ) : (
                <div className="avatar-placeholder">{formData.name?.charAt(0).toUpperCase()}</div>
              )}
              {uploading && <div className="avatar-loader">Uploading...</div>}
            </div>
            <label className="upload-btn">
              Change Picture
              <input type="file" accept="image/*" onChange={handleFileChange} hidden />
            </label>
          </div>

          <div className="profile-section-title">Personal Information</div>
          <div className="input-group">
            <label><User size={16} /> Full Name</label>
            <input name="name" value={formData.name} onChange={handleChange} required />
          </div>
          <div className="input-group">
             <label><Briefcase size={16} /> Organization</label>
             <input name="organization" value={formData.organization} onChange={handleChange} />
          </div>
          <div className="input-group">
             <label><School size={16} /> Institute</label>
             <input name="institute" value={formData.institute} onChange={handleChange} />
          </div>

          <div className="profile-section-title">Security</div>
          <div className="input-group">
            <label><Shield size={16} /> Change Password (Optional)</label>
            <input 
              name="newPassword" 
              type="password" 
              placeholder="Enter new password" 
              onChange={handleChange} 
            />
            <small>Leave blank to keep your current password.</small>
          </div>

          <button type="submit" className="save-btn" disabled={loading}>
            <Save size={18} /> {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
