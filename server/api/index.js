const app = require('../src/app');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'Server not configured: set MONGO_URI and JWT_SECRET in Vercel' });
  }
  try {
    await connectDB(process.env.MONGO_URI);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    return res.status(500).json({ message: 'Database connection failed' });
  }
  return app(req, res);
};