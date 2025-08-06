/**
 * 使用滑动窗口方法批量翻译字幕
 * @param {Object} options 配置选项
 * @param {Array} options.captions 字幕数组
 * @param {string} options.outputDir 输出目录
 * @param {number} options.windowSize 窗口大小，默认为5
 * @param {number} options.overlap 重叠部分，默认为2
 * @param {number} options.maxTokens 每批次最大token数，默认为1000
 * @returns {string} 翻译后的SRT格式字幕内容
 */
import { writeFile } from 'fs/promises';
import { convertToSRT } from '../format/index.mjs';
import { batchTranslateCaptionsV3 } from './index.mjs';

export async function batchTranslateCaptionsWithSlidingWindow({ 
  captions, 
  outputDir, 
  windowSize = 5, 
  overlap = 2,
  maxTokens = 1000 
}) {
  console.log(`开始使用滑动窗口方法翻译字幕，共${captions.length}条`);
  
  // 如果字幕条数少于窗口大小，直接整体翻译
  if (captions.length <= windowSize) {
    return batchTranslateCaptionsV3({ captions, outputDir, maxTokens });
  }
  
  const translatedCaptions = new Array(captions.length);
  const translationLog = [];
  
  // 使用滑动窗口处理较长的字幕
  for (let i = 0; i < captions.length; i += (windowSize - overlap)) {
    const endIdx = Math.min(i + windowSize, captions.length);
    const windowCaptions = captions.slice(i, endIdx);
    
    console.log(`处理窗口 ${i} 到 ${endIdx-1}，共${windowCaptions.length}条字幕`);
    
    // 构建上下文，包含时间戳以帮助模型理解分段
    const contextWithTimestamps = windowCaptions.map(cap => 
      `[${cap.start} --> ${cap.end}] ${cap.text}`
    ).join('\n');
    
    // 记录原始文本用于日志
    const originalTexts = windowCaptions.map(cap => cap.text);
    
    // 添加翻译指令，强调保持时间戳一致性
    const prompt = `请将以下英文字幕翻译成中文。要求：
1. 保持原文的语义和风格
2. 不要添加原文中不存在的内容
3. 保持句子的自然分段，不要在不合适的地方断句
4. 保持专业术语的准确性
5. 确保上下文的连贯性和一致性
6. 严格保持原始时间戳不变，不要修改时间戳

字幕内容：
${contextWithTimestamps}

翻译结果：`;

    // 调用翻译API
    const translatedText = await translateWithAPI(prompt);
    
    // 解析翻译结果，提取时间戳和文本
    const timestampRegex = /\[([\d:,]+) --> ([\d:,]+)\] (.*)/g;
    const translatedSegments = [];
    let match;
    
    while ((match = timestampRegex.exec(translatedText)) !== null) {
      translatedSegments.push({
        start: match[1],
        end: match[2],
        text: match[3].trim()
      });
    }
    
    // 如果解析失败，尝试按行分割
    let processedSegments = translatedSegments;
    if (translatedSegments.length !== windowCaptions.length) {
      console.warn(`时间戳解析失败，尝试按行分割。预期${windowCaptions.length}条，实际解析${translatedSegments.length}条`);
      
      const lines = translatedText.split('\n').filter(line => line.trim());
      processedSegments = lines.map((line, idx) => {
        if (idx < windowCaptions.length) {
          return {
            start: windowCaptions[idx].start,
            end: windowCaptions[idx].end,
            text: line.replace(/^\[\d+\s*\|\s*/, '').trim() // 移除可能的序号
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    // 只保存非重叠部分的翻译结果（除了最后一个窗口）
    const saveCount = (i + windowSize >= captions.length) 
      ? (endIdx - i) 
      : (windowSize - overlap);
    
    for (let j = 0; j < saveCount; j++) {
      if (i + j < captions.length && j < processedSegments.length) {
        const originalIndex = i + j;
        translatedCaptions[originalIndex] = {
          ...captions[originalIndex],
          text: processedSegments[j].text
        };
        
        // 记录翻译日志
        translationLog.push({
          index: originalIndex,
          original: originalTexts[j],
          translated: processedSegments[j].text
        });
      }
    }
    
    // 每处理完一个窗口，保存一次中间结果
    await writeFile(
      `${outputDir}/translation_progress.json`, 
      JSON.stringify(translatedCaptions.filter(Boolean)), 
      'utf-8'
    );
    
    await writeFile(
      `${outputDir}/translation_log.json`, 
      JSON.stringify(translationLog), 
      'utf-8'
    );
    
    // 添加延迟，避免API限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 后处理：确保所有字幕都已翻译，并进行格式调整
  const finalCaptions = translatedCaptions.map((cap, idx) => {
    if (!cap) {
      console.warn(`警告：索引 ${idx} 的字幕未被翻译，使用占位符`);
      return {
        ...captions[idx],
        text: "[翻译缺失]"
      };
    }
    return cap;
  });
  
  // 进行后处理，确保字幕格式正确
  const processedCaptions = postProcessTranslation(finalCaptions);
  
  // 转换为SRT格式
  return convertToSRT(processedCaptions);
}

// 从您现有的API调用代码中提取
async function translateWithAPI(text) {
  // 这里应该调用您现有的翻译API
  // 可以从您的代码中导入相关函数
  
  // 临时实现，应替换为实际API调用
  const { translateWithContext } = await import('./index.mjs');
  return translateWithContext(text);
} 