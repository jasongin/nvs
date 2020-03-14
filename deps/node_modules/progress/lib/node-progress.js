/*!
 * node-progress
 * Copyright(c) 2011 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Expose `ProgressBar`.
 */

exports = module.exports = ProgressBar;

/**
 * Initialize a `ProgressBar` with the given `fmt` string and `options` or
 * `total`.
 *
 * Options:
 *
 *   - `total` total number of ticks to complete
 *   - `width` the displayed width of the progress bar defaulting to total
 *   - `stream` the output stream defaulting to stderr
 *   - `complete` completion character defaulting to "="
 *   - `incomplete` incomplete character defaulting to "-"
 *   - `renderThrottle` minimum time between updates in milliseconds defaulting to 16
 *   - `callback` optional function to call when the progress bar completes
 *   - `clear` will clear the progress bar upon termination
 *
 * Tokens:
 *
 *   - `:bar` the progress bar itself
 *   - `:current` current tick number
 *   - `:total` total ticks
 *   - `:elapsed` time elapsed in seconds
 *   - `:percent` completion percentage
 *   - `:eta` eta in seconds
 *
 * Tokens other than `:bar` may include a suffix to specify width, that is a minus
 * (for left-padding) or plus (for right-padding) followed by an integer, for example
 * `:percent-4`.
 *
 * @param {string} fmt
 * @param {object|number} options or total
 * @api public
 */

function ProgressBar(fmt, options) {
  this.stream = options.stream || process.stderr;

  if (typeof(options) == 'number') {
    var total = options;
    options = {};
    options.total = total;
  } else {
    options = options || {};
    if ('string' != typeof fmt) throw new Error('format required');
    if ('number' != typeof options.total) throw new Error('total required');
  }

  this.fmt = fmt;
  this.curr = 0;
  this.total = options.total;
  this.width = options.width || this.total;
  this.clear = options.clear
  this.chars = {
    complete   : options.complete || '=',
    incomplete : options.incomplete || '-'
  };
  this.renderThrottle = options.renderThrottle !== 0 ? (options.renderThrottle || 16) : 0;
  this.callback = options.callback || function () {};
  this.tokens = {};
  this.lastDraw = '';
}

/**
 * "tick" the progress bar with optional `len` and optional `tokens`.
 *
 * @param {number|object} len or tokens
 * @param {object} tokens
 * @api public
 */

ProgressBar.prototype.tick = function(len, tokens){
  if (len !== 0)
    len = len || 1;

  // swap tokens
  if ('object' == typeof len) tokens = len, len = 1;
  if (tokens) this.tokens = tokens;

  // start time for eta
  if (0 == this.curr) this.start = new Date;

  this.curr += len

  // schedule render
  if (!this.renderThrottleTimeout) {
    this.renderThrottleTimeout = setTimeout(this.render.bind(this), this.renderThrottle);
  }

  // progress complete
  if (!this.complete && this.curr >= this.total) {
    if (this.renderThrottleTimeout) this.render();
    this.complete = true;
    this.terminate();
    this.callback(this);
    return;
  }
};

/**
 * Method to render the progress bar with optional `tokens` to place in the
 * progress bar's `fmt` field.
 *
 * @param {object} tokens
 * @api public
 */

ProgressBar.prototype.render = function (tokens) {
  clearTimeout(this.renderThrottleTimeout);
  this.renderThrottleTimeout = null;

  if (tokens) this.tokens = tokens;

  if (!this.stream.isTTY) return;

  var ratio = this.curr / this.total;
  ratio = Math.min(Math.max(ratio, 0), 1);

  var percent = ratio * 100;
  var incomplete, complete, completeLength;
  var elapsed = new Date - this.start;
  var eta = (percent == 100) ? 0 : elapsed * (this.total / this.curr - 1);

  /* populate the bar template with percentages and timestamps */
  var str = this.fmt;
  str = replaceToken(str, 'current', this.curr);
  str = replaceToken(str, 'total', this.total);
  str = replaceToken(str, 'elapsed', isNaN(elapsed) ? '0.0'
    : elapsed >= 10000 ? Math.round(elapsed / 1000) : (elapsed / 1000).toFixed(1));
  str = replaceToken(str, 'eta', (isNaN(eta) || !isFinite(eta)) ? '0.0'
    : eta >= 10000 ? Math.round(eta / 1000) : (eta / 1000).toFixed(1));
  str = replaceToken(str, 'percent', percent.toFixed(0) + '%');

  /* compute the available space (non-zero) for the bar */
  var availableSpace = Math.max(0, this.stream.columns - str.replace(':bar', '').length);
  var width = Math.min(this.width, availableSpace);

  /* TODO: the following assumes the user has one ':bar' token */
  completeLength = Math.round(width * ratio);
  complete = Array(completeLength + 1).join(this.chars.complete);
  incomplete = Array(width - completeLength + 1).join(this.chars.incomplete);

  /* fill in the actual progress bar */
  str = str.replace(':bar', complete + incomplete);

  /* replace the extra tokens */
  if (this.tokens) for (var key in this.tokens) str = replaceToken(str, key, this.tokens[key]);

  if (this.lastDraw !== str) {
    this.stream.cursorTo(0);
    this.stream.write(str);
    if (str.length < this.lastDraw.length) {
      // Reduce flicker - don't clear unless the new line is shorter.
      this.stream.clearLine(1);
    }
    this.lastDraw = str;
  }
};

/**
 * Replace a token in a string, using optional width specifiers after the token.
 * @param str {string} The string that may contain the token to be replaced.
 * @param token {string} Token to replace, not including the ':' prefix or width suffix.
 * @param value {string} The replacement value.
 * @return The resulting string after replacement.
 */
function replaceToken(str, token, value) {
  token = ':' + token;
  var tokenIndex = str.indexOf(token);
  if (tokenIndex < 0) {
    return str;
  }

  value = (value ? value.toString() : '');

  function repeat(s, n) { return n <= 0 ? '' : Array(n + 1).join(s); };

  if (str[tokenIndex + token.length] === '-') {
    width = parseInt(str.substr(tokenIndex + token.length + 1));
    if (width) {
      token = token + '-' + width;
      value = repeat(' ', width - value.length) + value;
    }
  } else if (str[tokenIndex + token.length] === '+') {
    width = parseInt(str.substr(tokenIndex + token.length + 1));
    if (width) {
      token = token + '+' + width;
      value = value + repeat(' ', width - value.length);
    }
  }

  return str.replace(token, value);
}

/**
 * "update" the progress bar to represent an exact percentage.
 * The ratio (between 0 and 1) specified will be multiplied by `total` and
 * floored, representing the closest available "tick." For example, if a
 * progress bar has a length of 3 and `update(0.5)` is called, the progress
 * will be set to 1.
 *
 * A ratio of 0.5 will attempt to set the progress to halfway.
 *
 * @param {number} ratio The ratio (between 0 and 1 inclusive) to set the
 *   overall completion to.
 * @api public
 */

ProgressBar.prototype.update = function (ratio, tokens) {
  var goal = Math.floor(ratio * this.total);
  var delta = goal - this.curr;

  this.tick(delta, tokens);
};

/**
 * Terminates a progress bar.
 *
 * @api public
 */

ProgressBar.prototype.terminate = function () {
  if (this.clear) {
    this.stream.clearLine();
    this.stream.cursorTo(0);
  } else this.stream.write('\n');
};
