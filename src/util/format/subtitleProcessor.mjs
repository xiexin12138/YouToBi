/**
 * 字幕处理相关函数
 */
import { readFile } from 'fs/promises';

/**
 * 合并时间间隔短的字幕
 * @param {Array} subtitles 原始字幕数组
 * @param {number} threshold 时间阈值（秒），小于此值的间隔将被合并
 * @returns {Array} 合并后的字幕数组
 */
export function mergeCloseSubtitles(subtitles, threshold = 0.5) {
  if (!subtitles || subtitles.length <= 1) return subtitles;
  
  const merged = [];
  let current = { ...subtitles[0] };
  
  for (let i = 1; i < subtitles.length; i++) {
    const next = subtitles[i];
    
    // 如果当前字幕和下一条字幕的时间间隔小于阈值，则合并
    if (next.start - current.end <= threshold) {
      current.end = next.end;
      current.text += ' ' + next.text;
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  
  merged.push(current);
  return merged;
}

/**
 * 检查并调整字幕分段，确保句子完整性
 * @param {Array} subtitles 字幕数组
 * @returns {Array} 调整后的字幕数组
 */
export function ensureSentenceCompleteness(subtitles) {
  if (!subtitles || subtitles.length <= 1) return subtitles;
  
  const adjusted = [];
  let currentSentence = '';
  let currentGroup = [];
  
  const sentenceEndMarks = ['.', '!', '?', '。', '！', '？'];
  
  for (let i = 0; i < subtitles.length; i++) {
    const sub = subtitles[i];
    currentSentence += sub.text;
    currentGroup.push(sub);
    
    // 检查当前累积的文本是否以句号等结尾
    const lastChar = currentSentence.trim().slice(-1);
    if (sentenceEndMarks.includes(lastChar)) {
      // 如果是完整句子，处理当前组
      if (currentGroup.length === 1) {
        adjusted.push(currentGroup[0]);
      } else {
        // 合并多个字幕为一个
        const merged = {
          start: currentGroup[0].start,
          end: currentGroup[currentGroup.length - 1].end,
          text: currentSentence
        };
        adjusted.push(merged);
      }
      
      // 重置
      currentSentence = '';
      currentGroup = [];
    }
  }
  
  // 处理剩余的不完整句子
  if (currentGroup.length > 0) {
    adjusted.push(...currentGroup);
  }
  
  return adjusted;
}

/**
 * 解析SRT文件内容为字幕对象数组
 * @param {string} srtPath SRT文件路径
 * @returns {Array} 字幕对象数组
 */
export async function parseSRT(srtPath) {
  try {
    const content = await readFile(srtPath, 'utf-8');
    const blocks = content.split(/\r?\n\r?\n/).filter(block => block.trim());
    
    return blocks.map(block => {
      const lines = block.split(/\r?\n/);
      const index = parseInt(lines[0]);
      const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      const text = lines.slice(2).join('\n');
      
      if (!timeMatch) {
        console.warn(`无法解析时间戳: ${lines[1]}`);
        return null;
      }
      
      return {
        index,
        start: timeMatch[1],
        end: timeMatch[2],
        text
      };
    }).filter(Boolean);
  } catch (error) {
    console.error(`解析SRT文件失败: ${srtPath}`, error);
    return [];
  }
} 