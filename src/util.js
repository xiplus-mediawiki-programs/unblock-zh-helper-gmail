function parseArchiveUrl(text) {
  var m = text.match(
    /https?:\/\/lists\.wikimedia\.org\/hyperkitty\/(list\/unblock-zh@lists\.wikimedia\.org\/(?:message|thread)\/[^/]+\/?)/
  );
  if (m) {
    return m[1];
  }
  return null;
}

function stripEmail(text) {
  text = text.replace(/^.+<((?:.+?)@.+?(?:\..+?)+)>$/, '$1');
  return text;
}

function cleanHtml(text) {
  return text
    .replace(/<\/dd>/g, '\n')
    .replace(/<\/div>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n');
}

function stripMailQuote(text) {
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/(\n>.*)*\n*$/, '');
  text = text.replace(/^(.*?)________________________________*(.*)$/s, '$1');
  return text;
}

function parseMailBody(text) {
  var result = {
    request: {
      acc: false,
      ipbe: false,
      unblock: false,
      password: false,
    },
    username: [],
    iporid: [],
  };

  if (text.match(/账号创建申请|申请注册|帮忙注册|想注册|还未注册/)) {
    result.request.acc = true;
  }
  if (text.match(/IP封禁(豁免|例外)|使用代理|来自中国大陆|blocked proxy|open (proxy|proxies)/)) {
    result.request.ipbe = true;
  }

  var matches = [
    ...text.matchAll(/(?:[账帐][户号]|用户名)是?[：:]?"(.+?)"/g),
    ...text.matchAll(/(?:[账帐][户号]|用户名)是?[：:]?“(.+?)”/g),
    ...text.matchAll(/(?:[账帐][户号]|用户名)是?[：:]?【(.+?)】/g),
    ...text.matchAll(/(?:[账帐][户号]|用户名)是?[：:]?\[(.+?)\]/g),
    ...text.matchAll(/(?:[账帐][户号]|用户名)(?:[是：:]|是[：:])\n?([^\[\]【】"“”：:，。\n]+)[，。\n]/g),
    ...text.matchAll(/user ?name.{0,20} is (.+?)\./g),
    ...text.matchAll(/user ?name: ([^,.]+?)[.,]/g),
  ].sort((a, b) => b.index - a.index);
  for (var match of matches) {
    var username = match[1].replace(/_/g, ' ');
    if (['请求的账户名称'].includes(username)) {
     continue;
    }
    if (!result.username.includes(username)) {
      result.username.push(username);
    }
  }

  var matches = [
    ...text.matchAll(/((?:\d{1,3}\.){3}\d{1,3})/g),
    ...text.matchAll(/((?:[a-f0-9:]+:+)+[a-f0-9]+)/g),
    ...text.matchAll(/(#\d{6})/g),
  ].sort((a, b) => b.index - a.index);
  for (var match of matches) {
    // extra test for ipv6
    if (/((?:[a-f0-9:]+:+)+[a-f0-9]+)/.test(match[1])) {
      if (/^(?::(?::|(?::[0-9A-Fa-f]{1,4}){1,7})|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6}::|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){7})$/.test(match[1])) {
        result.iporid.push(match[1]);
        continue
      }
      if (/^[0-9A-Fa-f]{1,4}(?:::?[0-9A-Fa-f]{1,4}){1,6}$/.test(match[1]) && /::/.test(match[1])) {
        result.iporid.push(match[1]);
        continue
      }
    } else {
      result.iporid.push(match[1]);
    }
  }
  result.iporid = [...new Set(result.iporid)];

  return result;
}

function getReplySubject(subject) {
  if (/^Re:/.test(subject)) {
    return subject;
  }
  return 'Re: ' + subject;
}

var curMailVariant = 'zh-hans';

function mt(key, params) {
  var text = i18nMessages[curMailVariant][key] || key;
  if (params) {
    for (var i = 0; i < params.length; i++) {
      text = text.replaceAll('{' + i + '}', params[i]);
    }
  }
  return text;
}

function generateMailContent(formData) {
  curMailVariant = formData.mailOptionsVariant;

  const useUsernameChecker = mt('use-username-checker', [
    '[LINK:https://zhwiki-username-check.toolforge.org]',
  ]);
  let textParts = [];
  let mainText = [];
  let otherText = [];
  let pleaseProvide = [];
  let pleaseProvideHeader = '';
  let pleaseProvideAppend = '';
  // Other
  if (formData.mailOptionsOther.includes('company')) {
    textParts.push(
      mt('mail-company', [
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:用户名]',
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:有償編輯方針#如何作出申報]',
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:有償編輯方針#本地替代方針]',
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:如何介绍自己的公司] ',
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:互助客栈/求助] ',
      ])
    );
  }
  if (formData.mailOptionsOther.includes('proxy')) {
    textParts.push(mt('mail-no-open-proxy', ['[LINK:https://meta.wikimedia.org/wiki/No_open_proxies/zh]']));
    pleaseProvide.push(mt('mail-your-username', ['[LINK:https://zh.wikipedia.org/wiki/Special:Preferences]']));
    pleaseProvideAppend = mt('mail-no-account-give-username') + useUsernameChecker;
  }
  if (formData.mailOptionsOther.includes('range')) {
    textParts.push(mt('mail-range-block') + useUsernameChecker);
  }
  if (formData.mailOptionsOther.includes('enwiki')) {
    textParts.push(
      mt('mail-only-handle-zhwiki', ['[LINK:https://zh.wikipedia.org]']) +
      '\n' +
      mt('mail-go-enwiki', ['[LINK:https://en.wikipedia.org/wiki/Wikipedia:Unblock_Ticket_Request_System]'])
    );
  }
  if (formData.mailOptionsOther.includes('gipbe')) {
    textParts.push(
      mt('mail-only-handle-zhwiki', ['[LINK:https://zh.wikipedia.org]']) +
      '\n' +
      mt('mail-gipbe-go-meta', ['[LINK:https://meta.wikimedia.org/wiki/IP_block_exempt/zh]'])
    );
  }
  if (formData.mailOptionsOther.includes('rename')) {
    mainText.push(mt('mail-user-rename', ['[LINK:https://zh.wikipedia.org/wiki/Special:全域重命名申请]']));
  }
  if (formData.mailOptionsOther.includes('talkpage')) {
    mainText.push(
      mt('mail-go-talkpage', [
        '[LINK:https://zh.wikipedia.org/w/index.php?title=Special:MyTalk&action=edit&preload=Template%3AUnblock%2Fpreload2&section=new]',
      ])
    );
  }
  if (formData.mailOptionsOther.includes('requested')) {
    mainText.push(mt('mail-talkpage-requested'));
  }
  if (formData.mailOptionsOther.includes('nonsense')) {
    mainText.push(
      mt('mail-can-not-understand', [
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:通过Unblock-zh申请IP封禁例外指南]',
      ])
    );
  }
  if (formData.mailOptionsOther.includes('wrongplace')) {
    mainText.push(
      mt('mail-not-unblock', [
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:互助客栈/求助]',
        '[LINK:https://zh.wikipedia.org/wiki/Wikipedia:中文維基百科志願者互聯交流群]',
      ])
    );
  }
  // account
  if (formData.mailOptionsUsername === 'nousername') {
    if (formData.mailOptionsOther.includes('proxy')) {
      // pass for proxy
    } else if (formData.requests.includes('CreateAccount')) {
      pleaseProvide.push(mt('mail-wanted-username') + useUsernameChecker);
    } else if (formData.requests.includes('GrantIpbe')) {
      pleaseProvide.push(
        mt('mail-your-username', ['[LINK:https://zh.wikipedia.org/wiki/Special:Preferences]'])
      );
      if (formData.requests.includes('GrantIpbe')) {
        pleaseProvideAppend = mt('mail-no-account-give-username') + useUsernameChecker;
      }
    } else if (formData.requests.includes('ResetPassword')) {
      pleaseProvide.push(mt('mail-your-username-help-reset'));
    }
  } else if (formData.mailOptionsUsername === 'used') {
    var caurl = 'https://zh.wikipedia.org/wiki/Special:CentralAuth?target=' + encodeURIComponent(formData.normalizedUsername);
    if (formData.usernameRegistration) {
      let dateStr = new Date(formData.usernameRegistration).toLocaleDateString('zh');
      mainText.push(
        mt('mail-username-exists-with-registration', [
          dateStr,
          '[LINK:' + caurl + ']',
        ]) + useUsernameChecker
      );
    } else {
      mainText.push(
        mt('mail-username-exists-without-registration', [
          '[LINK:' + caurl + ']',
        ]) + useUsernameChecker
      );
    }
  } else if (formData.mailOptionsUsername === 'banned') {
    mainText.push(mt('mail-username-banned-provide-another') + useUsernameChecker);
  } else if (formData.mailOptionsUsername === 'illegal') {
    mainText.push(
      mt('mail-username-illeagal-provide-another', ['[LINK:https://zh.wikipedia.org/wiki/Wikipedia:用户名]']) +
      useUsernameChecker
    );
  } else if (formData.mailOptionsUsername === 'created') {
    mainText.push(mt('mail-account-created', [formData.normalizedUsername, formData.email]));
  } else if (formData.mailOptionsUsername === 'not_exists') {
    mainText.push(
      mt('mail-username-not-exists', ['[LINK:https://zh.wikipedia.org/wiki/Special:Preferences]'])
    );
  } else if (formData.mailOptionsUsername === 'local') {
    mainText.push(mt('mail-create-local'));
  }
  if (formData.mailOptionsUsername !== '' && formData.mailOptionsOther.includes('company')) {
    pleaseProvide.push(mt('mail-private-email'));
  }
  // IPBE
  if (formData.mailOptionsIpbe === 'noip' || formData.mailOptionsIpbe === 'may_need') {
    if (formData.mailOptionsIpbe === 'may_need') {
      pleaseProvideHeader = mt('mail-cannot-edit-after-login') + '\n';
    }
    pleaseProvide.push(mt('mail-blocked-ip'));
    pleaseProvide.push(mt('mail-block-id'));
  } else if (formData.mailOptionsIpbe === 'not_blocked') {
    otherText.push(mt('mail-ip-not-blocked'));
  } else if (formData.mailOptionsIpbe === 'granted') {
    mainText.push(mt('mail-ipbe-granted'));
  }
  // Password
  if (formData.mailOptionsOther.includes('resetpwd')) {
    mainText.push(mt('mail-password-reset'));
    if (formData.requests.includes('GrantIpbe') && formData.mailOptionsIpbe === '') {
      mainText.push(mt('mail-make-sure-login'));
    }
  }
  // Other
  if (formData.mailOptionsOther.includes('autologout')) {
    mainText.push(mt('mail-resolve-autologout', ['[LINK:https://zh.wikipedia.org/wiki/Help:自動登出]']));
  }
  // Main end
  if (mainText.length > 0) {
    textParts.push(mainText.join('\n'));
  }
  let provideText = '';
  if (pleaseProvide.length === 1) {
    provideText += mt('mail-please-provide') + pleaseProvide[0];
  } else if (pleaseProvide.length > 1) {
    if (pleaseProvideHeader) {
      provideText += pleaseProvideHeader;
    } else {
      provideText += mt('mail-please-provide-following') + '\n';
    }
    for (let i = 0; i < pleaseProvide.length; i++) {
      provideText += mt('mail-please-provide-row', [i + 1, pleaseProvide[i]]) + '\n';
    }
    provideText += mt('mail-please-provide-footer');
  }
  if (pleaseProvideAppend) {
    provideText += '\n' + pleaseProvideAppend;
  }
  if (provideText) {
    textParts.push(provideText);
  }
  if (otherText.length > 0) {
    textParts.push(otherText.join('\n'));
  }
  let allText = mt('mail-hello') + '\n' + textParts.join('\n\n');
  let linksText = [];
  let linksCount = 0;
  allText = allText.replace(/\[LINK:([^\]]+?)\]/g, function(match, link) {
    linksCount++;
    linksText.push('[' + linksCount + '] ' + link);
    return '[' + linksCount + ']';
  });
  if (linksCount > 0) {
    allText += '\n\n' + linksText.join('\n');
  }
  return allText;
}

if (typeof module === 'object') {
  module.exports = {
    parseArchiveUrl: parseArchiveUrl,
    stripEmail: stripEmail,
    stripMailQuote: stripMailQuote,
    parseMailBody: parseMailBody,
    getReplySubject: getReplySubject,
  };
}
