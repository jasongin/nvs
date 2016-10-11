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
};

module.exports = Error2;
