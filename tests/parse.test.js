import { expect, test, describe } from 'vitest';
import { stripMailQuote } from '../src/util.js';

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
