/**
 * 翻译后处理相关函数
 */

/**
 * 翻译后处理，确保字幕格式正确
 * @param {Array} translatedSubtitles 翻译后的字幕
 * @returns {Array} 处理后的字幕
 */
export function postProcessTranslation(translatedSubtitles) {
  return translatedSubtitles.map(sub => {
    let text = sub.text;
    
    // 移除多余的空格
    text = text.replace(/\s+/g, ' ').trim();
    
    // 移除可能的序号前缀
    text = text.replace(/^\[\d+\s*\|\s*/, '').replace(/^\d+\s*\|\s*/, '');
    
    // 确保中文标点符号正确
    text = text.replace(/\./g, '。')
               .replace(/\!/g, '！')
               .replace(/\?/g, '？')
               .replace(/,/g, '，')
               .replace(/;/g, '；')
               .replace(/:/g, '：');
    
    // 限制每行字幕长度，避免过长
    if (text.length > 42) {
      const chars = text.split('');
      let line = '';
      let result = '';
      
      for (let i = 0; i < chars.length; i++) {
        line += chars[i];
        if (line.length >= 20 && (chars[i] === '，' || chars[i] === '。' || chars[i] === '；' || chars[i] === '：' || chars[i] === '！' || chars[i] === '？')) {
          result += line + '\n';
          line = '';
        }
      }
      
      if (line) {
        result += line;
      }
      
      text = result.trim();
    }
    
    return { ...sub, text };
  });
}

/**
 * 同步中英文字幕的时间戳
 * @param {Array} enSubtitles 英文字幕数组
 * @param {Array} zhSubtitles 中文字幕数组
 * @returns {Array} 时间戳同步后的中文字幕数组
 */
export function synchronizeSubtitleTimestamps(enSubtitles, zhSubtitles) {
  // 确保两个数组长度相同
  if (enSubtitles.length !== zhSubtitles.length) {
    console.warn(`英文字幕(${enSubtitles.length}条)与中文字幕(${zhSubtitles.length}条)数量不匹配，将进行调整`);
    
    // 如果长度不同，以英文字幕为准
    if (enSubtitles.length > zhSubtitles.length) {
      // 英文字幕多于中文字幕，补充中文字幕
      for (let i = zhSubtitles.length; i < enSubtitles.length; i++) {
        zhSubtitles.push({
          ...enSubtitles[i],
          text: "[未翻译]"
        });
      }
    } else {
      // 中文字幕多于英文字幕，截断中文字幕
      zhSubtitles = zhSubtitles.slice(0, enSubtitles.length);
    }
  }
  
  // 同步时间戳
  return zhSubtitles.map((zhSub, index) => {
    return {
      ...zhSub,
      start: enSubtitles[index].start,
      end: enSubtitles[index].end
    };
  });
} 