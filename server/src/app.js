const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const { clients, vehicles, drivers, expenses } = require('./routes/masters');

const app = express();

app.set('trust proxy', 1); // behind Vercel's proxy: needed for rate limiting
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(','), credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public
app.use('/api/auth', require('./routes/auth'));

// Everything below is tenant-scoped via requireAuth -> req.businessId
app.use('/api', requireAuth);
app.use('/api/business', require('./routes/business'));
app.use('/api/clients', clients);
app.use('/api/vehicles', vehicles);
app.use('/api/drivers', drivers);
app.use('/api/expenses', expenses);
app.use('/api/work', require('./routes/work'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reports', require('./routes/reports'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;