'use strict';

const fs = require('fs');
const path = require('path');
const { extractJobsFromSearch } = require('./modules/jobExtractor');

// Try to load config; fall back to sensible defaults if missing
let config = {};
const configPath = path.join(__dirname, 'config', 'settings.example.json');

try {
const raw = fs.readFileSync(configPath, 'utf-8');
config = JSON.parse(raw);
} catch (err) {
console.warn(`[WARN] Could not read config at ${configPath}. Using minimal defaults.`);
config = {
searchUrl: process.env.UPWORK_SEARCH_URL || '',
maxPages: 1,
minDelayMs: 1000,
maxDelayMs: 2500,
proxies: [],
cookies: {},
logLevel: 'info',
outputPath: path.join(__dirname, '..', 'data', 'output.sample.json'),
};
}

function resolveSearchUrl() {
const cliArg = process.argv[2];
const envVar = process.env.UPWORK_SEARCH_URL;

return cliArg || envVar || config.searchUrl || '';
}

function resolveOutputPath() {
const cliArg = process.argv[3];
const envVar = process.env.UPWORK_OUTPUT_PATH;

if (cliArg) return path.resolve(cliArg);
if (envVar) return path.resolve(envVar);
if (config.outputPath) return path.resolve(path.join(__dirname, '..', config.outputPath));

return path.resolve(path.join(__dirname, '..', 'data', 'output.sample.json'));
}

async function main() {
const searchUrl = resolveSearchUrl();
const outputPath = resolveOutputPath();

if (!searchUrl) {
console.error(
'[ERROR] No search URL provided. Pass it as:\n' +
'  node src/main.js "https://www.upwork.com/nx/jobs/search/?q=web%20developer"\n' +
'or set the UPWORK_SEARCH_URL environment variable or searchUrl in config/settings.example.json'
);
process.exitCode = 1;
return;
}

console.log(`[INFO] Starting Upwork scraper`);
console.log(`[INFO] Search URL: ${searchUrl}`);
console.log(`[INFO] Output path: ${outputPath}`);

try {
const jobs = await extractJobsFromSearch(searchUrl, {
maxPages: Number(config.maxPages) || 1,
minDelayMs: Number(config.minDelayMs) || 1000,
maxDelayMs: Number(config.maxDelayMs) || 2500,
proxies: Array.isArray(config.proxies) ? config.proxies : [],
cookies: config.cookies || {},
logLevel: config.logLevel || 'info',
});

// Ensure output directory exists
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(outputPath, JSON.stringify(jobs, null, 2), 'utf-8');
console.log(`[INFO] Wrote ${jobs.length} fresh, de-duplicated jobs to ${outputPath}`);
} catch (err) {
console.error('[ERROR] Scraper failed:', err.message || err);
process.exitCode = 1;
}
}

if (require.main === module) {
main();
}

module.exports = { main };