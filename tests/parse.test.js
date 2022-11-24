import { expect, test, describe } from 'vitest';
import { getReplySubject, parseArchiveUrl, parseMailBody, stripEmail, stripMailQuote } from '../src/util.js';

describe('parseArchiveUrl', async () => {
	test('in header', async () => {
		expect(parseArchiveUrl('<https://lists.wikimedia.org/hyperkitty/list/unblock-zh@lists.wikimedia.org/message/ABC123/>')).toBe('list/unblock-zh@lists.wikimedia.org/message/ABC123/')
	});

	test('in body', async () => {
		expect(parseArchiveUrl(`Unblock-zh邮件列表
unblock-zh@lists.wikimedia.org
https://lists.wikimedia.org/hyperkitty/list/unblock-zh@lists.wikimedia.org/message/ABC123/`)
		).toBe('list/unblock-zh@lists.wikimedia.org/message/ABC123/')
	});
});

describe('stripMailQuote', async () => {
	test('type 1', async () => {
		expect(stripMailQuote(`User:Xiplus

On Sun, Oct 9, 2022 at 10:22 AM User <user@example.org> wrote:

> 您好：
> 我是一名来自`)).toMatchSnapshot();
	});

	test('type 2', async () => {
		expect(stripMailQuote(`Test
________________________________
发件人`)).toMatchSnapshot();
	});

	test('type 3', async () => {
		expect(stripMailQuote(`Test
------------------ 原始邮件 ------------------
发件人:`)).toMatchSnapshot();
	});

	test('type 4', async () => {
		expect(stripMailQuote(`Test
---原始邮件---
发件人`)).toMatchSnapshot();
	});
});

describe('stripEmail', async () => {
	test('email', async () => {
		expect(stripEmail('alice@example.org')).toBe('alice@example.org');
		expect(stripEmail('Alice <alice@example.org>')).toBe('alice@example.org');
		expect(stripEmail('"Al ice" <alice@example.org>')).toBe('alice@example.org');
		expect(stripEmail('<alice@example.org>')).toBe('alice@example.org');
		expect(stripEmail('a <alice@example.org>, b <bob@example.org>')).toBe('alice@example.org');
	});
});

describe('getReplySubject', async () => {
	test('email', async () => {
		expect(getReplySubject('Test')).toBe('Re: Test');
		expect(getReplySubject('Re: Test')).toBe('Re: Test');
	});
});

