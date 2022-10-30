import { expect, test, describe } from 'vitest';
import { parseMailBody, stripEmail, stripMailQuote } from '../src/util.js';

describe('test strip mail quote', async () => {
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

describe('test strip mail quote', async () => {
	test('email', async () => {
		expect(stripEmail('alice@example.org')).toBe('alice@example.org');
		expect(stripEmail('Alice <alice@example.org>')).toBe('alice@example.org');
		expect(stripEmail('"Al ice" <alice@example.org>')).toBe('alice@example.org');
	});

	test('request', async () => {
		expect(parseMailBody('账号创建申请').request.acc).toBeTruthy();
		expect(parseMailBody('申请注册账户').request.acc).toBeTruthy();
	});

	test('username', async () => {
		expect(parseMailBody('我想注册的用户名是"Example"，').username[0]).toBe('Example');
		expect(parseMailBody('申请注册账户[Example]').username[0]).toBe('Example');
		expect(parseMailBody('申请注册账户[A] 申请注册账户[B]').username).toStrictEqual(['B', 'A']);
	});

	test('ip', async () => {
		expect(parseMailBody('IP地址是[123.45.6.78]').iporid[0]).toBe('123.45.6.78');
		expect(parseMailBody('查封ID是#123456').iporid[0]).toBe('#123456');
	});
});
