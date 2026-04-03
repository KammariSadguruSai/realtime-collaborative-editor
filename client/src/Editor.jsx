import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Quill from 'quill';
import { QuillBinding } from 'y-quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';
import './Editor.css';

Quill.register('modules/cursors', QuillCursors);

const getRandomColor = () => {
    const colors = ['#f44336', '#e91e63', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
};

const Editor = ({ docId = 'default-doc', user }) => {
    const editorRef = useRef(null);
    const quillRef = useRef(null);
    const [users, setUsers] = useState([]);
    const [status, setStatus] = useState('connecting');

    // Use consistent color for user based on their name
    const memoizedColor = React.useMemo(() => getRandomColor(), [user?.name]);

    useEffect(() => {
        let isMounted = true;
        const ydoc = new Y.Doc();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${window.location.hostname}:5000`;
        const provider = new WebsocketProvider(
            wsUrl,
            docId,
            ydoc
        );

        const ytext = ydoc.getText('quill');

        const quill = new Quill(editorRef.current, {
            theme: 'snow',
            modules: {
                cursors: true,
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    ['link', 'image'],
                    ['clean'],
                ],
                history: {
                    userOnly: true
                }
            },
            placeholder: 'Start writing something amazing...'
        });
        quillRef.current = quill;

        const binding = new QuillBinding(ytext, quill, provider.awareness);

        const localUser = {
            name: user?.name || `Guest-${Math.floor(Math.random() * 1000)}`,
            color: memoizedColor
        };

        // Important: Set local state for cursors/presence
        provider.awareness.setLocalStateField('user', localUser);

        provider.on('status', (event) => {
            if (isMounted) setStatus(event.status);
        });

        provider.awareness.on('change', () => {
            if (!isMounted) return;
            const awarenessStates = Array.from(provider.awareness.getStates().values());
            const uniqueUsers = [];
            const namesSeen = new Set();
            
            awarenessStates.forEach(s => {
                if (s.user && !namesSeen.has(s.user.name)) {
                    uniqueUsers.push(s.user);
                    namesSeen.add(s.user.name);
                }
            });
            
            setUsers(uniqueUsers);
        });

        return () => {
            isMounted = false;
            provider.disconnect();
            binding.destroy();
            ydoc.destroy();
            // Clear quill instance
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
        };
    }, [docId, user, memoizedColor]);

    return (
        <div className="editor-container">
            <div className="editor-header">
                <div className="status-badge" data-status={status}>
                    {status === 'connected' ? 'Online' : status === 'connecting' ? 'Connecting' : 'Offline'}
                </div>
                <div className="presence-list">
                    {users.map((u, idx) => (
                        <div 
                            key={idx} 
                            className="user-avatar" 
                            style={{ backgroundColor: u.color }}
                            title={u.name}
                        >
                            {u.name.charAt(0).toUpperCase()}
                            <div className="avatar-tooltip">{u.name}</div>
                        </div>
                    ))}
                    <div className="user-count">{users.length} active</div>
                </div>
            </div>
            <div className="editor-wrapper">
                <div ref={editorRef} />
            </div>
        </div>
    );
};

export default Editor;
