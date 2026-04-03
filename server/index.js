const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { setupWSConnection } = require('y-websocket/bin/utils');
const WebSocket = require('ws');
const cors = require('cors');
const mongoose = require('mongoose');
const Y = require('yjs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const User = require('./models/User');
const Group = require('./models/Group');
const Document = require('./models/Document');
const auth = require('./middleware/auth');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

// Rate Limiting to prevent brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/login', limiter);
app.use('/register', limiter);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-editor';

let dbConnected = false;
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    dbConnected = true;
  })
  .catch(err => {
    console.warn('MongoDB connection failed, starting with in-memory persistence:', err.message);
  });

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Auth Routes
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, organization, institute } = req.body;
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ error: 'User already exists' });
    
    user = new User({ name, email, password, organization, institute });
    await user.save();
    
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name, email, organization, institute } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, organization: user.organization, institute: user.institute } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/forgot-password', async (req, res) => {
  // Simple mock forgot password for now
  const { email, captcha } = req.body;
  if (!captcha) return res.status(400).json({ error: 'Captcha required' });
  res.json({ message: 'Password reset link sent to your email' });
});

// Group Routes - PROTECTED
app.post('/groups', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const group = new Group({ name, owner: req.user.id, members: [req.user.id] });
    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/groups/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId !== req.user.id) return res.status(403).json({ error: 'Auth failed' });
    const groups = await Group.find({ members: req.params.userId });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API to list all documents - PROTECTED
app.get('/documents', auth, async (req, res) => {
  try {
    const docs = await Document.find({}, 'name updatedAt');
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware for persistence - fetch from DB when a doc is requested
const getYDoc = async (docName) => {
  const doc = await Document.findOne({ name: docName });
  const ydoc = new Y.Doc();
  if (doc) {
    Y.applyUpdate(ydoc, doc.data);
  }
  return ydoc;
};

wss.on('connection', async (conn, req) => {
  const docName = req.url.slice(1) || 'default-doc';
  
  // Custom connection setup 
  setupWSConnection(conn, req, {
    docName,
    gc: true,
  });

  const map = require('y-websocket/bin/utils').docs;
  const ydoc = map.get(docName);
  
  if (ydoc && !ydoc.isSavingSet) {
    ydoc.isSavingSet = true;
    
    // Load from DB if it's the first time this doc is opened in this session
    if (dbConnected) {
      const doc = await Document.findOne({ name: docName });
      if (doc) {
        Y.applyUpdate(ydoc, doc.data);
        console.log(`Preloaded document: ${docName}`);
      }
    }

    ydoc.on('update', async (update) => {
      if (dbConnected) {
        const state = Y.encodeStateAsUpdate(ydoc);
        await Document.findOneAndUpdate(
          { name: docName },
          { data: Buffer.from(state), updatedAt: new Date() },
          { upsert: true }
        );
      }
    });

    // Revision history - we can store snapshots every hour or manually
    // For this demo, persistence is handled on every update (binary) 
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
