import { readFile, writeFile } from 'fs/promises';

let text = await readFile('./output/pureCaptionsAfterReview-1741880938202.txt', 'utf-8');
text = text.replace('\n\n', '\n');
const lines = text.split('\n');

lines.forEach((line, index) => {
  function formatText(line, symbol, index) {
    let wordList = line.split(symbol)
    if (wordList.length > 1) {
      const isWord = wordList[0].indexOf(' ') < 0
      if (isWord && index > 0) {
        lines[index - 1] = lines[index - 1] + ' ' + wordList[0] + symbol
        lines[index] = wordList.slice(1).join(symbol).trim()
      }
    }
  }

  formatText(line, '.', index)
  formatText(line, ',', index)
});


console.log(lines.join('\n'))