describe('parseMailBody', async () => {
	test('request acct', async () => {
		expect(parseMailBody('账号创建申请').request.acc).toBeTruthy();
		expect(parseMailBody('账号申请').request.acc).toBeTruthy();
		expect(parseMailBody('申请注册账户').request.acc).toBeTruthy();
		expect(parseMailBody('申请注册维基百科账号').request.acc).toBeTruthy();
		expect(parseMailBody('想注册一个维基百科账号').request.acc).toBeTruthy();
		expect(parseMailBody('还未注册账户').request.acc).toBeTruthy();
		expect(parseMailBody('希望注册').request.acc).toBeTruthy();
		expect(parseMailBody('进行注册').request.acc).toBeTruthy();
		expect(parseMailBody('希望的用户名').request.acc).toBeTruthy();
		expect(parseMailBody('希望使用的用户名').request.acc).toBeTruthy();
		expect(parseMailBody('希望使用的用戶名').request.acc).toBeTruthy();
		expect(parseMailBody('需要的用户名').request.acc).toBeTruthy();
		expect(parseMailBody('创建维基账号').request.acc).toBeTruthy();
		expect(parseMailBody('账号注册').request.acc).toBeTruthy();
		expect(parseMailBody('申请的用户名').request.acc).toBeTruthy();
		expect(parseMailBody('還未註冊帳戶').request.acc).toBeTruthy();
		expect(parseMailBody('Account request').request.acc).toBeTruthy();
	});

	test('request ipbe', async () => {
		expect(parseMailBody('申请IP封禁例外').request.ipbe).toBeTruthy();
		expect(parseMailBody('IP封禁豁免申请').request.ipbe).toBeTruthy();
		expect(parseMailBody('IP封鎖例外權').request.ipbe).toBeTruthy();
		expect(parseMailBody('授予IP封禁豁免权').request.ipbe).toBeTruthy();
		expect(parseMailBody('来自中国大陆').request.ipbe).toBeTruthy();
		expect(parseMailBody('由于中国大陆防火墙').request.ipbe).toBeTruthy();
		expect(parseMailBody('当前的IP地址').request.ipbe).toBeTruthy();
		expect(parseMailBody('IP blocking exceptions').request.ipbe).toBeTruthy();
		expect(parseMailBody('IP ban exemption').request.ipbe).toBeTruthy();
	});

	test('username', async () => {
		expect(parseMailBody('我想注册的用户名是"Example"，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的用户名是[Example]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的用户名是[\n Example  ]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的用户名是 [ Example]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的用戶名是［Example] 。').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的使用者名稱是Example，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望创建的用户名為:Example，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的使用者名称是[Example ]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望创建的用户名為:Example、').username).toStrictEqual(['Example']);
		expect(parseMailBody('使用的用户名是“Example”').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的用户名是：【Example】').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望账号名称是：Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('用户名：Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是Example，').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是Example。').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是Example\nXXX').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是：Example。').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是Example,').username).toStrictEqual(['Example']);
		expect(parseMailBody('我拟定的用户名:\nExample\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('使用著名稱:Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('账号：Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('账号名：Example，').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的账号：Example.').username).toStrictEqual(['Example']);
		expect(parseMailBody('用户名是[Example]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('用户名是"Example"，').username).toStrictEqual(['Example']);
		expect(parseMailBody('用户名为：Example；').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名为User:Example，').username).toStrictEqual(['Example']);
		expect(parseMailBody('申请注册账户[Example]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('申请注册帐户【Example】').username).toStrictEqual(['Example']);
		expect(parseMailBody('创建名为Example的账户').username).toStrictEqual(['Example']);
		expect(parseMailBody('来自维基百科用户“Example”的电子邮件').username).toStrictEqual(['Example']);
		// two name
		expect(parseMailBody('申请注册账户[A] 申请注册账户[B]').username).toStrictEqual(['B', 'A']);
		// underline
		expect(parseMailBody('我的用户名是Foo_Bar。').username).toStrictEqual(['Foo Bar']);
		// english
		expect(parseMailBody('The user name I want to use is Example.').username).toStrictEqual(['Example']);
		expect(parseMailBody('The user name is "Example" and the IP address is “12.').username).toStrictEqual(['Example']);
		expect(parseMailBody('username I want to apply for: Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('username: Example,').username).toStrictEqual(['Example']);
		expect(parseMailBody('username：Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('User ID is Example,').username).toStrictEqual(['Example']);
		expect(parseMailBody('My username is [Example]\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('new account:Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('account ？ID：ExampleExample；Code：XXXXXXXXXXXX\n').username).toStrictEqual(['ExampleExample']);
		// false positive
		expect(parseMailBody('我的账号被封锁，').username).toStrictEqual([]);
		// blacklist
		expect(parseMailBody('申请注册账户[请求的账户名称]').username).toStrictEqual([]);
		expect(parseMailBody('我的用戶名是[您的用戶名]').username).toStrictEqual([]);
		expect(parseMailBody('我的用户名是[您的用户名]').username).toStrictEqual([]);
		expect(parseMailBody('我的用户名是[还未注册]').username).toStrictEqual([]);
	});

	test('ipv4', async () => {
		expect(parseMailBody('IP地址是[123.45.6.78]').iporid[0]).toBe('123.45.6.78');
	});

	test('ipv6', async () => {
		expect(parseMailBody('IP 地址是2000:1234::a12b:12aa:fe34:9ab8，').iporid[0]).toBe('2000:1234::a12b:12aa:fe34:9ab8');
		expect(parseMailBody('当前的IP地址是[2000:123::/32]，').iporid[0]).toBe('2000:123::');
		// false positive
		expect(parseMailBody('11:22').iporid).toStrictEqual([]);
	});

	test('block id', async () => {
		expect(parseMailBody('查封ID是#123456').iporid[0]).toBe('#123456');
		expect(parseMailBody('查封ID是 #123456').iporid[0]).toBe('#123456');
		expect(parseMailBody('blocked by ID#123456.').iporid[0]).toBe('#123456');
		// false positive
		expect(parseMailBody('#000000').iporid).toStrictEqual([]);
	});
});
