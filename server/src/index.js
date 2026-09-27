require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

if (!process.env.JWT_SECRET || !process.env.MONGO_URI) {
  console.error('Missing JWT_SECRET or MONGO_URI. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  });