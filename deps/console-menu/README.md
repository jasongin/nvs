# console-menu
Displays a menu of items in the console and asynchronously waits for the user to select an item. Each item title is prefixed by a hotkey. An item may be selected by typing a hotkey or by using Down/Up arrows followed by Enter.
```
.--------------.
| Example menu |
+--------------+
| [a] Item A   |
|  b) Item B   |
|  c) Item C   |
|  d) Item D   |
|  e) Item E   |
'--\/----------'
```
The menu may be scrollable (hinted by `/\` and `\/` indicators). PageUp, PageDown, Home, and End keys are also supported.

## Usage
The `menu` function takes two parameters: an `items` array and an `options` object.

Each item must be an object with the following properties:
 * `separator` (boolean): If true, this is a separator item that inserts a blank line into the menu. (All other properties are ignored on separator items.)
 * `title` (string): Item title text.
 * `hotkey` (character): Unique item hotkey; must be a single letter, number, or other character. If omitted, the item is only selectable via arrow keys + Enter.
 * `selected` (boolean) True if this item should initially selected. If unspecified then the first item is initially selected.

Items may have additional user-defined properties, which will be included in the returned result.

The following options are supported:
 * `header` (string): Optional header text for the menu.
 * `border` (boolean): True to draw a border around the menu. False for a simpler-looking menu.
 * `pageSize` (integer): Max number of items to show at a time;  additional items cause the menu to be scrollable. Omitting this value (or specifying 0) disables scrolling.
 * `helpMessage` (string): Message text to show under the menu.

The return value is a `Promise` that resolves to the chosen item object, or to `null` if the menu was cancelled by pressing Esc or Ctrl-C.

## Example
```JavaScript
var menu = require('console-menu');
menu([
    { hotkey: '1', title: 'One' },
    { hotkey: '2', title: 'Two', selected: true },
    { hotkey: '3', title: 'Three' },
    { separator: true },
    { hotkey: '?', title: 'Help' },
], {
    header: 'Example menu',
    border: true,
}).then(item => {
    if (item) {
        console.log('You chose: ' + JSON.stringify(item));
    } else {
        console.log('You cancelled the menu.');
    }
});
```
