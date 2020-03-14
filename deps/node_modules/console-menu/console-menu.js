const os = require('os');
const readline = require('readline');
const keypress = require('keypress');

const defaultHelpMessage =
    'Type a hotkey or use Down/Up arrows then Enter to choose an item.';

/**
 * Displays a menu of items in the console and asynchronously waits for the user to select an item.
 *
 * @param {any} items Array of menu items, where each item is an object that includes a title
 * property and optional hotkey property. (Items may include additional user-defined properties.)
 * @param {any} options Dictionary of options for the menu:
 *   - header {string}: Header text for the menu.
 *   - border {boolean}: True to draw a border around the menu.
 *   - pageSize {integer}: Max number of items to show at a time. Additional items cause the menu
 *     to be scrollable.
 *   - helpMessage {string}: Message text to show under the menu.
 * @returns A promise that resolves to the chosen item, or to null if the menu was cancelled.
 */
function menu(items, options) {
    if (!items || !Array.isArray(items) || items.length < 1) {
        throw new TypeError('A nonempty items array is required.');
    }
    options = options || {};

    var count = items.length;
    var selectedIndex = items.findIndex(item => item.selected);
    if (selectedIndex < 0) {
        selectedIndex = 0;
        while (selectedIndex < count && items[selectedIndex].separator) selectedIndex++;
    }

    var scrollOffset = 0;
    printMenu(items, options, selectedIndex, scrollOffset);

    return new Promise((resolve, reject) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        keypress(process.stdin);

        var handleMenuKeypress = (ch, key) => {
            var selection = null;
            if (isEnter(key)) {
                selection = items[selectedIndex];
            } else if (ch) {
                selection = items.find(item => item.hotkey && item.hotkey === ch) ||
                    items.find(item => item.hotkey &&
                        item.hotkey.toLowerCase() === ch.toLowerCase());
            }

            var newIndex = null;
            if (selection || isCancelCommand(key)) {
                process.stdin.removeListener('keypress', handleMenuKeypress);
                process.stdin.setRawMode(false);
                resetCursor(options, selectedIndex, scrollOffset);
                readline.clearScreenDown(process.stdout);
                process.stdin.pause();
                resolve(selection);
            } else if (isUpCommand(key) && selectedIndex > 0) {
                newIndex = selectedIndex - 1;
                while (newIndex >= 0 && items[newIndex].separator) newIndex--;
            } else if (isDownCommand(key) && selectedIndex < count - 1) {
                newIndex = selectedIndex + 1;
                while (newIndex < count && items[newIndex].separator) newIndex++;
            } else if (isPageUpCommand(key) && selectedIndex > 0) {
                newIndex = (options.pageSize ? Math.max(0, selectedIndex - options.pageSize) : 0);
                while (newIndex < count && items[newIndex].separator) newIndex++;
            } else if (isPageDownCommand(key) && selectedIndex < count - 1) {
                newIndex = (options.pageSize
                    ? Math.min(count - 1, selectedIndex + options.pageSize) : count - 1);
                while (newIndex >= 0 && items[newIndex].separator) newIndex--;
            } else if (isGoToFirstCommand(key) && selectedIndex > 0) {
                newIndex = 0;
                while (newIndex < count && items[newIndex].separator) newIndex++;
            } else if (isGoToLastCommand(key) && selectedIndex < count - 1) {
                newIndex = count - 1;
                while (newIndex >= 0 && items[newIndex].separator) newIndex--;
            }

            if (newIndex !== null && newIndex >= 0 && newIndex < count) {
                resetCursor(options, selectedIndex, scrollOffset);

                selectedIndex = newIndex;

                // Adjust the scroll offset when the selection moves off the page.
                if (selectedIndex < scrollOffset) {
                    scrollOffset = (isPageUpCommand(key)
                        ? Math.max(0, scrollOffset - options.pageSize) : selectedIndex);
                } else if (options.pageSize && selectedIndex >= scrollOffset + options.pageSize) {
                    scrollOffset = (isPageDownCommand(key)
                        ? Math.min(count - options.pageSize, scrollOffset + options.pageSize)
                        : selectedIndex - options.pageSize + 1);
                }

                printMenu(items, options, selectedIndex, scrollOffset);
            }
        };

        process.stdin.addListener('keypress', handleMenuKeypress);
    });
}

