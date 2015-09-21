﻿/*
	content_scripts / Chrome拡張どちらも対応できるように変更
*/
(function () {
	var inChromeExtension = location.protocol === "chrome-extension:";
	var isBackgroundPage = inChromeExtension && window.chrome && chrome.extension && (chrome.extension.getBackgroundPage() === window);
	
	if (isBackgroundPage) {
		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (request.method === "search") {
				search(request.text, sender.tab.id);
			} else if (request.method === "copy") {
				copy(request.text);
			} else if (method === "open") {
				open(request.text);
			}
		});
	} else {
		var slectedText = "";
		var startPositionX = 0;
		var startPositionY = 0;

		document.body.addEventListener("dragstart", function (evt) {
			slectedText = window.getSelection().toString();
			startPositionX = evt.screenX;
			startPositionY = evt.screenY;
		});

		document.body.addEventListener("dragend", function (evt) {
			var movedDistanceToRight = evt.screenX - startPositionX;
			var movedDistanceToBottom = evt.screenY - startPositionY;
			if (movedDistanceToBottom > 0) {
				// 下へ動いた
				if ((movedDistanceToRight > 0) && (movedDistanceToRight > movedDistanceToBottom)) {
					// 右へ動いた かつ 右の方へ大きく動いた
					if (/\S/.test(slectedText) && slectedText === window.getSelection().toString()) {
						action("copy", slectedText);
					} else if (evt.target.tagName === "A") {
						action("copy", evt.target.href);
					}
				} else {
					if (/\S/.test(slectedText) && slectedText === window.getSelection().toString()) {
						action("search", slectedText);
					} else if (evt.target.tagName === "A") {
						action("open", evt.target.href);
					}
				}
			}
		});

		function action(method, text) {
			if (inChromeExtension) {
				if (method === "search") {
					search(text);
				} else if (method === "copy") {
					copy(text);
				} else if (method === "open") {
					open(text);
				}
			} else {
				chrome.runtime.sendMessage({
					method: method,
					text: text
				});
			}
		}
	}
	if (inChromeExtension) {
		function search(text, tabId) {
			var url = "https://www.google.co.jp/search?hl=ja&complete=0&q=" + encodeURIComponent(text);
			open(url, tabId);
		}
		function open(url, tabId) {
			if (typeof tabId === "undefined") {
				chrome.tabs.getCurrent(function (tab) {
					chrome.tabs.create({
						url: url,
						openerTabId: tab.id
					});
				});
			} else {
				chrome.tabs.create({
					url: url,
					openerTabId: tabId
				});
			}
		}
		var textarea = document.createElement("textarea");
		// textareaを非表示にするとコピーできない
		textarea.style.position = "fixed";
		textarea.style.left = "-100px";
		textarea.style.top = "-100px";
		document.body.appendChild(textarea);
		function copy(text) {
			textarea.value = text;
			textarea.select();
			document.execCommand("copy");
		}
	}
})();