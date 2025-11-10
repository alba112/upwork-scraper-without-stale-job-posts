'use strict';

const axios = require('axios');

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
* Builds an axios request config for a specific proxy.
* @param {string} url
* @param {object|null} proxyConfig
* @param {object} headers
* @param {number} timeoutMs
* @returns {object}
*/
function buildAxiosRequestConfig(url, proxyConfig, headers, timeoutMs) {
const config = {
method: 'get',
url,
headers: { ...headers },
timeout: timeoutMs,
maxRedirects: 5,
validateStatus: (status) => status >= 200 && status < 400,
}

if (proxyConfig && proxyConfig.host && proxyConfig.port) {
const proxy = {
protocol: proxyConfig.protocol || 'http',
host: proxyConfig.host,
port: Number(proxyConfig.port),
};

if (proxyConfig.auth && proxyConfig.auth.username && proxyConfig.auth.password) {
proxy.auth = {
username: proxyConfig.auth.username,
password: proxyConfig.auth.password,
};
}

config.proxy = proxy;
} else {
// Disable axios proxy handling if we don't have a proxy
config.proxy = false;
}

return config;
}

/**
* Attempts a single fetch using the specified proxy config.
* @param {string} url
* @param {object|null} proxyConfig
* @param {object} headers
* @param {number} timeoutMs
* @param {string} logLevel
*/
async function fetchWithProxy(url, proxyConfig, headers, timeoutMs, logLevel) {
const label =
proxyConfig && (proxyConfig.label || `${proxyConfig.host}:${proxyConfig.port}`) || 'direct';

log('debug', logLevel, `Attempting request via ${label}`);

const config = buildAxiosRequestConfig(url, proxyConfig, headers, timeoutMs);
const response = await axios(config);

log('debug', logLevel, `Received response via ${label}`, {
status: response.status,
url: response.request && response.request.res && response.request.res.responseUrl,
});

return response.data;
}

/**
* Fetches a URL trying each enabled proxy and finally a direct connection.
* @param {string} url
* @param {Array<object>} proxies
* @param {object} headers
* @param {number} timeoutMs
* @param {string} logLevel
*/
async function fetchWithProxies(url, proxies = [], headers = {}, timeoutMs = 20000, logLevel = 'info') {
const enabledProxies = Array.isArray(proxies)
? proxies.filter((p) => p && p.enabled !== false && p.host && p.port)
: [];

const attempts = [...enabledProxies, null]; // null means direct

let lastError;

for (const proxyConfig of attempts) {
try {
const data = await fetchWithProxy(url, proxyConfig, headers, timeoutMs, logLevel);
return data;
} catch (err) {
lastError = err;
const label =
proxyConfig && (proxyConfig.label || `${proxyConfig.host}:${proxyConfig.port}`) || 'direct';
log('warn', logLevel, `Request via ${label} failed: ${err.message || err}`);
}
}

throw lastError || new Error('All proxy attempts failed');
}

module.exports = {
fetchWithProxies,
fetchWithProxy,
buildAxiosRequestConfig,
};