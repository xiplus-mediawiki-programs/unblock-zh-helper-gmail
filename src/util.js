function stripMailQuote(text) {
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/(\n>.*)*\n*$/, '');
  text = text.replace(/^(.*?)________________________________*(.*)$/s, '$1');
  return text;
}

if (typeof module === 'object') {
  module.exports = {
    stripMailQuote: stripMailQuote,
  };
}
