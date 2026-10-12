export const HttpMethod = Object.freeze({
  Get: 'GET',
  Put: 'PUT',
});

export const HttpStatus = Object.freeze({
  Ok: 200,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  Conflict: 409,
  PayloadTooLarge: 413,
  InternalServerError: 500,
  ServiceUnavailable: 503,
});
