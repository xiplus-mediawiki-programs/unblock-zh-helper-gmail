var SERVICE_SCOPE_REQUESTS = 'basic highvolume editpage editprotected createeditmovepage createlocalaccount';

var cache = CacheService.getUserCache();

function onGmailMessage(e) {
  // console.log(e);

  var threadId = e.gmail.threadId;

  if (threadId != cache.get('threadId')) {
    cache.removeAll([
      'input_username',
      'input_email',
      'input_iporid',
      'input_variant',
    ]);
  }

  return createCard(e);
}

function createCard(e) {
  var messageId = e.gmail.messageId;
  var threadId = e.gmail.threadId;

  // console.log('cache: ' + JSON.stringify(cache.getAll([
  //   'input_username',
  //   'input_email',
  //   'input_iporid',
  //   'threadId',
  //   'messageId',
  // ])));

  cache.put('threadId', threadId);

  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var wpUsername = cache.get('wpUsername');
  if (!wpUsername) {
    // console.log('Fetching wikipedia username...');

    var res = apiRequest('GET', {
      'action': 'query',
      'meta': 'userinfo',
    });
    // console.log(res);
    var userinfo = res.query.userinfo;

    wpUsername = userinfo.name;
    cache.put('wpUsername', wpUsername, 60);
  }

  var message = GmailApp.getMessageById(messageId);
  var thread = message.getThread();
  var text = '';
  text += '您目前以 ' + wpUsername + ' 的身分登入維基百科\n';
  // text += 'cache messageId: ' + cache.get('messageId') + '\n';

  // Parse mails
  var messages = thread.getMessages();
  var requester = messages[0].getFrom();
  var subject = thread.getFirstMessageSubject();

  var allMailText = subject + '\n';
  // text += 'subject: ' + subject + '\n';

  // text += 'messages:\n';
  messages.forEach((message, idx) => {
    var mailFrom = message.getFrom();
    if (mailFrom != requester) {
      return;
    }

    // console.log('getReplyTo: ' + message.getReplyTo());
    var mailBody = message.getPlainBody();
    mailBody = stripMailQuote(mailBody);

    allMailText += mailBody + '\n';

    // console.log('getFrom: ' + message.getFrom());
    // console.log('mailBody: ' + mailBody);

    // text += (idx + 1) + ' ' + mailFrom.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '\n';
  });

  // console.log('allMailText', allMailText);

  var parseResult = parseMailBody(allMailText);
  // text += 'parseResult: ' + JSON.stringify(parseResult) + '\n';
  console.log('parseResult: ' + JSON.stringify(parseResult));

  if (parseResult.username.length > 0 && !cache.get('input_username')) {
    cache.put('input_username', parseResult.username[0]);
  }

  if (parseResult.iporid.length > 0 && !cache.get('input_iporid')) {
    cache.put('input_iporid', parseResult.iporid[0]);
  }

  if (!cache.get('input_email')) {
    cache.put('input_email', stripEmail(requester));
  }

  // Build card
  var section = CardService.newCardSection();

  var textParagraph = CardService.newTextParagraph().setText(text);
  section.addWidget(textParagraph);

  var button = CardService.newTextButton()
    .setText('Write mail')
    .setComposeAction(
      CardService.newAction()
        .setFunctionName('onWriteMail')
        .setParameters({ text: 'test' }),
      CardService.ComposedEmailType.REPLY_AS_DRAFT
    )
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT);

  var button2 = CardService.newTextButton()
    .setText('Grant IPBE')
    .setOnClickAction(CardService.newAction().setFunctionName('onGrantIPBE'))
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT);

  var button3 = CardService.newTextButton()
    .setText('Open Link')
    .setOnClickOpenLinkAction(CardService.newAction().setFunctionName('openLinkCallback'))
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT);

  var textInputUsername = CardService.newTextInput()
    .setFieldName('input_username')
    .setTitle('使用者名稱')
    .setValue(cache.get('input_username') || '')
    .setOnChangeAction(CardService.newAction().setFunctionName('onFormInputChange'));
  section.addWidget(textInputUsername);

  if (parseResult.username.length > 0) {
    var usernameButtonSet = CardService.newButtonSet();
    parseResult.username.forEach(username => {
      var button = CardService.newTextButton()
        .setText(username)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('updateInputValue')
          .setParameters({ input_username: username })
        )
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT);
      usernameButtonSet.addButton(button);
    });
    section.addWidget(usernameButtonSet);
  }

  var textInputEmail = CardService.newTextInput()
    .setFieldName('input_email')
    .setTitle('電子郵件地址')
    .setValue(cache.get('input_email') || '')
    .setOnChangeAction(CardService.newAction().setFunctionName('onFormInputChange'));
  section.addWidget(textInputEmail);

  var textInputIPorID = CardService.newTextInput()
    .setFieldName('input_iporid')
    .setTitle('IP地址或封鎖ID')
    .setValue(cache.get('input_iporid') || '')
    .setOnChangeAction(CardService.newAction().setFunctionName('onFormInputChange'));
  section.addWidget(textInputIPorID);

  if (parseResult.iporid.length > 0) {
    var iporidButtonSet = CardService.newButtonSet();
    parseResult.iporid.forEach(iporid => {
      var button = CardService.newTextButton()
        .setText(iporid)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('updateInputValue')
          .setParameters({ input_iporid: iporid })
        )
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT);
      iporidButtonSet.addButton(button);
    });
    section.addWidget(iporidButtonSet);
  }

  // var res = accessProtectedResource(
  //   'https://meta.wikimedia.org/w/api.php',
  //   'GET',
  //   {},
  //   {
  //     action: 'query',
  //     format: 'json',
  //     meta: 'globaluserinfo',
  //     list: 'users',
  //     usprop: 'cancreate|centralids',
  //     usattachedwiki: 'zhwiki',
  //     guiuser: cache.get('input_username'),
  //     ususers: cache.get('input_username'),
  //   }
  // );
  var res = apiRequest('GET', {
    action: 'query',
    meta: 'globaluserinfo',
    list: 'users',
    usprop: 'cancreate|centralids',
    usattachedwiki: 'zhwiki',
    guiuser: cache.get('input_username'),
    ususers: cache.get('input_username'),
  });
  var user = res.query.users[0];
  var usernameStatus = '';
  if (user.userid) {
    if (user.attachedwiki.CentralAuth) {
      usernameStatus = 'exists';
    } else {
      usernameStatus = 'needs_local';
    }
  } else if (user.invalid) {
    usernameStatus = 'banned';
  } else if (user.cancreateerror) {
    usernameStatus = 'not_exists';
    var cancreateerror = user.cancreateerror[0];
    if (cancreateerror.code === 'userexists') {
      usernameStatus = 'needs_local';
    } else if (cancreateerror.code === 'invaliduser') {
      usernameStatus = 'banned';
      usernameBannedDetail = '使用者名稱無效（電子郵件地址等）。';
    } else if (cancreateerror.code === 'antispoof-name-illegal') {
      usernameStatus = 'banned';
      usernameBannedDetail = mw.msg('antispoof-name-illegal', ...cancreateerror.params);
    } else if (cancreateerror.code === '_1') {
      usernameStatus = 'banned';
      usernameBannedDetail = mw.msg('antispoof-name-1', ...cancreateerror.params);
    } else if (cancreateerror.code === '_1_2_3') {
      usernameStatus = 'banned';
      usernameBannedDetail = mw.msg('antispoof-name-123', ...cancreateerror.params);
    } else {
      usernameStatus = 'banned';
    }
  } else {
    usernameStatus = 'not_exists';
  }

  console.log('userinfo', res);

  var radioGroup = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setFieldName('input_variant')
    .addItem('簡體', 'zh-hans', true)
    .addItem('繁體', 'zh-hant', false)
    .setOnChangeAction(CardService.newAction().setFunctionName('onFormInputChange'));
  section.addWidget(radioGroup);

  var card = CardService.newCardBuilder()
    .addSection(section);

  return card.build();
}

