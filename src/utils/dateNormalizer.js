'use strict';

/**
 * Normalizes Upwork-style relative timestamps into ISO strings.
 * Examples:
 * - "Posted 6 minutes ago"
 * - "Posted 1 hour ago"
 * - "Just now"
 * - "30+ days ago"
 * - Raw ISO "2025-01-20T13:34:01.384Z"
 * @param {string} input
 * @param {Date} [referenceDate]
 * @returns {string|null}
 */
function normalizeRelativeDate(input, referenceDate = new Date()) {
  if (!input || typeof input !== 'string') return null;

  const text = input.trim();

  // If it's already an ISO-ish date, just try parsing
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  let normalized = text.toLowerCase();
  normalized = normalized.replace(/^posted\s+/i, '').trim();

  if (normalized === 'just now') {
    return referenceDate.toISOString();
  }

  if (/^\d+\+?\s+days?\s+ago$/.test(normalized)) {
    const match = normalized.match(/^(\d+)\+?\s+days?\s+ago$/);
    const days = match ? Number(match[1]) : 1;
    const date = new Date(referenceDate.getTime() - days * 24 * 60 * 60 * 1000);
    return date.toISOString();
  }

  const relMatch = normalized.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
  if (relMatch) {
    const value = Number(relMatch[1]);
    const unit = relMatch[2];

    const multipliers = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };

    const ms = value * (multipliers[unit] || 0);
    if (ms > 0) {
      const date = new Date(referenceDate.getTime() - ms);
      return date.toISOString();
    }
  }

  // Fallback: try parsing directly
  const fallback = new Date(text);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString();
  }

  return null;
}

/**
 * Returns true if the given ISO date string is within the last 24 hours
 * relative to referenceDate.
 * @param {string} isoString
 * @param {Date} [referenceDate]
 */
function isWithinLast24Hours(isoString, referenceDate = new Date()) {
  if (!isoString) return false;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return false;

  const diffMs = referenceDate.getTime() - date.getTime();
  if (diffMs < 0) return false; // future
  const dayMs = 24 * 60 * 60 * 1000;
  return diffMs <= dayMs;
}

module.exports = {
  normalizeRelativeDate,
  isWithinLast24Hours,
};