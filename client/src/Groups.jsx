import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, UserPlus, FileText, Share2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import './Groups.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export default function Groups({ user, onSelectDoc, notify, setAppGroups }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [mode, setMode] = useState(null); // 'create' or 'join'
  const [expandedGroups, setExpandedGroups] = useState({}); // { groupId: boolean }

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${API_BASE}/groups/${user.id}`);
      setGroups(res.data);
      if (setAppGroups) setAppGroups(res.data);
    } catch (err) {
      console.error('Failed to fetch groups');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      const res = await axios.post(`${API_BASE}/groups`, { name: newGroupName, ownerId: user.id });
      setNewGroupName('');
      setMode(null);
      notify(`Group "${newGroupName}" created successfully!`);
      // Open the new group doc immediately
      onSelectDoc('group-' + res.data.id);
      fetchGroups();
    } catch (err) {
      alert('Failed to create group');
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode) return;
    try {
      const res = await axios.post(`${API_BASE}/groups/join`, { inviteCode, userId: user.id });
      setInviteCode('');
      setMode(null);
      notify(res.data.message);
      // Open the group doc immediately
      onSelectDoc('group-' + res.data.groupId);
      fetchGroups();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to join group');
    }
  };

  const handleDeleteGroup = async (groupId, groupName) => {
    if (!window.confirm(`Are you sure you want to delete the group "${groupName}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/groups/${groupId}`);
      notify(`Group deleted successfully!`);
      fetchGroups();
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to delete group', 'error');
    }
  };

  return (
    <div className="groups-sidebar">
      <div className="groups-header">
        <h3><Users size={18} /> My Groups</h3>
        <div className="header-actions">
          <button onClick={() => setMode(mode === 'create' ? null : 'create')} className="icon-btn" title="Create Group">
            <Plus size={20} />
          </button>
          <button onClick={() => setMode(mode === 'join' ? null : 'join')} className="icon-btn" title="Join Group">
            <UserPlus size={20} />
          </button>
        </div>
      </div>

      {mode === 'create' && (
        <div className="add-group-form">
          <input 
            placeholder="New Group Name" 
            value={newGroupName} 
            onChange={(e) => setNewGroupName(e.target.value)} 
          />
          <button onClick={handleCreateGroup} className="primary-btn">Create</button>
        </div>
      )}

      {mode === 'join' && (
        <div className="add-group-form">
          <input 
            placeholder="Enter Invite Code (e.g. A1B2C3)" 
            value={inviteCode} 
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())} 
          />
          <button onClick={handleJoinGroup} className="primary-btn">Join</button>
        </div>
      )}

      <div className="groups-list">
        {groups.map(group => (
          <div key={group._id} className="group-item">
            <div className="group-info">
              <span className="group-name">{group.name}</span>
              <span className="group-code">Code: <b>{group.invite_code}</b></span>
              <div 
                className="member-dropdown-trigger" 
                onClick={() => toggleGroupExpand(group._id)}
              >
                <span className="member-count">{group.members?.length || 0} members</span>
                {expandedGroups[group._id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
              
              {expandedGroups[group._id] && (
                <div className="members-list">
                  {(group.memberNames || []).map((mName, idx) => (
                    <span key={idx} className="member-name-tag">{mName}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="group-actions">
              <button title="Click to share Invite Code" onClick={() => {
                navigator.clipboard.writeText(group.invite_code);
                notify(`Invite Code ${group.invite_code} copied!`);
              }}><Share2 size={16} /></button>
              <button title="Open Group Docs" onClick={() => onSelectDoc('group-' + group._id)}><FileText size={16} /></button>
              {group.owner_id === user.id && (
                <button title="Delete Group" className="delete-btn" onClick={() => handleDeleteGroup(group._id, group.name)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <span>Built with ❤️ for <strong>GUVI Hackathon 2026</strong></span>
        <a href="https://linkedin.com/in/kammarisadgurusai" target="_blank" rel="noopener noreferrer">Kammarisadgurusai</a>
      </div>
    </div>
  );
}
