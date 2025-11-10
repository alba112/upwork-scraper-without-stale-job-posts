'use strict';

const { URL } = require('url');
const cheerio = require('cheerio');
const { fetchWithProxies } = require('./proxyHandler');
const { buildCookieHeader } = require('./cookieManager');
const { normalizeRelativeDate, isWithinLast24Hours } = require('../utils/dateNormalizer');
const { deduplicateJobs } = require('../utils/deduplication');

const DEFAULT_USER_AGENT =
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
'(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function sleep(ms) {
return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
const low = Math.ceil(min);
const high = Math.floor(max);
return Math.floor(Math.random() * (high - low + 1)) + low;
}

function buildHeaders(cookiesConfig) {
const headers = {
'User-Agent': DEFAULT_USER_AGENT,
'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
'Accept-Language': 'en-US,en;q=0.9',
'Connection': 'keep-alive',
};

const cookieHeader = buildCookieHeader(cookiesConfig);
if (cookieHeader) {
headers.Cookie = cookieHeader;
}

return headers;
}

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

function parseJobsFromHtml(html, searchUrl, logLevel = 'info') {
const $ = cheerio.load(html);
const jobs = [];

// Upwork changes selectors occasionally, so we try a couple of patterns.
const jobCards =
$('article[data-test="job-tile"]') // modern layout
.toArray()
.concat($('.up-card-section[data-test="job-tile"]').toArray()); // fallback

if (jobCards.length === 0) {
log('warn', logLevel, 'No job cards detected in HTML. Markup may have changed.');
}

jobCards.forEach((elem) => {
const card = $(elem);

const title =
card.find('a[data-test="job-title-link"]').text().trim() ||
card.find('h4').first().text().trim() ||
'';

let link =
card.find('a[data-test="job-title-link"]').attr('href') ||
card.find('a[href*="/job/"]').attr('href') ||
'';

if (link && !/^https?:\/\//i.test(link)) {
try {
link = new URL(link, 'https://www.upwork.com').toString();
} catch {
// ignore malformed URLs
}
}

const shortBio =
card.find('[data-test="job-description-text"]').text().trim() ||
card.find('p').first().text().trim() ||
'';

const paymentType =
card.find('[data-test="job-type"]').text().trim() ||
card.find('strong:contains("Hourly"),strong:contains("Fixed")').text().trim() ||
'';

const budget =
card.find('[data-test="job-budget"]').text().trim() ||
card.find('span:contains("Budget")').next('span').text().trim() ||
'';

const projectLength =
card.find('[data-test="job-length"]').text().trim() ||
card.find('span:contains("Duration")').next('span').text().trim() ||
'';

const skills = [];
card
.find('[data-test="token"]')
.toArray()
.forEach((s) => {
const text = $(s).text().trim();
if (text) skills.push(text);
});

if (skills.length === 0) {
card
.find('a.o-tag-skill')
.toArray()
.forEach((s) => {
const text = $(s).text().trim();
if (text) skills.push(text);
});
}

let publishedDate =
card.find('span[data-test="job-pub-date"]').text().trim() ||
card.find('span:contains("Posted")').first().text().trim() ||
'';

if (!publishedDate && card.find('time').length > 0) {
publishedDate = card.find('time').first().text().trim();
}

const normalizedDate = normalizeRelativeDate(publishedDate);

const job = {
title,
link,
paymentType,
budget,
projectLength,
shortBio,
skills,
publishedDate,
normalizedDate,
searchUrl,
};

jobs.push(job);
});

log('debug', logLevel, `Parsed ${jobs.length} jobs from HTML`);
return jobs;
}

/**
* Extracts jobs from an Upwork search URL.
* @param {string} searchUrl
* @param {object} options
*/
async function extractJobsFromSearch(searchUrl, options = {}) {
const {
maxPages = 1,
proxies = [],
cookies = {},
minDelayMs = 1000,
maxDelayMs = 2500,
logLevel = 'info',
timeoutMs = 20000,
} = options;

const headers = buildHeaders(cookies);
const allJobs = [];

for (let page = 1; page <= maxPages; page += 1) {
let urlToFetch = searchUrl;

try {
const urlObj = new URL(searchUrl);
urlObj.searchParams.set('page', String(page));
urlToFetch = urlObj.toString();
} catch {
// If searchUrl is not a valid URL, just append a page parameter crudely
const joinChar = searchUrl.includes('?') ? '&' : '?';
urlToFetch = `${searchUrl}${joinChar}page=${page}`;
}

log('info', logLevel, `Fetching page ${page}/${maxPages}`, { url: urlToFetch });

let html;
try {
html = await fetchWithProxies(urlToFetch, proxies, headers, timeoutMs, logLevel);
} catch (err) {
log('error', logLevel, `Failed to fetch page ${page}: ${err.message || err}`);
continue;
}

const pageJobs = parseJobsFromHtml(html, searchUrl, logLevel);
const now = new Date();

const freshJobs = pageJobs.filter((job) => {
if (!job.normalizedDate) return false;
const within24h = isWithinLast24Hours(job.normalizedDate, now);
if (!within24h) {
log('debug', logLevel, 'Filtered stale job', {
title: job.title,
publishedDate: job.publishedDate,
normalizedDate: job.normalizedDate,
});
}
return within24h;
});

log('info', logLevel, `Found ${pageJobs.length} jobs, ${freshJobs.length} are fresh (<= 24h)`);

allJobs.push(...freshJobs);

if (page < maxPages) {
const delay = randomInt(minDelayMs, maxDelayMs);
log('debug', logLevel, `Sleeping for ${delay}ms before next page`);
await sleep(delay);
}
}

const uniqueJobs = deduplicateJobs(allJobs, logLevel);
log('info', logLevel, `De-duplicated to ${uniqueJobs.length} jobs total`);

return uniqueJobs;
}

module.exports = {
extractJobsFromSearch,
parseJobsFromHtml, // exported for potential testing
};