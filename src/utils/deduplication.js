'use strict';

function log(level, logLevel, message, meta) {
  const levels = ['error', 'warn', 'info', 'debug'];
  const currentIdx = levels.indexOf(logLevel);
  const messageIdx = levels.indexOf(level);

  if (messageIdx <= currentIdx || currentIdx === -1) {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
    if (meta) {
      console.log(base, meta);
    } else {
      console.log(base);
    }
  }
}

/**
 * De-duplicates job objects by link (primary) and title+budget+projectLength (secondary).
 * When duplicates are found, skills are merged.
 * @param {Array<object>} jobs
 * @param {string} [logLevel]
 */
function deduplicateJobs(jobs, logLevel = 'info') {
  const byKey = new Map();

  for (const job of jobs) {
    if (!job) continue;

    const primaryKey = job.link || '';
    const secondaryKey = `${job.title || ''}|${job.budget || ''}|${job.projectLength || ''}`;

    let key = primaryKey || secondaryKey;
    if (!key) {
      // Completely anonymous entry, just push under a unique key
      key = `anon-${byKey.size + 1}`;
    }

    if (!byKey.has(key)) {
      // Clone job to avoid accidental mutation
      const clone = { ...job };
      clone.skills = Array.isArray(job.skills) ? [...job.skills] : [];
      byKey.set(key, clone);
    } else {
      const existing = byKey.get(key);

      // Merge skills
      const existingSkills = new Set(existing.skills || []);
      (job.skills || []).forEach((s) => existingSkills.add(s));
      existing.skills = Array.from(existingSkills);

      // Prefer the most recent normalizedDate
      if (job.normalizedDate && existing.normalizedDate) {
        const existingDate = new Date(existing.normalizedDate);
        const newDate = new Date(job.normalizedDate);
        if (!Number.isNaN(newDate.getTime()) && newDate > existingDate) {
          existing.normalizedDate = job.normalizedDate;
          existing.publishedDate = job.publishedDate || existing.publishedDate;
        }
      } else if (job.normalizedDate && !existing.normalizedDate) {
        existing.normalizedDate = job.normalizedDate;
        existing.publishedDate = job.publishedDate || existing.publishedDate;
      }

      log('debug', logLevel, 'Merged duplicate job', {
        title: existing.title,
        link: existing.link,
      });
    }
  }

  return Array.from(byKey.values());
}

module.exports = {
  deduplicateJobs,
};