// @ts-check
'use strict';

class Error2 extends Error {
	/**
	 * Convenient replacement for the Error constructor that allows
	 * supplying a cause (another error object) or a code.
	 *
	 * @param {string} message Error message
	 * @param {Error | string} [causeOrCode] Error cause or code
	 */
	constructor(message, causeOrCode) {
		super(message);

		Error.captureStackTrace(this, Error2);

		if (causeOrCode) {
			if (typeof causeOrCode === 'object') {
				this.cause = causeOrCode;
				this.code = causeOrCode['code'];
			} else if (typeof causeOrCode === 'string') {
				this.code = causeOrCode;
			}
		}
	}
}

/**
 * Throws an error, with optional additional message, if the error code
 * is not what was expected.
 *
 * @param {string} expectedCode
 * @param {Error} e
 * @param {string} [message]
 */
function throwIfNot(expectedCode, e, message) {
	if (e['code'] !== expectedCode) {
		if (message) {
			e = new Error2(message, e);
		}

		Error.captureStackTrace(e, throwIfNot);
		throw e;
	}
}
Error2.throwIfNot = throwIfNot;

// Common error code string constants.
Error2.EEXIST = 'EEXIST';
Error2.ENOENT = 'ENOENT';
Error2.EPERM = 'EPERM';
Error2.EACCES = 'EACCES';
Error2.EIO = 'EIO';

module.exports = Error2;
