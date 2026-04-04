const express = require('express');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');
const WebSocket = require('ws');
const cors = require('cors');
const Y = require('yjs');
const helmet = require('helmet');
const fileUpload = require('express-fileupload');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

const app = express();
app.use(helmet());
app.use(cors()); // Allow all for hackathon flexibility
app.use(express.json());
app.use(fileUpload());

// Auth Routes (With deduplication)
app.post('/register', async (req, res) => {
  console.log('--- Register Attempt ---');
  try {
    const { email, password, name, organization, institute } = req.body;
    
    // 1. Check if user already exists in Auth
    const { data: existing, error: checkError } = await supabase.auth.admin.listUsers();
    const isExistent = existing?.users?.find(u => u.email === email);
    
    if (isExistent) {
      return res.status(400).json({ error: 'Account already exists. Please Sign In.' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, organization, institute }
      }
    });

    if (error) throw error;
    res.json({ user: data.user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.VITE_GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // 1. Find or create Supabase user
    const { data: list, error: listError } = await supabase.auth.admin.listUsers();
    let user = list?.users?.find(u => u.email === email);

    if (!user) {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name, avatar_url: picture },
        password: Math.random().toString(36).slice(-12) // Random pwd for social accounts
      });
      if (createError) throw createError;
      user = newUser.user;
    }

    res.json({ 
      user: { 
        id: user.id, 
        name: user.user_metadata.name, 
        email: user.email,
        avatar_url: user.user_metadata.avatar_url,
        organization: user.user_metadata.organization,
        institute: user.user_metadata.institute
      } 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    const { user } = data;
    res.json({ 
      token: data.session.access_token, 
      user: { 
        id: user.id, 
        name: user.user_metadata.name, 
        email: user.email,
        organization: user.user_metadata.organization,
        institute: user.user_metadata.institute
      } 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.CLIENT_URL || 'http://localhost:3000'
    });
    if (error) throw error;
    res.json({ message: 'Reset link sent!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/update-password', async (req, res) => {
  try {
    const { password, token } = req.body;
    
    // 1. Verify the recovery token first
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw userError;

    // 2. Use Admin API to force the password update
    const { error } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: password }
    );
    
    if (error) throw error;
    res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Password Update Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post('/upload-avatar', async (req, res) => {
  try {
    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { userId } = req.body;
    const file = req.files.avatar;
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file.data, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    res.json({ url: publicUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/update-profile', async (req, res) => {
  try {
    const { userId, name, organization, institute, avatar_url } = req.body;
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { name, organization, institute, avatar_url }
    });
    
    if (error) throw error;
    res.json({ 
      user: {
        id: data.user.id,
        name: data.user.user_metadata.name,
        email: data.user.email,
        organization: data.user.user_metadata.organization,
        institute: data.user.user_metadata.institute,
        avatar_url: data.user.user_metadata.avatar_url
      } 
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post('/update-password-admin', async (req, res) => {
  try {
    const { userId, password } = req.body;
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: password
    });
    if (error) throw error;
    res.json({ message: 'Password updated!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/groups/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get groups where user is owner OR user is in the members JSON array
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .or(`owner_id.eq.${userId}`);
    
    if (error) throw error;
    
    // Manual filtering for membership and patching missing invite codes
    const joinedGroups = [];
    for (const g of data) {
      if (g.owner_id === userId || (g.members && g.members.includes(userId))) {
        // PATCH: If group is missing an invite code, create one on the fly
        if (!g.invite_code) {
          const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          await supabase.from('groups').update({ invite_code: newCode }).eq('id', g.id);
          g.invite_code = newCode;
        }
        joinedGroups.push(g);
      }
    }

    const formattedGroups = joinedGroups.map(g => ({
      ...g,
      _id: g.id,
      members: g.members || []
    }));
    res.json(formattedGroups);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/groups', async (req, res) => {
  try {
    const { name, ownerId } = req.body;
    const invite_code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data, error } = await supabase
      .from('groups')
      .insert({ 
        name, 
        owner_id: ownerId, 
        members: [ownerId],
        invite_code 
      })
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/groups/join', async (req, res) => {
  try {
    const { inviteCode, userId } = req.body;
    
    // 1. Find group by invite code
    const { data: group, error: findError } = await supabase
      .from('groups')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();
    
    if (!group) return res.status(404).json({ error: 'Invalid invite code' });

    // 2. Add user to members
    const members = group.members || [];
    if (!members.includes(userId)) {
      members.push(userId);
      const { error: updateError } = await supabase
        .from('groups')
        .update({ members })
        .eq('id', group.id);
      
      if (updateError) throw updateError;
    }

    res.json({ message: 'Successfully joined group!', groupId: group.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', async (conn, req) => {
  const docName = req.url.slice(1) || 'default-doc';
  
  setupWSConnection(conn, req, {
    docName,
    gc: true,
  });

  const map = require('y-websocket/bin/utils').docs;
  const ydoc = map.get(docName);
  
  if (ydoc && !ydoc.isSavingSet) {
    ydoc.isSavingSet = true;
    
    // Load from Supabase Postgres
    const { data, error } = await supabase
      .from('documents')
      .select('data')
      .eq('name', docName)
      .single();
    
    if (data && data.data) {
      // Supabase returns bytea as hex string or binary, convert to Uint8Array
      const buffer = Buffer.from(data.data, 'hex');
      Y.applyUpdate(ydoc, new Uint8Array(buffer));
      console.log(`Preloaded document from Supabase: ${docName}`);
    }

    ydoc.on('update', async (update) => {
      const state = Y.encodeStateAsUpdate(ydoc);
      const { error } = await supabase
        .from('documents')
        .upsert({ 
          name: docName, 
          data: Buffer.from(state).toString('hex'),
          updated_at: new Date()
        }, { onConflict: 'name' });
      
      if (error) console.error('Supabase persistence error:', error);
    });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with SUPABASE PERSISTENCE! 🚀`);
});
