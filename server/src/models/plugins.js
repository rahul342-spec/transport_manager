const mongoose = require('mongoose');

// Every business-owned document carries businessId (spec section 17).
function tenantPlugin(schema) {
  schema.add({
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  });
}

const baseOptions = { timestamps: true };

module.exports = { tenantPlugin, baseOptions };
