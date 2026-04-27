const errorHandler = (err, req, res, next) => {
  console.error('[unhandled error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
};

module.exports = errorHandler;
