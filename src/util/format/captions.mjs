export function formatSentenceV1(captions) {
  const symbolList = ['.', ',']
  // 从第二个开始处理
  captions.slice(1).forEach((caption, index) => {
    function formatText(currentCaption, symbol, index) {
      const line = currentCaption.text
      const wordList = line.split(symbol).filter((word) => word.trim())

      const preCaption = captions[index]
      const preCaptionIsWord = preCaption?.text?.split(' ')?.length === 1
      const nextCaption = captions?.[index + 2]
      const nextCaptionIsWord = nextCaption?.text?.split(' ').length === 1

      const firstStr = wordList[0]?.trim()
      const firstIsWord = firstStr?.split(' ').length === 1

      const lastStr = wordList.slice(-1).join('').trim()
      const lastIsWord = lastStr.split(' ').length === 1

      if (wordList.length === 1) {
        // 没有空格说明是一个单词，合并到前一个的字幕中
        if (firstIsWord && !preCaptionIsWord && preCaption.text && nextCaption?.text) {
          if (!/\[([^\[\]]*)\]/.test(firstStr.toLocaleLowerCase())) {
            preCaption.text = `${preCaption.text} ${firstStr}${symbol}`
            currentCaption.text = ''
            preCaption.end = currentCaption.end

            nextCaption.start = currentCaption.end
          }
        }
      } else if (wordList.length === 2) {
        if (firstIsWord && !preCaptionIsWord && preCaption.text) {
          preCaption.text = `${preCaption.text} ${firstStr}${symbol}`
          currentCaption.text = lastStr
        } else if (lastIsWord && !nextCaptionIsWord && nextCaption?.text) {
          nextCaption.text = `${lastStr} ${nextCaption.text}`
          currentCaption.text = firstIsWord
            ? wordList.slice(1, -1).join(symbol).trim()
            : wordList.slice(0, -1).join(symbol).trim()
        }
      } else if (wordList.length > 2) {
        if (firstIsWord && !preCaptionIsWord && preCaption.text) {
          preCaption.text = `${preCaption.text} ${firstStr}${symbol}`
          currentCaption.text = wordList.slice(1).join(symbol).trim()
        }
        if (lastIsWord && !nextCaptionIsWord && nextCaption?.text) {
          nextCaption.text = `${lastStr} ${nextCaption.text}`
          currentCaption.text = firstIsWord
            ? wordList.slice(1, -1).join(symbol).trim()
            : wordList.slice(0, -1).join(symbol).trim()
        }

      }

    }
    symbolList.forEach((symbol) => {
      formatText(caption, symbol, index)
    });
  });
  return captions.filter(caption => {
    return !!caption.text
  })
}

export function formatSentenceV2(captions) {
  // 从第二个开始处理
  captions.slice(1).forEach((caption, index) => {
    function formatText(currentCaption, symbol, index) {
      const line = currentCaption.text
      const wordList = line.split(symbol).filter((word) => word.trim())

      const preCaption = captions[index]
      const preCaptionIsWord = preCaption?.text?.split(' ')?.length === 1

      if (wordList.length === 0) {
        if (preCaption.text) {
          preCaption.end = currentCaption.end
        }
      }

    }
  });
  return captions.filter(caption => {
    return !!caption.text
  })
}