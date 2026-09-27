const express = require('express');
const mongoose = require('mongoose');
const asyncHandler = require('./asyncHandler');
const HttpError = require('./httpError');
const { assertOwned, cleanBody } = require('../services/tenant');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Generic tenant-scoped CRUD router.
 * Every query is filtered by req.businessId — there is no code path that skips it.
 *
 * opts:
 *  searchFields: fields matched by ?q=
 *  filterKeys:   query params passed straight through as equality filters
 *  dateField:    field used by ?from=&to=
 *  refs:         { clientId: [ClientModel, 'Client'] } — ownership-checked on write
 *  populate:     populate spec for reads
 *  sort:         default sort
 */
function makeCrud(Model, opts = {}) {
  const {
    searchFields = [],
    filterKeys = [],
    dateField,
    refs = {},
    populate,
    sort = { createdAt: -1 },
    beforeDelete, // async (doc, req) => throws HttpError if the record is in use
  } = opts;
  const router = express.Router();

  const checkRefs = async (body, businessId) => {
    for (const [key, [RefModel, label]] of Object.entries(refs)) {
      if (body[key] === '') body[key] = undefined;
      if (body[key]) await assertOwned(RefModel, body[key], businessId, label);
    }
  };

  const findOwned = async (req, withPopulate = false) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id');
    let q = Model.findOne({ _id: req.params.id, businessId: req.businessId });
    if (withPopulate && populate) q = q.populate(populate);
    const doc = await q;
    if (!doc) throw new HttpError(404, 'Record not found');
    return doc;
  };

  router.get('/', asyncHandler(async (req, res) => {
    const filter = { businessId: req.businessId };
    const { q, active } = req.query;
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';

    if (q && searchFields.length) {
      const rx = new RegExp(escapeRegex(String(q)), 'i');
      filter.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    if (active === 'true' || active === 'false') filter.active = active === 'true';
    filterKeys.forEach((k) => {
      // strings only — blocks operator injection like ?clientId[$ne]=x
      if (typeof req.query[k] === 'string' && req.query[k]) filter[k] = req.query[k];
    });
    if (dateField && (from || to)) {
      filter[dateField] = {};
      if (from) filter[dateField].$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setUTCHours(23, 59, 59, 999);
        filter[dateField].$lte = end;
      }
    }

    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);

    let query = Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit);
    if (populate) query = query.populate(populate);
    const [items, total] = await Promise.all([query.lean(), Model.countDocuments(filter)]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
  }));

  router.get('/:id', asyncHandler(async (req, res) => {
    res.json(await findOwned(req, true));
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const body = cleanBody(req.body);
    await checkRefs(body, req.businessId);
    const doc = await Model.create({ ...body, businessId: req.businessId });
    res.status(201).json(doc);
  }));

  router.put('/:id', asyncHandler(async (req, res) => {
    const doc = await findOwned(req);
    const body = cleanBody(req.body);
    await checkRefs(body, req.businessId);
    doc.set(body);
    await doc.save();
    res.json(doc);
  }));

  router.delete('/:id', asyncHandler(async (req, res) => {
    const doc = await findOwned(req);
    if (beforeDelete) await beforeDelete(doc, req);
    await doc.deleteOne();
    res.json({ ok: true });
  }));

  return router;
}

module.exports = { makeCrud };
