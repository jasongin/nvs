// @ts-check
'use strict';

const { http, https } = require('../deps/node_modules/follow-redirects/index');
const { HttpProxyAgent } = require('../deps/node_modules/http-proxy-agent/dist/index');
const { HttpsProxyAgent } = require('../deps/node_modules/https-proxy-agent/dist/index');

/**
 * Sends an HTTP or HTTPS GET request, using proxy settings and following redirects.
 * @param {import('url').URL} url
 * @param {import('http').RequestOptions} opt
 * @param {(res: import('http').IncomingMessage) => void} cb
 * @returns {import('http').ClientRequest}
 */
function httpGet(url, opt, cb) {
	opt = opt || {};
	const secure = url.protocol === 'https:';
	const proxy = secure
		? process.env.https_proxy || process.env.HTTPS_PROXY
		: process.env.http_proxy || process.env.HTTP_PROXY;
	const Agent = secure ? HttpsProxyAgent : HttpProxyAgent;
	if (proxy) opt.agent = new Agent(proxy);
	return secure ? https.get(url, opt, cb) : http.get(url, opt, cb);
}

module.exports = {
	httpGet,
};
