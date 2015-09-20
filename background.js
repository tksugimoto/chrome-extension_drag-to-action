
var textarea = document.createElement("textarea");
document.body.appendChild(textarea);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
	if (request.method === "search") {
		var text = request.text;
		var url = "https://www.google.co.jp/search?hl=ja&complete=0&q=" + encodeURIComponent(text);
		chrome.tabs.create({
			url: url,
			openerTabId: sender.tab.id
		}, function (){});
	} else if (request.method === "copy") {
		textarea.value = request.text;
		textarea.select();
		document.execCommand("copy");
	}
});