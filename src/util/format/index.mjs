import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { access, constants, stat, appendFile } from 'fs/promises';
import { promptV2 } from './prompt.mjs'
import { formatSentenceV1 } from './captions.mjs'
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_MAX_TOKENS = process.env.DEEPSEEK_MAX_TOKENS ? Number(process.env.DEEPSEEK_MAX_TOKENS) : 8192

const SILICON_API_KEY = process.env.SILICON_API_KEY;
const SILICON_API_URL = process.env.SILICON_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
const SILICON_MODEL = process.env.SILICON_MODEL || 'Pro/deepseek-ai/DeepSeek-V3'
const SILICON_MAX_TOKENS = process.env.SILICON_MAX_TOKENS ? Number(process.env.SILICON_MAX_TOKENS) : 4096

// 日志函数
const createLog = (logFile) => async (message) => {
  console.log(message);
  await appendFile(logFile, message + '\n').catch(err => console.error('写入日志失败:', err));
};

export function convertToSRT(captions) {
  if (!captions) return null;

  return captions.map(caption => (
    `${caption.index}\n${caption.start} --> ${caption.end}\n${caption.text}\n\n`
  )).join('');
}
export const FONT_COLOR = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
}

export function time2Text(ms) {

  ms = ms + 1000
  console.log("🚀 ~ time2Text ~ ms:", ms)
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

export async function isFileExistsAndNotNull(filePath) {
  try {
    const stats = await stat(filePath);
    return stats.size > 0;
  } catch {
    return false;
  }
}


/** 计算最终耗时 */
export function formatTime(startTime, {
  prefix = '耗时\x1b[33m',
  suffix = '\x1b[0m秒',
} = {}) {
  const seconds = ((performance.now() - startTime) / 1000).toFixed(2);
  // 使用 ANSI 转义码添加颜色：\x1b[33m 为黄色，\x1b[0m 为重置颜色
  console.log(`${prefix}${seconds}${suffix}`);
}

export async function contentReview(title, content, { outputDir = '', segmentIndex = '' } = {}) {
  let log = createLog(`${outputDir}/contentReview${segmentIndex ? '-' + segmentIndex : ''}.log`)
  await log('开始校验')
  const startTime = performance.now();
  const interval = setInterval(() => {
    console.log(`${segmentIndex ? segmentIndex + '-' : ''}校验中，已校验: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`)
  }, 10 * 1000);
  try {
    const response = await axios.post(
      SILICON_API_URL,
      // DEEPSEEK_API_URL,
      {
        model: 'Pro/deepseek-ai/DeepSeek-V3', // SILICON_MODEL,
        // model: DEEPSEEK_MODEL,
        temperature: 0.9,
        max_tokens: SILICON_MAX_TOKENS,
        // max_tokens: DEEPSEEK_MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: promptV2(title, content)
          }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${SILICON_API_KEY}`,
          // 'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    await log(`${segmentIndex ? segmentIndex + '-' : ''}总耗时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`);
    clearInterval(interval)
    return response.data.choices[0].message.content;
  } catch (error) {
    await log('校验请求失败:', error.response?.data || error.message);
    await log(`总耗时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`);
    clearInterval(interval)
    throw error;
  }
  clearInterval(interval)
}

export function parseYouTubeTimedText(xmlContent, {
  isFormatTime = true
} = {}) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text"
  });

  try {
    const result = parser.parse(xmlContent);
    if (!result.timedtext?.body?.p) {
      throw new Error('Invalid YouTube TimedText format');
    }

    const paragraphs = Array.isArray(result.timedtext.body.p)
      ? result.timedtext.body.p
      : [result.timedtext.body.p];

    const captions = paragraphs
      .filter(p => {
        return p.s || p["#text"];
      })
      .map((p, index, array) => {
        const startTime = parseInt(p["@_t"]);
        const duration = parseInt(p["@_d"]);
        const pText = p["#text"]

        // 计算结束时间：如果不是最后一个字幕，使用下一个字幕的开始时间
        const endTime = index < array.length - 1
          ? parseInt(array[index + 1]["@_t"])
          : startTime + duration;


        const sentences = Array.isArray(p.s) ? p.s : [p.s];
        const text = pText ? pText : sentences
          .map(s => typeof s === 'string' ? s : s["#text"])
          .join(' ')
          .trim();

        return {
          index: index + 1,
          start: isFormatTime ? time2Text(startTime) : startTime,
          end: isFormatTime ? time2Text(endTime) : endTime,
          text
        };
      })
      .filter(caption => caption.text); // 过滤掉空字幕

    return captions;
  } catch (error) {
    console.error('Failed to parse YouTube TimedText:', error);
    return null;
  }
}

export function formatSentence(captions) {
  return formatSentenceV1(captions)
}