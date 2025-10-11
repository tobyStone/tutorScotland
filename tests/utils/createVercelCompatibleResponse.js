/**
 * Creates a Vercel-compatible response object for testing
 * Ensures proper Content-Type headers with UTF-8 charset for security
 * 
 * @param {Object} res - Base response object to enhance
 * @returns {Object} Enhanced response object with Vercel-compatible methods
 */
function createVercelCompatibleResponse(res) {
  if (!res || typeof res !== 'object') {
    throw new TypeError('Expected a response object to enhance');
  }

  // Add status method if missing
  if (typeof res.status !== 'function') {
    res.status = function status(code) {
      res.statusCode = code;
      return res;
    };
  }

  // Add json method with proper Content-Type and charset
  if (typeof res.json !== 'function') {
    res.json = function json(payload) {
      const body = JSON.stringify(payload ?? null);
      // ✅ SECURITY FIX: Explicit UTF-8 charset prevents encoding attacks
      res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
      res.end(body);
      return res;
    };
  }

  // Add send method with proper Content-Type handling
  if (typeof res.send !== 'function') {
    res.send = function send(payload) {
      if (payload === undefined) {
        res.end();
        return res;
      }

      if (Buffer.isBuffer(payload) || typeof payload === 'string') {
        // ✅ SECURITY FIX: Set text/plain with UTF-8 for string/Buffer content
        if (!res.getHeader?.('Content-Type')) {
          res.setHeader?.('Content-Type', 'text/plain; charset=utf-8');
        }
        res.end(payload);
        return res;
      }

      // For objects, reuse json logic with proper charset
      res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload ?? null));
      return res;
    };
  }

  // Add removeHeader method if missing
  if (typeof res.removeHeader !== 'function') {
    res.removeHeader = function removeHeader(name) {
      if (res.headers && typeof res.headers === 'object') {
        delete res.headers[name];
      }
      return res;
    };
  }

  return res;
}

module.exports = createVercelCompatibleResponse;
module.exports.createVercelCompatibleResponse = createVercelCompatibleResponse;