function isEnter(key) { return key && (key.name === 'enter' || key.name === 'return'); }
function isUpCommand(key) { return key && key.name === 'up'; }
function isDownCommand(key) { return key && key.name === 'down'; }
function isPageUpCommand(key) { return key && key.name === 'pageup'; }
function isPageDownCommand(key) { return key && key.name === 'pagedown'; }
function isGoToFirstCommand(key) { return key && key.name === 'home'; }
function isGoToLastCommand(key) { return key && key.name === 'end'; }
function isCancelCommand(key) {
    return key && ((key.ctrl && key.name == 'c') || key.name === 'escape');
}

function resetCursor(options, selectedIndex, scrollOffset) {
    readline.moveCursor(process.stdout, -3,
        - (options.header ? 1 : 0)
        - (options.border ? (options.header ? 2 : 1) : 0)
        - selectedIndex + scrollOffset);
}

function printMenu(items, options, selectedIndex, scrollOffset) {
    var repeat = (s, n) => {
        return Array(n + 1).join(s);
    };

    var width = 0;
    for (var i = 0; i < items.length; i++) {
        if (items[i].title && 4 + items[i].title.length > width) {
            width = 4 + items[i].title.length;
        }
    }

    var prefix = (options.border ? '|' : '');
    var suffix = (options.border ? ' |' : '');

    if (options.header && options.header.length > width) {
        width = options.header.length;
    }

    if (options.border) {
        if (!options.header && options.pageSize && scrollOffset > 0) {
            process.stdout.write('.--/\\' + repeat('-', width - 2) + '.' + os.EOL);
        } else {
            process.stdout.write('.' + repeat('-', width + 2) + '.' + os.EOL);
        }
    }

    if (options.header) {
        process.stdout.write(prefix + (options.border ? ' ' : '') + options.header +
            repeat(' ', width - options.header.length) + suffix + os.EOL);
        if (options.border) {
            if (options.pageSize && scrollOffset > 0) {
                process.stdout.write('+--/\\' + repeat('-', width - 2) + '+' + os.EOL);
            } else {
                process.stdout.write('+' + repeat('-', width + 2) + '+' + os.EOL);
            }
        }
    }

    var scrollEnd = options.pageSize
        ? Math.min(items.length, scrollOffset + options.pageSize)
        : items.length;
    for (var i = scrollOffset; i < scrollEnd; i++) {
        if (items[i].separator) {
            process.stdout.write(prefix + ' ' + repeat(' ', width) + suffix + os.EOL);
        } else {
            var hotkey = items[i].hotkey || '*';
            var title = items[i].title || '';
            var label = (i === selectedIndex
                ? '[' + hotkey + ']' : ' ' + hotkey + ')');
            process.stdout.write(prefix + ' ' + label + ' ' + title +
                repeat(' ', width - title.length - 4) + suffix + os.EOL);
        }
    }

    if (options.border) {
        if (options.pageSize && scrollEnd < items.length) {
            process.stdout.write('\'--\\/' + repeat('-', width - 2) + '\'' + os.EOL);
        } else {
            process.stdout.write('\'' + repeat('-', width + 2) + '\'' + os.EOL);
        }
    }

    process.stdout.write(options.helpMessage || defaultHelpMessage);
    readline.moveCursor(process.stdout,
        -(options.helpMessage || defaultHelpMessage).length + prefix.length + 2,
        -(options.border ? 1 : 0) - (scrollEnd - scrollOffset) + selectedIndex - scrollOffset);
}

module.exports = menu;
