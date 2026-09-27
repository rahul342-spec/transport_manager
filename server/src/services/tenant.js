const mongoose = require('mongoose');
const HttpError = require('../utils/httpError');

// Confirms a referenced record (client, vehicle, driver...) belongs to the same business.
async function assertOwned(Model, id, businessId, label) {
  if (!id) return null;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`);
  const doc = await Model.findOne({ _id: id, businessId });
  if (!doc) throw new HttpError(400, `${label} not found`);
  return doc;
}

// Removes fields a client must never set directly
function cleanBody(body, extraReadonly = []) {
  const blocked = ['_id', 'businessId', 'createdAt', 'updatedAt', '__v', ...extraReadonly];
  const out = { ...body };
  blocked.forEach((k) => delete out[k]);
  return out;
}

module.exports = { assertOwned, cleanBody };
