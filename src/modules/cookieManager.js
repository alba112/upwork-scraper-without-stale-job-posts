'use strict';

/**
 * Builds a Cookie header string from a config value.
 * - If the value is already a string, it is returned as-is.
 * - If it's an object, keys are joined as "key=value" pairs.
 * @param {object|string} cookiesConfig
 * @returns {string}
 */
function buildCookieHeader(cookiesConfig) {
  if (!cookiesConfig) return '';

  if (typeof cookiesConfig === 'string') {
    return cookiesConfig.trim();
  }

  if (typeof cookiesConfig === 'object') {
    const parts = [];
    for (const [key, value] of Object.entries(cookiesConfig)) {
      if (value === undefined || value === null || value === '') continue;
      parts.push(`${key}=${value}`);
    }
    return parts.join('; ');
  }

  return '';
}

/**
 * Masks a cookie header for logging so sensitive data isn't visible.
 * @param {string} cookieHeader
 */
function maskCookieHeader(cookieHeader) {
  if (!cookieHeader) return '';

  return cookieHeader
    .split(';')
    .map((pair) => {
      const [key] = pair.split('=');
      return `${key.trim()}=***`;
    })
    .join('; ');
}

module.exports = {
  buildCookieHeader,
  maskCookieHeader,
};