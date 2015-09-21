/*
	content_scripts / Chrome拡張どちらも対応できるように変更
*/
(function () {
	var inChromeExtension = location.protocol === "chrome-extension:";
	var isBackgroundPage = inChromeExtension && window.chrome && chrome.extension && (chrome.extension.getBackgroundPage() === window);
	
	if (isBackgroundPage) {
		var textarea = document.createElement("textarea");
		document.body.appendChild(textarea);

		chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
			if (request.method === "search") {
				search(request.text, sender.tab.id);
			} else if (request.method === "copy") {
				textarea.value = request.text;
				textarea.select();
				document.execCommand("copy");
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
			if (/\S/.test(slectedText) && slectedText === window.getSelection().toString()) {
				var movedDistanceToRight = evt.screenX - startPositionX;
				var movedDistanceToBottom = evt.screenY - startPositionY;
				if (movedDistanceToBottom > 0) {
					// 下へ動いた
					if ((movedDistanceToRight > 0) && (movedDistanceToRight > movedDistanceToBottom)) {
						// 右へ動いた かつ 右の方へ大きく動いた
						action("copy", slectedText);
					} else {
						action("search", slectedText);
					}
				}
			}
		});

		function action(method, text) {
			if (inChromeExtension) {
				if (method === "search") {
					search(text);
				} else if (method === "copy") {
					document.execCommand("copy");
				}
			} else {
				chrome.runtime.sendMessage({
					method: method,
					text: text
				});
			}
		}
	}
	function search(text, tabId) {
		var url = "https://www.google.co.jp/search?hl=ja&complete=0&q=" + encodeURIComponent(text);
		if (typeof tabId === "undefined") {
			chrome.tabs.getCurrent(function (tab) {
				chrome.tabs.create({
					url: url,
					openerTabId: tab.id
				}, function (){});
			});
		} else {
			chrome.tabs.create({
				url: url,
				openerTabId: tabId
			});
		}
	}
})();