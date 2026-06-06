export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error(error);
  if (error.name === "ZodError") {
    return res.status(400).json({ message: error.errors?.[0]?.message || "Invalid request body", issues: error.errors });
  }
  if (error.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${error.path || "identifier"}` });
  }
  if (error.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(error.errors || {})[0]?.message || "Validation failed" });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "Duplicate record", fields: Object.keys(error.keyPattern || {}) });
  }
  const status = error.status || 500;
  res.status(status).json({ message: error.message || "Server error" });
}
