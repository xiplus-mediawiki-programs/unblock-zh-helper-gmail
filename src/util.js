function stripEmail(text) {
  text = text.replace(/^.+<((?:.+?)@.+?(?:\..+?)+)>$/, '$1');
  return text;
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

  if (text.match(/账号创建申请|申请注册账户/)) {
    result.request.acc = true;
  }

  var matches = [
    ...text.matchAll(/用户名是"(.+?)"/g),
    ...text.matchAll(/申请注册账户\[(.+?)\]/g),
  ].sort((a, b) => b.index - a.index);
  for (var match of matches) {
    if (!result.username.includes(match[1])) {
      result.username.push(match[1]);
    }
  }

  var matches = [
    ...text.matchAll(/((?:\d{1,3}\.){3}\d{1,3})/g),
    ...text.matchAll(/((?::(?::|(?::[0-9A-Fa-f]{1,4}){1,7})|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6}::|[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){7}))/g),
    ...text.matchAll(/查封ID是(#\d{6})/g),
  ].sort((a, b) => b.index - a.index);
  for (var match of matches) {
    if (!result.iporid.includes(match[1])) {
      result.iporid.push(match[1]);
    }
  }

  return result;
}

if (typeof module === 'object') {
  module.exports = {
    stripEmail: stripEmail,
    stripMailQuote: stripMailQuote,
    parseMailBody: parseMailBody,
  };
}
