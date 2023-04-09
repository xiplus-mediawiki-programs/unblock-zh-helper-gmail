function onHomepage(e) {
  var text = '請點擊任何一封郵件以使用本工具。';

  var wpIp = cache.get('wpIp');
  var wpBlockid = cache.get('wpBlockid');
  if (!wpIp) {
    var payload = {
      action: 'query',
      format: 'json',
      formatversion: '2',
      meta: 'userinfo',
      uiprop: 'blockinfo',
    }
    var resp = UrlFetchApp.fetch('https://login.wikimedia.org/w/api.php', {
      'method': 'GET',
      'payload': payload,
      'muteHttpExceptions': true,
    });
    var res = JSON.parse(resp.getContentText('utf-8'));
    console.log('ip result', JSON.stringify(res));

    var userinfo = res.query.userinfo;
    wpIp = userinfo.name;
    wpBlockid = userinfo.blockid;

    cache.put('wpIp', wpIp, 10);
    cache.put('wpBlockid', wpBlockid, 60);
  }

  text += '\n\n您目前使用 Google Cloud Platform 的 IP 位址是 ' + wpIp + '。';
  if (wpBlockid) {
    var unblockUrl = 'https://zh.wikipedia.org/w/Special:Unblock?wgTarget=' + encodeURIComponent('#' + wpBlockid);
    var phabUrl = 'https://phabricator.wikimedia.org/T322468';
    text += '\n⛔️ 此 IP 位址被封鎖，您需要<a href="' + unblockUrl + '">解除此封鎖</a>才能正常使用「強制建立本地帳號」功能（<a href="' + phabUrl + '">phab:T322468</a>）';
  }

  text += '\n\n隱私聲明：本工具會記錄您所瀏覽的電子郵件內容以供改善工具（權限 <a href="https://developers.google.com/apps-script/add-ons/concepts/workspace-scopes">gmail.addons.current.message.readonly</a>），但不會讀取您的其他電子郵件。如果您要閱讀其他非 unblock-zh 的郵件，請關閉此工具（右上角關閉按鈕）。';

  var textParagraph = CardService.newTextParagraph()
    .setText(text);

  var section = CardService.newCardSection()
    .addWidget(textParagraph);
  var card = CardService.newCardBuilder()
    .addSection(section);

  return card.build();
}
