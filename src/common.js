function onHomepage(e) {
  console.log(e);

  var textParagraph = CardService.newTextParagraph()
    .setText('Hello');

  var section = CardService.newCardSection()
    .addWidget(textParagraph);
  var card = CardService.newCardBuilder()
    .addSection(section);

  return card.build();
}
