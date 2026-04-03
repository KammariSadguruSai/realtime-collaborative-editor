const express = require('express');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');
const WebSocket = require('ws');
const cors = require('cors');
const Y = require('yjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();
app.use(helmet());
app.use(cors()); // Allow all for hackathon flexibility
app.use(express.json());

// Auth Routes (With debugging)
app.post('/register', async (req, res) => {
  console.log('--- Register Attempt ---');
  console.log('Payload:', req.body);
  try {
    const { email, password, name, organization, institute } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, organization, institute }
      }
    });

    if (error) {
      console.error('Supabase Sign-Up Error:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    console.log('Sign-Up Success:', data.user?.id);
    res.json({ user: data.user });
  } catch (err) {
    console.error('Unexpected Internal Error:', err);
    res.status(500).json({ error: err.message });
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
    const { data, error } = await supabase.auth.updateUser({
      password: password
    }, {
      access_token: token
    });
    if (error) throw error;
    res.json({ message: 'Password updated successfully!' });
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
