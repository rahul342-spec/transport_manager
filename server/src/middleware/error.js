function notFound(req, res) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = `Already exists: ${Object.keys(err.keyValue || {}).filter((k) => k !== 'businessId').join(', ')}`;
  }

  if (status >= 500) console.error(err);
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
