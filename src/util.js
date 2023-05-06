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
  var m = text.match(/([\w.-]+@\w+(\.\w+)+)/g);
  if (m) {
    return Object.values(m);
  }
  return m || [];
}

function cleanHtml(text) {
  return text
    .replace(/(<br[ >])/g, '\n$1')
    .replace(/<br\/>/g, '\n')
    .replace(/<\/dd>/g, '\n')
    .replace(/(<dd[ >])/g, '\n$1')
    .replace(/<\/li>/g, '\n')
    .replace(/<\/div>/g, '\n')
    .replace(/(<div[ >])/g, '\n$1')
    .replace(/<\/?p>/g, '\n')
    .replace(/(<p[ >])/g, '\n$1')
    .replace(/<\/?pre>/g, '\n')
    .replace(/(<pre[ >])/g, '\n$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n')
    .replace(/\u00A0/g, ' ') // non-breaking space
    .replace(/&#xff1a;/g, '：')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"');
}

function htmlentities(str) {
  return str.replace(/[<>&]/g, function(i) {
    return '&#' + i.charCodeAt(0) + ';';
  });
}

function stripMailQuote(text) {
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/(\n>.*)*\n*$/, '');
  text = text.replace(/^(.*?)________________________________*(.*)$/s, '$1');
  text = text.replace(/^(.*?)---*\s*原始邮件(.*)$/s, '$1');
  text = text.replace(/^(.*?)于\d+年\d+月\d+日.{0,10} \d+:\d+写道：(.*)$/s, '$1');
  return text;
}

var BANNED_USERNAMES = [
  '',
  '否可用',
  '您想要使用的用戶名',
  '您想要使用的用户名',
  '您的用戶名',
  '您的用户名',
  '您的使用者名稱',
  '请求的帐户名称',
  '请求的账户名称',
  '还未注册',
];

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

  if (text.match(/账号.{0,10}(申请|注册)|(申请|帮忙|想|[還还]未|希望)[註注][冊册]|进行注册|(希望|需要|申请).{0,10}用[户戶]名|创建.{0,10}账号|Account request/)) {
    result.request.acc = true;
  }
  if (text.match(/IP(封[禁鎖])?(豁免|例外)|使用代理|中国大陆|当前的IP地址|blocked proxy|open (proxy|proxies)|(ban|block(ing)?) (exception|exemption)/i)) {
    result.request.ipbe = true;
  }

  var matches = [
    ...text.matchAll(/(?:(?:[帳账帐][戶户號号]|用[户戶]|使用[者著])(?:名[称稱]?)?)[是為]?[：:]?\s*"(?:User:)?(.*?)"/g),
    ...text.matchAll(/(?:(?:[帳账帐][戶户號号]|用[户戶]|使用[者著])(?:名[称稱]?)?)[是為]?[：:]?\s*“(?:User:)?(.*?)”/g),
    ...text.matchAll(/(?:(?:[帳账帐][戶户號号]|用[户戶]|使用[者著])(?:名[称稱]?)?)[是為]?[：:]?\s*【(?:User:)?(.*?)】/g),
    ...text.matchAll(/(?:(?:[帳账帐][戶户號号]|用[户戶]|使用[者著])(?:名[称稱]?)?)[是為]?[：:]?\s*[\[［【「]\s*(?:User:)?(.*?)\s*[\]］】」]/g),
    ...text.matchAll(/(?:(?:[帳账帐][戶户號号]|用[户戶]|使用[者著])(?:名[称稱]?)?)(?:[是為为：:]|[是為为][：:])\n?(?:User:)?([^\[\]［］【】「」"“”：:，、。；,\n]+)[，、。；,.\n]/g),
    ...text.matchAll(/创建名为(.+?)的账户/g),
    ...text.matchAll(/来自维基百科用户“(.+?)”的电子邮件/g),
    ...text.matchAll(/[为為][\[［【「](.+?)[\]］】」]申[请請]IP/g),
    ...text.matchAll(/(?:user ?(?:name|id)|account).{0,20} is\s*:?\s*([^\[\]"“”「」]+?)[.,\n]/ig),
    ...text.matchAll(/(?:user ?(?:name|id)|account).{0,20} is \[([^\[\]]+?)\]/ig),
    ...text.matchAll(/(?:user ?(?:name|id)|account).{0,20} is ["“「]([^\[\]"]+?)["”」]/ig),
    ...text.matchAll(/(?:user ?(?:name|id)|account).{0,20}[:：] ?([^,.，。；\n]+?)[.,，。；\n]/ig),
  ].sort((a, b) => b.index - a.index);
  for (var match of matches) {
    var username = match[1]
      .replace(/_/g, ' ')
      .replace(/\u200B/g, '') // zero width space
      .trim();
    if (username === '') {
      continue;
    }
    username = username[0].toUpperCase() + username.slice(1);
    if (BANNED_USERNAMES.includes(username)) {
      continue;
    }
    if (!result.username.includes(username)) {
      result.username.push(username);
    }
  }

  var matches = [
    ...text.matchAll(/((?:\d{1,3}\.){3}\d{1,3})/g),
    ...text.matchAll(/((?:[0-9A-Fa-f:]+:+)+(?:[0-9A-Fa-f]+)?)/ig),
    ...text.matchAll(/(#[1-4]\d{5})/g),
  ].sort((a, b) => b.index - a.index);
  for (var match of matches) {
    // extra test for ipv6
    if (/((?:[0-9A-Fa-f:]+:+)+(?:[0-9A-Fa-f]+)?)/.test(match[1])) {
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
    } else if (formData.reqAccount) {
      pleaseProvide.push(mt('mail-wanted-username') + useUsernameChecker);
    } else if (formData.reqIpbe || formData.reqUnblock) {
      pleaseProvide.push(
        mt('mail-your-username', ['[LINK:https://zh.wikipedia.org/wiki/Special:Preferences]'])
      );
      if (formData.reqIpbe) {
        pleaseProvideAppend = mt('mail-no-account-give-username') + useUsernameChecker;
      }
    } else if (formData.reqPassword) {
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
    mainText.push(mt('mail-ipbe-granted', [formData.normalizedUsername]));
  }
  // Password
  if (formData.mailOptionsOther.includes('resetpwd')) {
    mainText.push(mt('mail-password-reset'));
    if (formData.reqIpbe && formData.mailOptionsIpbe === '') {
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
