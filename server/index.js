const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { setupWSConnection } = require('y-websocket/bin/utils');
const WebSocket = require('ws');
const cors = require('cors');
const mongoose = require('mongoose');
const Y = require('yjs');
const Document = require('./models/Document');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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

// API to list all documents
app.get('/documents', async (req, res) => {
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
