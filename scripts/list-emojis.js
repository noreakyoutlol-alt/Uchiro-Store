const list = require('./found-emojis.json');
console.log('Total emojis:', list.length);
list.forEach((item, idx) => {
  console.log(`${idx + 1}. [${item.emoji}]  (${item.codePoints})`);
});