function updateInputValue(e) {
  console.log(e.parameters);

  for (const key in e.parameters) {
    const value = e.parameters[key];
    cache.put(key, value);
  }

  var navigation = CardService.newNavigation().updateCard(createCard(e));
  var actionResponse = CardService.newActionResponseBuilder().setNavigation(navigation);
  return actionResponse.build();
}

function onFormInputChange(e) {
  console.log(e);

  cache.put('input_username', e.formInput.input_username);
  cache.put('input_email', e.formInput.input_email);
  cache.put('input_iporid', e.formInput.input_iporid);

  var navigation = CardService.newNavigation().updateCard(createCard(e));
  var actionResponse = CardService.newActionResponseBuilder().setNavigation(navigation);
  return actionResponse.build();
}

function openLinkCallback() {
  return CardService.newActionResponseBuilder()
    .setOpenLink(CardService.newOpenLink()
      .setUrl('https://zh.wikipedia.org/wiki/Special:空白页面/unblock-zh-helper')
      .setOpenAs(CardService.OpenAs.OVERLAY)
    )
    .build();
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
  var userrightstoken = res.query.tokens.userrightstoken;
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
  payload = {
    'format': 'json',
    'formatversion': '2',
    ...payload,
  }
  console.log('api', payload);
  var res = accessProtectedResource('https://zh.wikipedia.org/w/api.php', method_opt, {}, payload);
  console.log(res);
  return JSON.parse(res);
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
    .setCache(cache)
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
