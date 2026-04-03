const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  data: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Document', DocumentSchema);
