var SERVICE_SCOPE_REQUESTS = 'basic highvolume editpage editprotected createeditmovepage createaccount createlocalaccount';

var cache = CacheService.getUserCache();

function onGmailMessage(e) {
  // console.log(e);

  var threadId = e.gmail.threadId;

  if (threadId != cache.get('threadId')) {
    cache.remove('formData');
  }

  return createCard(e);
}

function getFormData() {
  var formData = {
    firstLoad: true,
    needChecks: true,
    requests: [],
    username: '',
    email: '',
    ip: '',
    actionOptions: [],
    summary: '',
    statusCreateAcccount: '',
    statusCreateLocal: '',
    statusGrantIpbe: '',
    statusResetPasswordUsername: '',
    statusResetPasswordEmail: '',
    mailOptionsUsername: '',
    mailOptionsIpbe: '',
    mailOptionsOther: [],
    mailOptionsVariant: 'zh-hans',
  };
  if (cache.get('formData')) {
    formData = { ...formData, ...JSON.parse(cache.get('formData')) };
  }
  return formData;
}

function putFormData(formData) {
  cache.put('formData', JSON.stringify(formData));
}

function createCard(e) {
  var messageId = e.gmail.messageId;
  var threadId = e.gmail.threadId;

  var formData = getFormData();

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

  var archiveUrl = parseArchiveUrl(messages[0].getHeader('Archived-At'));
  if (!archiveUrl) {
    archiveUrl = parseArchiveUrl(messages[0].getBody());
  }

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

  // fill missing formData
  if (formData.firstLoad) {
    if (parseResult.request.acc) {
      formData.requests.push('CreateAccount');
    }
    if (parseResult.request.ipbe) {
      formData.requests.push('GrantIpbe');
    }
    if (parseResult.request.password) {
      formData.requests.push('ResetPassword');
    }
  }
  if (!formData.username && parseResult.username.length > 0) {
    formData.username = parseResult.username[0];
  }
  if (!formData.ip && parseResult.iporid.length > 0) {
    formData.ip = parseResult.iporid[0];
  }
  if (!formData.email) {
    formData.email = stripEmail(requester);
  }
  if (!formData.summary) {
    formData.summary = '[[listarchive:' + archiveUrl + '|unblock-zh申請]]';
  }

  // check status
  if (formData.needChecks) {
    formData = { ...formData, ...checkStatus(formData.username, formData.ip) };
    putFormData(formData);
    autoActionOptions();
    autoMailOptions();
    formData = getFormData();
  }

  if (formData.firstLoad) {
    formData.firstLoad = false;
    putFormData(formData);
  }

  // Build card
  var card = CardService.newCardBuilder()

  // section: header
  // var sectionHeader = CardService.newCardSection();

  // var textParagraph = CardService.newTextParagraph().setText(text);
  // sectionHeader.addWidget(textParagraph);

  // card.addSection(sectionHeader);

  // section: input
  var sectionInput = CardService.newCardSection()
    .setHeader('填寫申請人給予的資料');

  var reqCheckboxes = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setTitle('要求操作')
    .setFieldName('requests')
    .addItem('建立帳號', 'CreateAccount', formData.requests.includes('CreateAccount'))
    .addItem('授予IP封鎖例外權', 'GrantIpbe', formData.requests.includes('GrantIpbe'))
    .addItem('重設密碼', 'ResetPassword', formData.requests.includes('ResetPassword'))
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateSelectionInput')
      .setParameters({ key: 'requests' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionInput.addWidget(reqCheckboxes);

  var textInputUsername = CardService.newTextInput()
    .setFieldName('username')
    .setTitle('使用者名稱')
    .setValue(formData.username)
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateTextInput')
      .setParameters({ key: 'username' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionInput.addWidget(textInputUsername);

  if (parseResult.username.length > 0) {
    var usernameButtonSet = CardService.newButtonSet();
    parseResult.username.forEach(username => {
      var button = CardService.newTextButton()
        .setText(username)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('updateInputValue')
          .setParameters({ username: username })
        )
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT);
      usernameButtonSet.addButton(button);
    });
    sectionInput.addWidget(usernameButtonSet);
  }

  var textInputEmail = CardService.newTextInput()
    .setFieldName('email')
    .setTitle('電子郵件地址')
    .setValue(formData.email)
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateTextInput')
      .setParameters({ key: 'email' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionInput.addWidget(textInputEmail);

  var textInputIPorID = CardService.newTextInput()
    .setFieldName('ip')
    .setTitle('IP地址或封鎖ID')
    .setValue(formData.ip)
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateTextInput')
      .setParameters({ key: 'ip' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionInput.addWidget(textInputIPorID);

  if (parseResult.iporid.length > 0) {
    var iporidButtonSet = CardService.newButtonSet();
    parseResult.iporid.forEach(iporid => {
      var button = CardService.newTextButton()
        .setText(iporid)
        .setOnClickAction(CardService.newAction()
          .setFunctionName('updateInputValue')
          .setParameters({ ip: iporid })
        )
        .setTextButtonStyle(CardService.TextButtonStyle.TEXT);
      iporidButtonSet.addButton(button);
    });
    sectionInput.addWidget(iporidButtonSet);
  }

  card.addSection(sectionInput);

  // section: info
  var sectionInfo = CardService.newCardSection()
    .setHeader('選擇您要進行的操作');

  var statusText = '';

  if (formData.normalizedUsername) {
    if (formData.username != formData.normalizedUsername) {
      statusText += '正規化為「' + formData.normalizedUsername + '」\n';
    }

    if (formData.requests.includes('CreateAccount')) {
      if (formData.usernameStatus === 'not_exists') {
        var googleurl = 'https://www.google.com/search?q=' + encodeURIComponent(formData.normalizedUsername);
        statusText += '✅ 帳號可以建立（<a href="' + googleurl + '">Google</a>）\n';
      }

      if (formData.usernameStatus === 'banned') {
        statusText += '❌ 此使用者名稱被系統禁止'
        if (formData.usernameBannedDetail) {
          statusText += '：' + formData.usernameBannedDetail;
        }
        statusText += '\n';
      }
    }

    if (!formData.requests.includes('CreateAccount') && (formData.usernameStatus === 'banned' || formData.usernameStatus === 'not_exists')) {
      statusText += '❌ 帳號不存在\n';
    }

    if (formData.usernameStatus === 'needs_local') {
      if (formData.requests.includes('CreateAccount')) {
        statusText += '❌';
      } else {
        statusText += '✅';
      }
      var caurl = 'https://zh.wikipedia.org/wiki/Special:CentralAuth?target=' + encodeURIComponent(formData.normalizedUsername);
      statusText += ' 需要強制建立本地帳號（<a href="' + caurl + '">全域帳號</a>）\n';
    }

    if (formData.usernameStatus === 'exists') {
      if (formData.requests.includes('CreateAccount')) {
        statusText += '❌';
      } else {
        statusText += '✅';
      }
      var caurl = 'https://zh.wikipedia.org/wiki/Special:CentralAuth?target=' + encodeURIComponent(formData.normalizedUsername);
      var rightlog = 'https://zh.wikipedia.org/wiki/Special:Log/rights?page=' + encodeURIComponent('User:' + formData.normalizedUsername);
      statusText += ' 帳號已被註冊（<a href="' + caurl + '">全域帳號</a>、<a href="' + rightlog + '">權限日誌</a>）\n';
    }

    if (formData.accountBlocked) {
      var blocklog = 'https://zh.wikipedia.org/wiki/Special:Log/block?page=User:' + encodeURIComponent(formData.normalizedUsername);
      statusText += '⛔️ <a href="' + blocklog + '">帳號被封鎖</a>\n';
    }
  }

  if (formData.ip) {
    var blocklisturl = 'https://zh.wikipedia.org/wiki/Special:BlockList?wpTarget=' + formData.ip;
    if (formData.blocked) {
      if (formData.isProxyBlocked) {
        statusText += '✅';
      } else {
        statusText += '⚠️';
      }
      statusText += ' IP被封鎖：' + formData.blockReason;
    } else {
      statusText += '❌ IP未被封鎖';
    }
    statusText += '（<a href="' + blocklisturl + '">檢查</a>）\n';
  }

  if (formData.accountHasIpbe) {
    statusText += '❌ 使用者已擁有IPBE\n';
  }

  var statusTextParagraph = CardService.newTextParagraph().setText(statusText);
  sectionInfo.addWidget(statusTextParagraph);

  var actionCheckboxes = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .setFieldName('actionOptions')
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateSelectionInput')
      .setParameters({ key: 'actionOptions' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );

  var anyAction = false;

  if (formData.requests.includes('CreateAccount') && formData.usernameStatus === 'not_exists') {
    actionCheckboxes.addItem('建立帳號' + formData.statusCreateAcccount,
      'CreateAccount', formData.actionOptions.includes('CreateAccount'));
    anyAction = true;
  }

  if (formData.requests.includes('CreateAccount') && formData.usernameStatus === 'needs_local') {
    actionCheckboxes.addItem('強制建立本地帳號' + formData.statusCreateLocal,
      'CreateLocal', formData.actionOptions.includes('CreateLocal'));
    anyAction = true;
  }

  if (formData.normalizedUsername) {
    actionCheckboxes.addItem('授予IPBE、通知、備案' + formData.statusGrantIpbe,
      'GrantIpbe', formData.actionOptions.includes('GrantIpbe'));
    anyAction = true;
  }

  if (formData.normalizedUsername) {
    actionCheckboxes.addItem('重設「' + formData.normalizedUsername + '」密碼' + formData.statusResetPasswordEmail,
      'ResetPasswordUsername', formData.actionOptions.includes('ResetPasswordUsername'));
    anyAction = true;
  }

  if (formData.email) {
    actionCheckboxes.addItem('重設「' + formData.email + '」密碼' + formData.statusResetPasswordEmail,
      'ResetPasswordEmail', formData.actionOptions.includes('ResetPasswordEmail'));
    anyAction = true;
  }

  if (anyAction) {
    sectionInfo.addWidget(actionCheckboxes);
  }

  var textInputSummary = CardService.newTextInput()
    .setFieldName('summary')
    .setTitle('操作摘要')
    .setValue(formData.summary)
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateTextInput')
      .setParameters({ key: 'summary' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionInfo.addWidget(textInputSummary);

  var buttonRun = CardService.newTextButton()
    .setText('以 ' + wpUsername + ' 的身分進行選定的操作')
    .setOnClickAction(CardService.newAction().setFunctionName('runActions'))
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);

  sectionInfo.addWidget(buttonRun);

  card.addSection(sectionInfo);

  // section: mail
  var sectionMail = CardService.newCardSection()
    .setHeader('回覆郵件');

  var mailContentCore = generateMailContent(formData);

  var mailContent = mailContentCore;
  mailContent += '\n\n' + mt('mail-reply-to-all');
  mailContent += '\n\n' + 'User:' + wpUsername;

  var mailContentParagraph = CardService.newTextParagraph()
    .setText(mailContentCore);
  sectionMail.addWidget(mailContentParagraph);

  var mailButton = CardService.newTextButton()
    .setText('產生郵件')
    .setComposeAction(
      CardService.newAction()
        .setFunctionName('onWriteMail')
        .setParameters({ mailBody: mailContent }),
      CardService.ComposedEmailType.REPLY_AS_DRAFT
    )
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED);
  sectionMail.addWidget(mailButton);

  var mailUsernameRadio = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setTitle('使用者名稱')
    .setFieldName('mailOptionsUsername')
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem('未給', 'nousername', formData.mailOptionsUsername === 'nousername')
    .addItem('已被占用', 'used', formData.mailOptionsUsername === 'used')
    .addItem('被系統禁止', 'banned', formData.mailOptionsUsername === 'banned')
    .addItem('違反方針', 'illeagal', formData.mailOptionsUsername === 'illeagal')
    .addItem('已建立帳號', 'created', formData.mailOptionsUsername === 'created')
    .addItem('已強制建立本地帳號', 'local', formData.mailOptionsUsername === 'local')
    .addItem('申請IPBE所給帳號不存在', 'local', formData.mailOptionsUsername === 'not_exists')
    .addItem('無', '', formData.mailOptionsUsername === '')
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateTextInput')
      .setParameters({ key: 'mailOptionsUsername' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionMail.addWidget(mailUsernameRadio);

  var mailIpbeRadio = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setTitle('IP地址')
    .setFieldName('mailOptionsIpbe')
    .setType(CardService.SelectionInputType.DROPDOWN)
    .addItem('未給', 'noip', formData.mailOptionsIpbe === 'noip')
    .addItem('未被封鎖', 'not_blocked', formData.mailOptionsIpbe === 'not_blocked')
    .addItem('已授予IPBE', 'granted', formData.mailOptionsIpbe === 'granted')
    .addItem('可能需要IPBE', 'may_need', formData.mailOptionsIpbe === 'may_need')
    .addItem('無', '', formData.mailOptionsIpbe === '')
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateTextInput')
      .setParameters({ key: 'mailOptionsIpbe' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionMail.addWidget(mailIpbeRadio);

  var mailOtherRadio = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setFieldName('mailOptionsOther')
    .setType(CardService.SelectionInputType.CHECK_BOX)
    .addItem('已重設密碼', 'resetpwd', formData.mailOptionsOther.includes('resetpwd'))
    .addItem('開放代理', 'proxy', formData.mailOptionsOther.includes('proxy'))
    .addItem('段封鎖', 'range', formData.mailOptionsOther.includes('range'))
    .addItem('英文百科封鎖', 'enwiki', formData.mailOptionsOther.includes('enwiki'))
    .addItem('全域封鎖', 'gipbe', formData.mailOptionsOther.includes('gipbe'))
    .addItem('公司/組織', 'company', formData.mailOptionsOther.includes('company'))
    .addItem('自動登出', 'autologout', formData.mailOptionsOther.includes('autologout'))
    .addItem('更名', 'rename', formData.mailOptionsOther.includes('rename'))
    .addItem('尋站內', 'talkpage', formData.mailOptionsOther.includes('talkpage'))
    .addItem('已申訴', 'requested', formData.mailOptionsOther.includes('requested'))
    .addItem('無法理解', 'nonsense', formData.mailOptionsOther.includes('nonsense'))
    .addItem('非申訴', 'wrongplace', formData.mailOptionsOther.includes('wrongplace'))
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateSelectionInput')
      .setParameters({ key: 'mailOptionsOther' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionMail.addWidget(mailOtherRadio);

  var radioGroup = CardService.newSelectionInput()
    .setTitle('語言變體')
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName('mailOptionsVariant')
    .addItem('簡體', 'zh-hans', true)
    .addItem('繁體', 'zh-hant', false)
    .setOnChangeAction(CardService.newAction()
      .setFunctionName('updateTextInput')
      .setParameters({ key: 'mailOptionsVariant' })
      .setLoadIndicator(CardService.LoadIndicator.SPINNER)
    );
  sectionMail.addWidget(radioGroup);

  card.addSection(sectionMail);

  // section: debug
  var sectionDebug = CardService.newCardSection()
    .setHeader('Debug')
    .setCollapsible(true);

  var debugText = '';
  for (var key in formData) {
    debugText += key + ': ' + JSON.stringify(formData[key]) + '\n';
  }

  sectionDebug.addWidget(CardService.newTextParagraph().setText(debugText));

  card.addSection(sectionDebug);

  return card.build();
}

function updateInputValue(e) {
  console.log(e.parameters);

  var formData = getFormData();
  for (const key in e.parameters) {
    formData[key] = e.parameters[key];

    if (key === 'username' || key === 'ip') {
      formData.needChecks = true;
    }
  }
  putFormData(formData);

  var navigation = CardService.newNavigation().updateCard(createCard(e));
  var actionResponse = CardService.newActionResponseBuilder().setNavigation(navigation).setStateChanged(true);
  return actionResponse.build();
}

function updateTextInput(e) {
  console.log('formInput', JSON.stringify(e.formInput));
  console.log('parameters', JSON.stringify(e.parameters));

  var formData = getFormData();
  var key = e.parameters.key;
  var newVal = e.formInput[key] || '';
  console.log('Update "' + key + '" from "' + formData[key] + '" to "' + newVal + '"');

  formData[key] = newVal;
  if (key === 'username' || key === 'ip') {
    formData.needChecks = true;
  }
  putFormData(formData);

  var navigation = CardService.newNavigation().updateCard(createCard(e));
  var actionResponse = CardService.newActionResponseBuilder().setNavigation(navigation).setStateChanged(true);
  return actionResponse.build();
}

function updateSelectionInput(e) {
  console.log('formInputs', JSON.stringify(e.formInputs));
  console.log('parameters', JSON.stringify(e.parameters));

  var formData = getFormData();
  var newVal = e.formInputs[e.parameters.key] || [];
  console.log('Update "' + e.parameters.key + '" from "' + JSON.stringify(formData[e.parameters.key]) + '" to "' + JSON.stringify(newVal) + '"');
  formData[e.parameters.key] = newVal;
  putFormData(formData);

  if (e.parameters.key === 'requests' || e.parameters.key === 'actionOptions') {
    autoMailOptions();
  }

  var navigation = CardService.newNavigation().updateCard(createCard(e));
  var actionResponse = CardService.newActionResponseBuilder().setNavigation(navigation).setStateChanged(true);
  return actionResponse.build();
}

function autoActionOptions() {
  var formData = getFormData();

  console.log('autoActionOptions', JSON.stringify(formData));

  var userToBeCreated = false;
  if (formData.requests.includes('CreateAccount')) {
    if (formData.normalizedUsername) {
      if (formData.usernameStatus == 'not_exists') {
        formData.actionOptions.push('CreateAccount');
        formData.mailOptionsUsername = 'created';
        userToBeCreated = true;
      } else if (formData.usernameStatus == 'banned') {
        formData.mailOptionsUsername = 'banned';
      } else if (formData.usernameStatus == 'exists') {
        formData.mailOptionsUsername = 'used';
      }
    } else {
      formData.mailOptionsUsername = 'nousername';
    }
  }
  if (
    formData.requests.includes('GrantIpbe') &&
    ((!formData.requests.includes('CreateAccount') &&
      (formData.usernameStatus === 'exists' || formData.usernameStatus == 'needs_local')) ||
      userToBeCreated) &&
    formData.ip &&
    formData.blocked &&
    !formData.accountBlocked &&
    !formData.accountHasIpbe
  ) {
    if (formData.usernameStatus == 'needs_local') {
      formData.actionOptions.push('CreateLocal');
    }
    if (formData.isProxyBlocked) {
      formData.actionOptions.push('GrantIpbe');
    }
  }
  if (formData.requests.includes('ResetPassword')) {
    if (formData.username) {
      if (!formData.requests.includes('CreateAccount') && formData.usernameStatus == 'needs_local') {
        formData.actionOptions.push('CreateLocal');
      }
      formData.actionOptions.push('ResetPasswordUser');
    } else if (formData.email) {
      formData.actionOptions.push('ResetPasswordEmail');
    }
  }

  formData.actionOptions = [...new Set(formData.actionOptions)];

  putFormData(formData);
}

function autoMailOptions() {
  var formData = getFormData();

  // username
  formData.mailOptionsUsername = '';
  if (formData.actionOptions.includes('CreateAccount')) {
    formData.mailOptionsUsername = 'created';
  } else if (formData.actionOptions.includes('CreateLocal')) {
    formData.mailOptionsUsername = 'local';
  } else if (formData.requests.includes('CreateAccount')) {
    if (formData.normalizedUsername) {
      if (formData.usernameStatus == 'exists' || formData.usernameStatus == 'needs_local') {
        formData.mailOptionsUsername = 'used';
      } else if (formData.usernameStatus == 'banned') {
        formData.mailOptionsUsername = 'banned';
      }
    } else {
      formData.mailOptionsUsername = 'nousername';
    }
  } else if (formData.requests.includes('GrantIpbe')) {
    if (!formData.normalizedUsername) {
      formData.mailOptionsUsername = 'nousername';
    } else if (formData.usernameStatus == 'banned' || formData.usernameStatus == 'not_exists') {
      formData.mailOptionsUsername = 'not_exists';
    }
  } else if (formData.inputBlockAppeal) {
    if (!formData.normalizedUsername) {
      formData.mailOptionsUsername = 'nousername';
    }
  } else if (formData.inputResetPassword) {
    if (!formData.normalizedUsername && !formData.email) {
      formData.mailOptionsUsername = 'nousername';
    }
  }

  // ipbe
  formData.mailOptionsIpbe = '';
  if (formData.actionOptions.includes('GrantIpbe')) {
    formData.mailOptionsIpbe = 'granted';
  } else {
    if (formData.requests.includes('GrantIpbe')) {
      if (formData.ip) {
        if (!formData.blocked) {
          formData.mailOptionsIpbe = 'not_blocked';
        }
      } else {
        formData.mailOptionsIpbe = 'noip';
      }
    } else if (formData.inputBlockAppeal && !formData.ip) {
      formData.mailOptionsIpbe = 'noip';
    }
  }

  // reset password
  formData.mailOptionsOther = formData.mailOptionsOther.filter((key) => key !== 'resetpwd');
  if (formData.actionOptions.includes('ResetPasswordUsername')
    || formData.actionOptions.includes('ResetPasswordEmail')) {
    formData.mailOptionsOther.push('resetpwd');
  }

  putFormData(formData);
}

function runActions(e) {
  // console.log(e);

  var formData = getFormData();

  if (formData.actionOptions.length === 0) {
    var actionResponse = CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('沒什麼好做的'))
      .build();
    return actionResponse;
  }

  if (formData.actionOptions.includes('ResetPasswordUsername') && formData.actionOptions.includes('ResetPasswordEmail')) {
    var actionResponse = CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('重設密碼選項僅能選取一個'))
      .build();
    return actionResponse;
  }

  if (
    !formData.summary &&
    !(formData.actionOptions.length === 1 &&
      (formData.actionOptions.includes('ResetPasswordUsername') ||
        formData.actionOptions.includes('ResetPasswordEmail'))
    )
  ) {
    var actionResponse = CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('請輸入操作摘要'))
      .build();
    return actionResponse;
  }

  if (formData.actionOptions.includes('CreateAccount') && !formData.email) {
    var actionResponse = CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('請輸入Email'))
      .build();
    return actionResponse;
  }

  var res = apiRequest('POST', {
    'action': 'query',
    'meta': 'tokens',
    'type': 'userrights|csrf|createaccount'
  });
  var tokens = res.query.tokens;
  console.log('tokens', tokens);

  if (formData.actionOptions.includes('CreateAccount') && formData.normalizedUsername) {
    var res = apiRequest('POST', {
      action: 'createaccount',
      username: formData.normalizedUsername,
      email: formData.email,
      // realname: '',
      mailpassword: '1',
      reason: formData.summary,
      createreturnurl: 'https://zh.wikipedia.org',
      createtoken: tokens.createaccounttoken,
    })
    console.log('createaccount', res);

    if (res.createaccount.status === 'FAIL') {
      formData.statusCreateAcccount = ' ❌ ' + res.createaccount.message;
    } else if (res.createaccount.status === 'PASS') {
      formData.statusCreateAcccount = ' ✅';
    } else {
      formData.statusCreateAcccount = ' ❌ 未知錯誤';
    }
  }

  if (formData.actionOptions.includes('CreateLocal') && formData.normalizedUsername) {
    var res = apiRequest('POST', {
      action: 'createlocalaccount',
      username: formData.normalizedUsername,
      reason: formData.summary,
      token: tokens.csrftoken,
    })
    console.log('createlocalaccount', res);

    if (res.error) {
      if (res.error[0] && res.error[0][0] && res.error[0][0].code) {
        formData.statusCreateLocal = ' ❌ ' + res.error[0][0].code;
      } else {
        formData.statusCreateLocal = ' ❌ 未知錯誤';
      }
    } else {
      formData.statusCreateLocal = ' ✅';
    }
  }

  if (formData.actionOptions.includes('GrantIpbe') && formData.normalizedUsername) {
    /*
    var res = apiRequest('POST', {
      action: 'userrights',
      user: formData.normalizedUsername,
      add: 'ipblock-exempt',
      expiry: 'infinite',
      reason: '+IP封鎖例外，' + formData.summary,
      token: tokens.userrightstoken,
    });
    console.log('userrights', res);

    formData.statusGrantIpbe = ' ✅';

    // notice
    var message = '{{subst:Ipexempt granted}}';
    var usertalk = 'User talk:' + formData.normalizedUsername;
    var res = apiRequest('GET', {
      action: 'query',
      prop: 'info',
      titles: usertalk,
    });
    console.log('usertalk info', res);
    var page = res.query.pages[0];
    if (page.contentmodel === 'flow-board') {
      var res = apiRequest('POST', {
        action: 'flow',
        page: usertalk,
        submodule: 'new-topic',
        nttopic: '授予IP封鎖例外權通知',
        ntcontent: message,
        ntformat: 'wikitext',
      });

      if (res.error) {
        if (res.error.info) {
          formData.statusGrantIpbe += '❌ ' + res.error.info;
        } else {
          formData.statusGrantIpbe += '❌ 未知錯誤';
        }
      } else {
        formData.statusGrantIpbe += '✅';
      }
    } else {
      var res = apiRequest('POST', {
        'action': 'edit',
        'title': usertalk,
        'section': 'new',
        'sectiontitle': '',
        'text': '{{subst:Ipexempt granted}}',
        'summary': '授予IP封鎖例外權通知',
        'token': tokens.csrftoken,
      });

      if (res.error) {
        if (res.error.info) {
          formData.statusGrantIpbe += '❌ ' + res.error.info;
        } else {
          formData.statusGrantIpbe += '❌ 未知錯誤';
        }
      } else {
        formData.statusGrantIpbe += '✅';
      }
    }
*/
    // rfipbe
    var summary = '[[Special:UserRights/' + formData.normalizedUsername + '|授予' + formData.normalizedUsername + 'IP封禁例外權]]備案';
    var appendtext = '\n\n{{subst:rfp|1=' + formData.normalizedUsername + '|2=經由' + formData.summary + '的授權備案。|status=+}}';
    var res = apiRequest('POST', {
      'action': 'edit',
      'title': 'Wikipedia:權限申請/申請IP封禁例外權',
      'summary': summary,
      'appendtext': appendtext,
      'token': tokens.csrftoken,
    });
    console.log('rfipbe', res);
    if (res.error) {
      if (res.error.info) {
        formData.statusGrantIpbe += '❌ ' + res.error.info;
      } else {
        formData.statusGrantIpbe += '❌ 未知錯誤';
      }
    } else {
      formData.statusGrantIpbe += '✅';
    }
  }

  if (formData.actionOptions.includes('ResetPasswordUsername') && formData.normalizedUsername) {
    var res = apiRequest('POST', {
      action: 'resetpassword',
      user: formData.normalizedUsername,
      token: tokens.csrftoken,
    });
    console.log('resetpassword username', res);
    if (res.resetpassword && res.resetpassword.status === 'success') {
      formData.statusResetPasswordUsername = ' ✅';
    } else {
      formData.statusResetPasswordUsername = ' ❌ 未知錯誤';
    }
  }

  if (formData.actionOptions.includes('ResetPasswordEmail') && formData.normalizedUsername) {
    var res = apiRequest('POST', {
      action: 'resetpassword',
      email: formData.email,
      token: tokens.csrftoken,
    });
    console.log('resetpassword email', res);
    if (res.resetpassword && res.resetpassword.status === 'success') {
      formData.statusResetPasswordUsername = ' ✅';
    } else {
      formData.statusResetPasswordUsername = ' ❌ 未知錯誤';
    }
  }

  putFormData(formData);

  var navigation = CardService.newNavigation().updateCard(createCard(e));
  var actionResponse = CardService.newActionResponseBuilder().setNavigation(navigation).setStateChanged(true);
  return actionResponse.build();
}

function onWriteMail(e) {
  // console.log(e)

  var accessToken = e.gmail.accessToken;
  GmailApp.setCurrentMessageAccessToken(accessToken);

  var messageId = e.gmail.messageId;
  var message = GmailApp.getMessageById(messageId);
  var thread = message.getThread();
  var allMessages = thread.getMessages();
  var firstMessage = allMessages[0];
  var lastMessage = allMessages[allMessages.length - 1];
  var draft = thread.createDraftReply('');

  var subject = lastMessage.getSubject();
  var recipient = stripEmail(firstMessage.getFrom()) + ',' + UNBLOCK_ZH_MAIL;
  var body = e.parameters.mailBody;
  console.log('recipient: ' + recipient);
  console.log('subject: ' + subject);
  draft.update(recipient, subject, body + '\n');

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
