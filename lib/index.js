// NVS (node version switcher) startup script

// @ts-check
'use strict';

// Caution: This module may be loaded by an older Node version in upgrade scenarios,
// so it MUST NOT use newer JS syntax such as `await`, `spread`, etc. (All other modules
// are guaranteed to be parsed using the configured Node version, because they are
// loaded after this version check.)

const defaults = require('../defaults.json');
if (process.version !== ('v' + defaults.bootstrap.split('/')[1])) {
	// Shell scripts should interpret this exit code as "invalid node version".
	process.exit(2);
}

require('./main');
