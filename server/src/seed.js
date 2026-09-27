// Demo data: `npm run seed` -> login demo@transport.test / demo12345
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Business = require('./models/Business');
const Client = require('./models/Client');
const Vehicle = require('./models/Vehicle');
const Driver = require('./models/Driver');
const WorkEntry = require('./models/WorkEntry');
const Payment = require('./models/Payment');
const Expense = require('./models/Expense');
const { syncWorkEntry } = require('./services/payments');

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const day = (offset) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offset);
  return d;
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const email = 'demo@transport.test';
  const existing = await User.findOne({ email });
  if (existing) {
    const businessId = existing.businessId;
    await Promise.all([Client, Vehicle, Driver, WorkEntry, Payment, Expense, User]
      .map((M) => M.deleteMany({ businessId })));
    await Business.deleteOne({ _id: businessId });
  }

  const business = await Business.create({
    name: 'Sharma Transport Co.', phone: '98100 00000', email,
    address: 'Plot 12, Transport Nagar, Delhi', invoicePrefix: 'STC', paymentTermsDays: 15,
  });
  const businessId = business._id;
  await User.create({ businessId, name: 'Demo Owner', email, passwordHash: await User.hashPassword('demo12345') });

  const clients = await Client.insertMany([
    { businessId, name: 'Gupta Builders', contactPerson: 'R. Gupta', phone: '98111 11111' },
    { businessId, name: 'Metro Cement Depot', contactPerson: 'S. Khan', phone: '98222 22222' },
    { businessId, name: 'Singh Agro Mills', contactPerson: 'H. Singh', phone: '98333 33333' },
  ]);
  const vehicles = await Vehicle.insertMany([
    { businessId, vehicleNumber: 'DL01GC1234', type: 'Tipper' },
    { businessId, vehicleNumber: 'DL01GC5678', type: 'JCB' },
    { businessId, vehicleNumber: 'HR55AB9012', type: 'Truck' },
  ]);
  const drivers = await Driver.insertMany([
    { businessId, name: 'Ramesh Kumar', phone: '97000 00001', salary: 18000 },
    { businessId, name: 'Suresh Yadav', phone: '97000 00002', salary: 17000 },
    { businessId, name: 'Mohan Lal', phone: '97000 00003', salary: 16000 },
  ]);

  const places = ['Okhla Phase 2', 'Noida Sec 62', 'Gurgaon Sec 44', 'Faridabad NIT', 'Narela Industrial Area'];
  for (let i = 0; i < 120; i += 1) {
    const offset = Math.floor(i * 1.5);
    const start = 7 + Math.floor(Math.random() * 4);
    const hrs = 4 + Math.floor(Math.random() * 6);
    const amount = hrs * pick([900, 1100, 1300, 1500]);
    const work = await WorkEntry.create({
      businessId, date: day(offset), clientId: pick(clients)._id, location: pick(places),
      vehicleId: pick(vehicles)._id, driverId: pick(drivers)._id,
      startTime: `${String(start).padStart(2, '0')}:00`, endTime: `${String(start + hrs).padStart(2, '0')}:00`,
      amount,
    });
    const r = Math.random();
    const paid = offset > 20 ? (r < 0.8 ? amount : r < 0.9 ? Math.round(amount / 2) : 0)
      : (r < 0.4 ? amount : r < 0.6 ? Math.round(amount / 2) : 0);
    if (paid > 0) {
      await Payment.create({ businessId, clientId: work.clientId, workEntryId: work._id, amount: paid,
        date: day(Math.max(offset - 3, 0)), method: pick(['Cash', 'UPI', 'Bank Transfer']) });
      await syncWorkEntry(work._id, businessId);
    }
  }

  for (let m = 0; m < 6; m += 1) {
    for (let d = 0; d < 12; d += 1) {
      await Expense.create({ businessId, date: day(m * 30 + d * 2), category: 'Diesel',
        amount: pick([4500, 5200, 6100]), vehicleId: pick(vehicles)._id, description: 'Diesel fill' });
    }
    for (const dr of drivers) {
      await Expense.create({ businessId, date: day(m * 30 + 1), category: 'Salary', amount: dr.salary,
        driverId: dr._id, description: `Salary — ${dr.name}` });
    }
    await Expense.create({ businessId, date: day(m * 30 + 10), category: 'Maintenance', amount: pick([3500, 8000, 12000]),
      vehicleId: pick(vehicles)._id, description: 'Service / repair' });
    await Expense.create({ businessId, date: day(m * 30 + 5), category: 'Toll/Parking', amount: pick([1200, 1800]),
      description: 'FASTag recharge' });
  }

  console.log('Seeded. Login: demo@transport.test / demo12345');
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
