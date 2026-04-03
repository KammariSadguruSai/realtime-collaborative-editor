import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, UserPlus, FileText } from 'lucide-react';
import './Groups.css';

const API_BASE = 'http://localhost:5000';

export default function Groups({ user, onSelectDoc }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);

  useEffect(() => {
    fetchGroups();
  }, [user]);

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${API_BASE}/groups/${user.id}`);
      setGroups(res.data);
    } catch (err) {
      console.error('Failed to fetch groups');
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      await axios.post(`${API_BASE}/groups`, { name: newGroupName, ownerId: user.id });
      setNewGroupName('');
      setShowAddGroup(false);
      fetchGroups();
    } catch (err) {
      alert('Failed to create group');
    }
  };

  return (
    <div className="groups-sidebar">
      <div className="groups-header">
        <h3><Users size={18} /> My Groups</h3>
        <button onClick={() => setShowAddGroup(!showAddGroup)} className="icon-btn">
          <Plus size={20} />
        </button>
      </div>

      {showAddGroup && (
        <div className="add-group-form">
          <input 
            placeholder="Group Name" 
            value={newGroupName} 
            onChange={(e) => setNewGroupName(e.target.value)} 
          />
          <button onClick={handleCreateGroup} className="primary-btn">Create</button>
        </div>
      )}

      <div className="groups-list">
        {groups.map(group => (
          <div key={group._id} className="group-item">
            <div className="group-info">
              <span className="group-name">{group.name}</span>
              <span className="member-count">{group.members.length} members</span>
            </div>
            <div className="group-actions">
              <button title="Invite People"><UserPlus size={16} /></button>
              <button title="Group Docs" onClick={() => onSelectDoc('group-' + group._id)}><FileText size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
