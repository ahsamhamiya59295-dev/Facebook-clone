import AppError from '../utils/AppError.js';

export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, _next) => {
  let { statusCode = 500, message = 'Something went wrong' } = err;

  // Prisma known errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this value already exists';
  } else if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  } else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid request data';
  } else if (err.name === 'MulterError') {
    statusCode = err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FIELD_VALUE' ? 413 : 400;
    message = err.message;
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body too large';
  } else if (err.type === 'entity.parse.failed' || err.type === 'entity.aborted') {
    statusCode = 400;
    message = 'Invalid request body';
  }

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  const payload = { success: false, message };
  if (err.details) payload.details = err.details;

  res.status(statusCode).json(payload);
};

export const notFound = notFoundHandler;
export default errorHandler;