const mongoose = require('mongoose');

let cached = global._mongo || (global._mongo = { conn: null, promise: null });

async function connectDB(uri) {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(uri, { bufferCommands: false }).catch((err) => {
      cached.promise = null; // allow a retry on the next request
      throw err;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;