var SERVICE_SCOPE_REQUESTS = 'basic highvolume editpage editprotected createeditmovepage createlocalaccount';

function onGmailMessage(e) {
  // console.log(e);

  var messageId = e.gmail.messageId;
  var threadId = e.gmail.threadId;

  var res = apiRequest('GET', {
    'action': 'query',
    'meta': 'userinfo',
    'format': 'json',
    'formatversion': '2',
  });
  // console.log(res);
  var userinfo = JSON.parse(res).query.userinfo;

  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var message = GmailApp.getMessageById(messageId);
  var thread = message.getThread();
  var text = '';
  text += 'You are logged in as ' + userinfo.name + '\n';
  text += 'thread: ' + threadId + '\n';
  text += 'messageId: ' + messageId + '\n';

  var messages = thread.getMessages();
  text += 'messages:\n';
  messages.forEach(message => {
    var messageId = message.getId();
    var mailFrom = message.getFrom();
    console.log('getFrom: ' + message.getFrom());
    // console.log('getReplyTo: ' + message.getReplyTo());
    var mailBody = message.getPlainBody();
    mailBody = stripMailQuote(mailBody);
    console.log('mailBody: ' + mailBody);
    text += messageId + ' ' + mailFrom + '\n';
  });

  var subject = thread.getFirstMessageSubject();
  text += 'subject: ' + subject + '\n';

  var textParagraph = CardService.newTextParagraph()
    .setText(text);

  var action = CardService.newAction()
    .setFunctionName('onWriteMail')
    .setParameters({ text: 'test' });
  var button = CardService.newTextButton()
    .setText('Write mail')
    .setComposeAction(
      action,
      CardService.ComposedEmailType.REPLY_AS_DRAFT)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  var action2 = CardService.newAction()
    .setFunctionName('onGrantIPBE');
  var button2 = CardService.newTextButton()
    .setText('Grant IPBE')
    .setOnClickAction(action2)
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  var buttonSet = CardService.newButtonSet()
    .addButton(button)
    .addButton(button2);

  var section = CardService.newCardSection()
    .addWidget(textParagraph)
    .addWidget(buttonSet);
  var card = CardService.newCardBuilder()
    .addSection(section);

  return card.build();
}

function onGrantIPBE(e) {
  console.log(e);
  var res = apiRequest('POST', {
    'action': 'query',
    'format': 'json',
    'meta': 'tokens',
    'formatversion': '2',
    'type': 'userrights'
  });
  var userrightstoken = JSON.parse(res).query.tokens.userrightstoken;
  var res = apiRequest('POST', {
    action: 'userrights',
    user: 'A2093064-test',
    add: 'ipblock-exempt',
    expiry: '1 day',
    reason: 'Test',
    token: userrightstoken,
    format: 'json',
    'formatversion': '2',
  });
  console.log(res);
}

function onWriteMail(e) {
  console.log(e)
  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var messageId = e.gmail.messageId;
  var message = GmailApp.getMessageById(messageId);
  var thread = message.getThread();
  var allMessages = thread.getMessages();
  var firstMessage = allMessages[0];
  var lastMessage = allMessages[allMessages.length - 1];
  var draft = thread.createDraftReply('');

  var recipient = firstMessage.getFrom() + ',unblock-zh@lists.wikimedia.org';
  console.log('recipient: ' + recipient);
  var subject = lastMessage.getSubject();
  var body = '測試2\n\n';
  draft.update(recipient, subject, body);

  return CardService.newComposeActionResponseBuilder()
    .setGmailDraft(draft).build();
}


function apiRequest(method_opt, payload) {
  return accessProtectedResource('https://zh.wikipedia.org/w/api.php', method_opt, {}, payload);
}


/**
 * @see https://developers.google.com/apps-script/add-ons/how-tos/non-google-services
 */
function accessProtectedResource(url, method_opt, headers_opt, payload) {
  var service = getOAuthService();
  var maybeAuthorized = service.hasAccess();
  if (maybeAuthorized) {
    var accessToken = service.getAccessToken();
    var method = method_opt || 'get';
    var headers = headers_opt || {};
    headers['Authorization'] = Utilities.formatString('Bearer %s', accessToken);
    var resp = UrlFetchApp.fetch(url, {
      'headers': headers,
      'method': method,
      'payload': payload || {},
      'muteHttpExceptions': true,
    });

    var code = resp.getResponseCode();
    if (code >= 200 && code < 300) {
      return resp.getContentText('utf-8');
    } else if (code == 401 || code == 403) {
      maybeAuthorized = false;
    } else {
      console.error('Backend server error (%s): %s', code.toString(),
        resp.getContentText('utf-8'));
      throw ('Backend server error: ' + code);
    }
  }

  if (!maybeAuthorized) {
    CardService.newAuthorizationException()
      .setAuthorizationUrl(service.getAuthorizationUrl())
      .setResourceDisplayName('Wikipedia account')
      .throwException();
  }
}

function getOAuthService() {
  return OAuth2.createService('Wikipedia')
    .setAuthorizationBaseUrl('https://zh.wikipedia.org/w/rest.php/oauth2/authorize')
    .setTokenUrl('https://zh.wikipedia.org/w/rest.php/oauth2/access_token')
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setScope(SERVICE_SCOPE_REQUESTS)
    .setCallbackFunction('authCallback')
    .setCache(CacheService.getUserCache())
    .setPropertyStore(PropertiesService.getUserProperties());
}

function authCallback(callbackRequest) {
  var authorized = getOAuthService().handleCallback(callbackRequest);
  if (authorized) {
    return HtmlService.createHtmlOutput(
      'Success! <script>setTimeout(function() { top.window.close() }, 1);</script>');
  } else {
    return HtmlService.createHtmlOutput('Denied');
  }
}

function resetOAuth() {
  getOAuthService().reset();
}
