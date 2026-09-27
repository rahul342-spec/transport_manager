// Business settings (spec section 3)
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const Business = require('../models/Business');

const router = express.Router();
const EDITABLE = ['name', 'phone', 'email', 'address', 'gstNumber', 'defaultGstPercent', 'invoicePrefix', 'paymentTermsDays'];

router.get('/', asyncHandler(async (req, res) => {
  res.json(await Business.findById(req.businessId).lean());
}));

router.put('/', asyncHandler(async (req, res) => {
  const update = {};
  EDITABLE.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const business = await Business.findByIdAndUpdate(req.businessId, update, { new: true, runValidators: true });
  res.json(business);
}));

module.exports = router;
