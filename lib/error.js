/**
 * Convenient replacement for the Error constructor that allows
 * supplying a cause (another error object) or a code.
 */
function Error2(message, causeOrCode) {
	let e = new Error(message);

	Error.captureStackTrace(e, Error2);

	if (causeOrCode) {
		if (typeof causeOrCode === 'object') {
			e.cause = causeOrCode;
			e.code = causeOrCode.code;
		} else if (typeof causeOrCode === 'string') {
			e.code = causeOrCode;
		}
	}

	return e;
}

/**
 * Throws an error, with optional additional message, if the error code
 * is not what was expected.
 */
function throwIfNot(expectedCode, e, message) {
	if (e.code !== expectedCode) {
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
