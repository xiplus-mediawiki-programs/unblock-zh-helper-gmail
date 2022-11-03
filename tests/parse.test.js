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
});

describe('stripEmail', async () => {
	test('email', async () => {
		expect(stripEmail('alice@example.org')).toBe('alice@example.org');
		expect(stripEmail('Alice <alice@example.org>')).toBe('alice@example.org');
		expect(stripEmail('"Al ice" <alice@example.org>')).toBe('alice@example.org');
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
		expect(parseMailBody('申请注册账户').request.acc).toBeTruthy();
	});

	test('request ipbe', async () => {
		expect(parseMailBody('申请IP封禁例外').request.ipbe).toBeTruthy();
		expect(parseMailBody('IP封禁豁免申请').request.ipbe).toBeTruthy();
	});

	test('username', async () => {
		expect(parseMailBody('我想注册的用户名是"Example"，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的用户名是[Example]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('希望使用的用户名是：【Example】').username).toStrictEqual(['Example']);
		expect(parseMailBody('用户名：Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是Example，').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是Example。').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是Example\n').username).toStrictEqual(['Example']);
		expect(parseMailBody('我的用户名是：Example。').username).toStrictEqual(['Example']);
		expect(parseMailBody('用户名是[Example]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('申请注册账户[Example]，').username).toStrictEqual(['Example']);
		expect(parseMailBody('申请注册帐户【Example】').username).toStrictEqual(['Example']);
		expect(parseMailBody('申请注册账户[A] 申请注册账户[B]').username).toStrictEqual(['B', 'A']);
	});

	test('ipv4', async () => {
		expect(parseMailBody('IP地址是[123.45.6.78]').iporid[0]).toBe('123.45.6.78');
	});

	test('ipv6', async () => {
		expect(parseMailBody('IP 地址是2000:1234::a12b:12aa:fe34:9ab8，').iporid[0]).toBe('2000:1234::a12b:12aa:fe34:9ab8');
		expect(parseMailBody('11:22').iporid).toStrictEqual([]);
	});

	test('block id', async () => {
		expect(parseMailBody('查封ID是#123456').iporid[0]).toBe('#123456');
		expect(parseMailBody('blocked by ID#123456.').iporid[0]).toBe('#123456');
	});
});
