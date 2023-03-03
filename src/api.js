function checkStatus(username, ip) {
  if (username === '-') {
    username = '';
  }

  var result = {
    needChecks: false,
    usernameStatus: '',
    usernameRegistration: '',
    usernameBannedDetail: '',
    normalizedUsername: '',
    accountBlocked: false,
    accountBlockBy: '',
    accountBlockReason: '',
    ipStatus: '',
    blocked: false,
    isProxyBlocked: false,
    blockBy: '',
    blockReason: '',
    accountHasIpbe: false,
  };

  if (!username && !ip) {
    return result;
  }

  if (username) {
    var payload = {
      action: 'query',
      format: 'json',
      formatversion: '2',
      meta: 'globaluserinfo',
      list: 'users',
      usprop: 'cancreate|centralids',
      usattachedwiki: 'zhwiki',
      guiuser: username,
      ususers: username,
    }
    var resp = UrlFetchApp.fetch('https://login.wikimedia.org/w/api.php', {
      'method': 'GET',
      'payload': payload,
      'muteHttpExceptions': true,
    });
    var res = JSON.parse(resp.getContentText('utf-8'));
    console.log('check result 1', JSON.stringify(res));

    if (res.error) {
      if (res.error.code === 'baduser') {
        result.normalizedUsername = username;
        result.usernameStatus = 'baduser';
        result.usernameBannedDetail = res.error.info;
        return result;
      }
    }

    if (!res.query) {
      return result;
    }

    if (res.query.users) {
      var user = res.query.users[0];
      result.normalizedUsername = user.name;
      if (user.userid) {
        if (user.attachedwiki.CentralAuth) {
          result.usernameStatus = 'exists';
        } else {
          result.usernameStatus = 'needs_local';
        }
      } else if (user.invalid) {
        result.usernameStatus = 'banned';
      } else if (user.cancreateerror) {
        result.usernameStatus = 'not_exists';
        var cancreateerror = user.cancreateerror[0];
        if (cancreateerror.code === 'userexists') {
          result.usernameStatus = 'needs_local';
        } else if (cancreateerror.code === 'invaliduser') {
          result.usernameStatus = 'banned';
          result.usernameBannedDetail = '使用者名稱無效（電子郵件地址等）。';
        } else if (cancreateerror.code === 'antispoof-name-illegal') {
          result.usernameStatus = 'banned';
          result.usernameBannedDetail = '使用者名稱無效：' + cancreateerror.params[1];
        } else if (cancreateerror.code === 'titleblacklist-forbidden') {
          result.usernameStatus = 'banned_cancreate';
          result.usernameBannedDetail = 'titleblacklist：' + cancreateerror.params[0];
        } else if (cancreateerror.code === '_1') {
          result.usernameStatus = 'banned';
          result.usernameBannedDetail = cancreateerror.params[0]
            .replace(/<\/li><li>/g, '", "')
            .replace('<ul><li>', ' "')
            .replace(/<\/li><\/ul>/g, '". ');
        } else if (cancreateerror.code === '_1_2_3') {
          result.usernameStatus = 'banned';
          result.usernameBannedDetail = cancreateerror.params[0] + cancreateerror.params[1]
            .replace(/<\/li><li>/g, '", "')
            .replace('<ul><li>', ' "')
            .replace(/<\/li><\/ul>/g, '". ') + cancreateerror.params[2];
        } else {
          result.usernameStatus = 'banned';
        }
      } else {
        result.usernameStatus = 'not_exists';
      }
    }

    var globaluserinfo = res.query.globaluserinfo;
    if (globaluserinfo) {
      if (globaluserinfo.registration) {
        result.usernameRegistration = globaluserinfo.registration;
      }
      if (result.usernameStatus === 'needs_local' && globaluserinfo.home === 'zhwiki') {
        result.usernameStatus = 'exists';
      }
    }
  }

  var query = {
    action: 'query',
    list: [],
  }

  if (username) {
    query.list.push('users');
    query.usprop = 'blockinfo|registration|groupmemberships';
    query.ususers = username;
  }
  if (ip) {
    query.list.push('blocks');
    query.bkprop = 'by|reason|userid';
    if (/^#\d+$/.test(ip)) {
      query.bkids = ip.substr(1);
    } else {
      query.list.push('globalblocks');
      query.bkip = ip;
      query.bgprop = 'by|reason';
      query.bgip = ip;
    }
  }

  query.list = query.list.join('|');

  var res = apiRequest('GET', query);
  console.log('check result 2', JSON.stringify(res));

  if (res.error) {
    if (res.error.code === 'param_ip') {
      result.ipStatus = 'param_ip';
      result.blockReason = res.error.info;
      return result;
    }
  }

  if (!res.query) {
    return result;
  }

  result.ipStatus = 'ok';

  if (res.query.users) {
    var user = res.query.users[0];

    // account block and ipbe
    if (user.blockid) {
      result.accountBlocked = true;
      result.accountBlockBy = user.blockedby;
      result.accountBlockReason = user.blockreason;
    }
    if (user.groupmemberships) {
      for (var row of user.groupmemberships) {
        if (row.group === 'ipblock-exempt') {
          result.accountHasIpbe = true;
          break;
        }
      }
    }
  }

  // ip block
  if (res.query.blocks && res.query.blocks.length > 0) {
    var block = res.query.blocks[0];
    if (block.userid === 0 || block.userid === undefined) {
      result.blocked = true;
      result.blockBy = block.by;
      result.blockReason = block.reason;
    } else if (block.userid > 0) {
      // account blocks
      result.accountBlocked = true;
      result.accountBlockBy = block.by;
      result.accountBlockReason = block.reason;
    }
  }
  if (!result.blocked && res.query.globalblocks && res.query.globalblocks.length > 0) {
    result.blocked = true;
    result.blockBy = res.query.globalblocks[0].by;
    result.blockReason = res.query.globalblocks[0].reason;
  }
  if (/(blocked proxy|open (proxy|proxies))/i.test(result.blockReason) && !/ACC notice/.test(result.blockReason)) {
    result.isProxyBlocked = true;
  }
  result.blockReason = htmlentities(result.blockReason);

  return result;
}
