// A simple interactive test for the console-menu module.

const menu = require('./console-menu');

menu([
    { hotkey: '1', title: 'One' },
    { hotkey: '2', title: 'Two', selected: true },
    { hotkey: '3', title: 'Three' },
    { hotkey: '4', title: 'Four' },
    { separator: true },
    { hotkey: '0', title: 'Do something else...', cascade: true },
    { separator: true },
    { hotkey: '?', title: 'Help' },
], {
    header: 'Test menu',
    border: true,
}).then(item => {
    if(item && item.cascade) {
        return menu(['a','b','c','d','e','f','g','h','i','j'].map(hotkey => {
            return {
                hotkey,
                title: 'Item ' + hotkey.toUpperCase(),
            };
        }), {
            header: 'Another menu',
            border: true,
            pageSize: 5,
        });
    } else {
        return item;
    }
}).then(item => {
    if (item) {
        console.log('You chose: ' + JSON.stringify(item));
    } else {
        console.log('You cancelled the menu.');
    }
});
