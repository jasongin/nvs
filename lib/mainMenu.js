// @ts-check
'use strict';

const settings = require('./settings').settings;
const Error = require('./error');

const menu = require('../deps/node_modules/console-menu/console-menu');
const nvsAddRemove = require('./addRemove');
const nvsUse = require('./use');
const nvsList = require('./list');

function showMainMenuAsync() {
	// TODO: Group by remotes and major versions when there are many items?
	let i = 0;
	let menuItems = [].concat(nvsList.getVersions().map(v => {
		let title = v.toString({ label: true });
		if (v.current) {
			title += ' [current]';
		}
		if (v.default) {
			title += ' [default]';
		}
		return {
			hotkey: (i < 26 ? String.fromCharCode('a'.charCodeAt(0) + i++) : null),
			title: title,
			selected: v.current,
			version: v,
		};
	}));

	if (menuItems.length === 0) {
		return showRemotesMenuAsync(() => undefined);
	}

	menuItems = menuItems.concat([
		{ separator: true },
		{ hotkey: ',', title: 'Download another version' },
		{ hotkey: '.', title: 'Don\'t use any version' },
	]);

	return menu(menuItems, {
		border: true,
		header: 'Select a version',
		pageSize: 15,
	}).then(item => {
		if (item && item.hotkey === ',') {
			return showRemotesMenuAsync(showMainMenuAsync);
		} else if (item && item.hotkey === '.') {
			return nvsUse.use(null);
		} else if (item && item.version) {
			return nvsUse.use(item.version);
		}
	});
}

function showRemotesMenuAsync(cancel) {
	let remoteNames = Object.keys(settings.remotes)
		.filter(r => r !== 'default' && settings.remotes[r]);
	if (remoteNames.length === 1) {
		return showRemoteVersionsMenuAsync(remoteNames[0], cancel);
	} else if (remoteNames.length === 0) {
		throw new Error('No remote download souces are configured.');
	}

	let columnWidth = remoteNames
		.map(item => item.length)
		.reduce((a, b) => a > b ? a : b, 0) + 2;

	let i = 0;
	let menuItems = remoteNames.map(remoteName => {
		return {
			hotkey: (i < 26 ? String.fromCharCode('a'.charCodeAt(0) + i++) : null),
			title: remoteName + ' '.repeat(columnWidth - remoteName.length) +
				settings.remotes[remoteName],
			selected: remoteName === settings.remotes['default'],
			remoteName: remoteName,
		};
	});

	return menu(menuItems, {
		border: true,
		header: 'Select a remote',
		pageSize: 15,
	}).then(item => {
		if (!item) {
			return cancel();
		} else if (item.remoteName) {
			return showRemoteVersionsMenuAsync(item.remoteName,
				showRemotesMenuAsync.bind(this, cancel));
		}
	});
}

function showRemoteVersionsMenuAsync(remoteName, cancel) {
	// TODO: Group by major versions when there are many items?
	return nvsList.getRemoteVersionsAsync(remoteName).then(result => {
		let i = 0;
		let menuItems = result.map(v => {
			return {
				hotkey: (i < 26 ? String.fromCharCode('a'.charCodeAt(0) + i++) : null),
				title: v.toString({ label: true }),
				version: v,
			};
		});

		let header = 'Select a ' + remoteName + ' version';
		return menu(menuItems, {
			border: true,
			header: header,
			pageSize: 15,
		}).then(item => {
			if (item && item.version) {
				return nvsAddRemove.addAsync(item.version, true);
			} else {
				return cancel();
			}
		});
	});
}

module.exports = {
	showMainMenuAsync,
};
