import axios from 'axios';
import dotenv from 'dotenv';
import { readFile, appendFile, writeFile } from 'fs/promises';
import { convertToSRT } from '../format/index.mjs';

// 加载环境变量
dotenv.config();

const SILICON_API_KEY = process.env.SILICON_API_KEY;
const SILICON_API_URL = process.env.SILICON_API_URL || 'https://api.siliconflow.cn/v1/chat/completions';
const SILICON_MODEL = process.env.SILICON_MODEL || 'Pro/deepseek-ai/DeepSeek-V3'
const SILICON_MAX_TOKENS = process.env.SILICON_MAX_TOKENS ? Number(process.env.SILICON_MAX_TOKENS) : 4096

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const DEEPSEEK_MAX_TOKENS = process.env.DEEPSEEK_MAX_TOKENS ? Number(process.env.DEEPSEEK_MAX_TOKENS) : 8192

export async function translateTextWithContext(prompt, {
  apiUrl,
  model,
  maxToken,
  apiKey
} = {}) {
  try {
    console.log("🚀 ~ apiUrl || SILICON_API_URL:", apiUrl || SILICON_API_URL)
    console.log("🚀 ~ ", {
      model: model || SILICON_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: maxToken || SILICON_MAX_TOKENS
    })
    const response = await axios.post(
      apiUrl || SILICON_API_URL,
      {
        model: model || SILICON_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: maxToken || SILICON_MAX_TOKENS
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey || SILICON_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response?.data?.choices?.[0]?.message?.content;
  } catch (error) {
    console.error('翻译请求失败:', error.response?.data || error.message);
    throw error;
  }
}

export async function translateTextWithContextV2(prompt, {
  apiUrl,
  model,
  maxToken,
  apiKey
} = {}) {
  try {
    const response = await axios.post(
      apiUrl || SILICON_API_URL,
      {
        model: model || SILICON_MODEL,
        messages: [
          {
            role: "system",
            content: `你是一位经验丰富的语义翻译专家，专门从事 SRT 字幕文件的翻译工作。请严格遵循以下规则：
1. 保持原文的语义完整性，不添加、不删减任何信息
2. 如果原文有分隔符'|'，必须保持相同数量的分隔，翻译后的文本段数必须与原文一致
3. 不要添加任何解释性文字或标点符号
4. 对于技术术语：
   - 专注前端开发的词汇
   - 保持英文术语不翻译（如API、HTML等）
   - 遇到新的技术词汇时，参考通用中文译法
5. 分段原则：
   - 仅在语义完整的断句处分段
   - 不在句子中间随意断开
   - 保持每段字幕长度适中，避免过长
6. 严禁添加：
   - 不要添加语气词
   - 不要添加解释性内容
   - 不要添加个人理解
   - 不要添加额外的标点符号`,
          },
          {
            role: "user",
            content: prompt,
          }
        ],
        temperature: 0.9,
        max_tokens: maxToken || SILICON_MAX_TOKENS
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey || SILICON_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response?.data?.choices?.[0]?.message?.content;
  } catch (error) {
    console.error('翻译请求失败:', error.response?.data || error.message);
    throw error;
  }
}

export async function translateCaptionsV1({
  currentSubtitle,
  contextUntranslatedCount,
  contextTranslatedCount,
  contextTranslatedStr,
  contextUntranslatedStr
}) {
  const prompt = `# 角色
你是一个.srt字幕文件翻译助手。你的任务是将以下**当前字幕**内容翻译成自然流畅的中文，表达优美且地道。

# 待翻译的字幕上下文
- 当前需要翻译字幕：${currentSubtitle}
- 前${contextTranslatedCount}句已翻译字幕：${contextTranslatedStr}
- 后${contextUntranslatedCount}句未翻译字幕：${contextUntranslatedStr}

# 要求
- 注意字符限制，尽量精简用字；
- 注意拆分，按语义或逻辑分，因为分句分得好，可以帮助观众理解；
- 完成后，对照原文对比一下译文，测试译文效果；
- 始终以帮助观众理解为目的去完成翻译；
- 直接输出翻译的译文，不要做任何解释和说明；
- 仅翻译当前需要翻译字；

开始翻译：`
  return translateTextWithContext(prompt)
}

export async function translateCaptionsV2({
  currentSubtitle = '',
  preUntranslatedStr = '',
  nextUntranslatedStr = ''
}) {
  const prompt = `你是一个.srt字幕文件翻译助手。你的任务是将以下**当前字幕**内容翻译成自然流畅的中文，表达优美且地道。
**请勿重复翻译上下文。你只需要翻译当前字幕内容。请勿翻译下文！**

请注意，你**不能**使用 Markdown 语法。

字幕内容如下:
- 上一句未翻译字幕：${preUntranslatedStr}
- 当前需要翻译字幕：${currentSubtitle}
- 下句未翻译字幕：${nextUntranslatedStr}

请按照以下步骤操作：
1. **直译**：逐句翻译**当前字幕**内容，确保基本语义准确。
2. **反思错误**：
    - 检查是否存在语言不通顺的地方。
    - 分析语法、语义和文化差异导致的翻译问题。
3. **意译优化**：根据错误反思调整译文，使其更加符合中文表达习惯。
4. **直出结果**：仅直接输出当前字幕的翻译结果，不要加入其他无关内容，不要输出思考过程
翻译时避免机械化，确保语言流畅自然。使用优雅的表达，不加入过多语气词。

开始翻译：`
  return translateTextWithContext(prompt)
}

export async function translateCaptionsV3(content) {
  const prompt = `# 角色
你是一个srt字幕文件翻译助手。你的任务是将以下**当前字幕**内容翻译成自然流畅的中文，表达优美且地道。
  
# 要求
- 请注意，你**不能**使用 Markdown 语法
- 要保留序号和时间轴，不能擅自删除或调整
- 直接输出当前字幕的翻译结果，不要加入其他无关内容，不要尝试说明
- 字幕涉及 IT 领域中的前端开发，请注意甄别专业名词，避免翻译错误
- 不要过度引申或拓展翻译

# 待翻译的字幕
${content}

开始翻译：`
  return translateTextWithContext(prompt
    // , {
    //   apiUrl: DEEPSEEK_API_URL,
    //   model: DEEPSEEK_MODEL,
    //   maxToken: DEEPSEEK_MAX_TOKENS,
    //   apiKey: DEEPSEEK_API_KEY
    // }
  )
}


export async function translateCaptionsV4(content, { log }) {
  const prompt = `Translate this to Simple Chinese: ${content}`
  if (typeof log === 'function') {
    await log(`🚀 ~ translateCaptionsV4 ~ prompt: ${prompt}`)
  } else {

    console.log("🚀 ~ translateCaptionsV4 ~ prompt:", prompt)
  }
  return translateTextWithContextV2(prompt
    // , {
    //   apiUrl: DEEPSEEK_API_URL,
    //   model: DEEPSEEK_MODEL,
    //   maxToken: DEEPSEEK_MAX_TOKENS,
    //   apiKey: DEEPSEEK_API_KEY
    // }
  )
}


export async function translateCaptionsV5(content) {
  const prompt = `# 系统角色
你是一个专业的字幕翻译AI助手，专注于准确、简洁的翻译。

# 翻译规则
1. 内容准确性
   - 严格保持原意，不添加、不删减信息
   - 保持技术术语的准确性，专业词汇保持英文
   - 不要添加任何解释或扩展内容

2. 分段控制
   - 仅在完整的语义单位处分段
   - 避免在句子中间断开
   - 每段长度适中，便于阅读

3. 严格禁止
   - 禁止添加额外的语气词
   - 禁止添加个人理解或解释
   - 禁止改变原文的语气或语调
   - 禁止在非必要处添加标点符号

# 待翻译内容
${content}

# 注意
直接输出翻译结果，不要包含任何其他内容或解释。`

  return translateTextWithContextV2(prompt)
}

export async function translateCaptionsV6(currentContent, { previousContent = '', nextContent = '', windowSize = 3 } = {}) {
  // 构建滑动窗口上下文
  const contextWindow = {
    previous: previousContent.split('\n').slice(-windowSize).join('\n'),
    next: nextContent.split('\n').slice(0, windowSize).join('\n')
  }

  const prompt = `# System Role
You are a professional subtitle translation AI assistant, focusing on accurate and coherent translation. You will receive a subtitle segment with its context to ensure translation consistency.

# Context Information
Previous Context:
${contextWindow.previous}

Content to Translate:
${currentContent}

Next Context:
${contextWindow.next}

# Translation Rules
1. Content Accuracy
   - Maintain original meaning strictly, no additions or omissions
   - Keep technical terms accurate, maintain English for professional vocabulary
   - Reference context to ensure translation coherence and consistency

2. Context Processing
   - Understand the context and tone
   - Ensure consistent translation of technical terms in context
   - Maintain consistency in pronouns and references

3. Segmentation Control
   - Only segment at complete semantic units
   - Consider natural breaks in context
   - Keep segment length moderate for readability

4. Strict Prohibitions
   - No additional modal particles
   - No personal interpretations or explanations
   - No changes to original tone or style
   - No unnecessary punctuation

# Note
- Only translate the "Content to Translate" section
- Context is for understanding only, do not translate it
- Output translation directly, no additional content or explanations`

  return translateTextWithContextV2(prompt)
}

export async function translateTitle(title) {
  const prompt = `# 任务
帮我把视频标题翻译成中文

# 待翻译的标题
${title}

# 要求
- 标题的一般是关于前端开发，所以要注意词汇的背景隐形知识
- 直接输出翻译的结果，不要做任何解释或注释。
- 做到信达雅，符合中文表达习惯`
  return translateTextWithContext(prompt)
}

// 日志函数
const createLog = (logFile) => async (message) => {
  console.log(message);
  await appendFile(logFile, message + '\n').catch(err => console.error('写入日志失败:', err));
};

/** 批量翻译字幕 */
export async function batchTranslateCaptions({ captions, maxBatchSize = 10, outputDir }) {
  let log = createLog(`${outputDir}/translate.log`)

  const newCaptions = JSON.parse(JSON.stringify(captions)).map((caption) => {
    return {
      ...caption,
      origin: caption.text
    }
  })
  const translatedCaptions = [];
  const startTime = performance.now();
  for (let i = 0; i < newCaptions.length; i += maxBatchSize) {
    const batch = newCaptions.slice(i, i + maxBatchSize).map(({ text: currentSubtitle }, index) => {
      const preUntranslatedStr = newCaptions?.[i + index - 1]?.origin || ''
      const preTranslatedStr = newCaptions?.[i + index - 1]?.text || ''
      const nextUntranslatedStr = newCaptions?.[i + index + 1]?.text || ''
      return translateCaptionsV2({
        currentSubtitle,
        preUntranslatedStr,
        nextUntranslatedStr
      })
    });
    let translatedBatch = []
    const sbuStartTime = performance.now();
    try {
      await log(`共计 ${newCaptions.length} 条需要翻译， 开始翻译第 ${i} - ${i + maxBatchSize > newCaptions.length ? newCaptions.length : i + maxBatchSize}条`)
      translatedBatch = await Promise.all(batch);
      translatedCaptions.push(...translatedBatch);
    } catch (error) {
      i -= maxBatchSize
      await log(`翻译失败，共计 ${newCaptions.length} 条需要翻译， 当前已翻译: ${i + 1} 条。 错误信息: ${error.message}`)
      continue;
    }
    const subEnTime = performance.now();
    await log(`此批次耗时： ${((subEnTime - sbuStartTime) / 1000).toFixed(2)}秒\n目前总耗时: ${((subEnTime - startTime) / 1000).toFixed(2)}秒`)
  }
  await log(`总耗时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`)
  return newCaptions.map((caption, index) => {
    return {
      ...caption,
      text: translatedCaptions[index]
    }
  });
}

export async function batchTranslateCaptionsV3({ captions, outputDir, maxTokens }) {
  const log = createLog(`${outputDir}/translate.log`)
  const startTime = performance.now();
  const batchList = []
  const interval = setInterval(() => {
    console.log(`翻译中，已用时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`)
  }, 10 * 1000);

  function run(captions, wordCountLimit, maxTokens = 1500) {
    const list = []
    let flag = 0

    captions.forEach((caption, index) => {
      if (caption?.text?.trim()?.split(' ')?.length === wordCountLimit || index === captions.length - 1) {
        const isOutOfLimit = convertToSRT(captions.slice(flag, index + 1)).length > maxTokens

        if (isOutOfLimit) {
          const subBatchList = run(captions.slice(flag, index + 1), wordCountLimit + 1, maxTokens)
          list.push(...subBatchList)
        } else {
          list.push(captions.slice(flag, index + 1))
        }
        flag = index + 1
      }
    })
    return list
  }

  const captionList = run(captions, 1, maxTokens).map(batch => convertToSRT(batch))
    .filter(item => item.trim())
  const taskList = captionList.map(caption => {
    return translateCaptionsV3(caption)
  })
  await writeFile(`${outputDir}/captionList.json`, JSON.stringify(captionList), 'utf-8')
  await log(`共计 ${captionList.length} 条需要翻译`)

  // const result = captionList
  const result = await Promise.all(taskList)
  clearInterval(interval)
  await log(`总耗时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`)
  return result.join('\n\n')
}

export async function batchTranslateCaptionsV4({ captions, outputDir }) {
  const log = createLog(`${outputDir}/translate.log`)
  const startTime = performance.now();
  const batchList = []
  const interval = setInterval(() => {
    console.log(`翻译中，已用时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`)
  }, 10 * 1000);

  function run(captions, wordCountLimit, maxTokens = 3500) {
    const list = []
    let flag = 0

    captions.forEach((caption, index) => {
      if (caption?.text?.trim()?.split(' ')?.length === wordCountLimit || index === captions.length - 1) {
        const isOutOfLimit = captions.slice(flag, index + 1).map(({ text }) => text).join('|').length > maxTokens

        if (isOutOfLimit) {
          const subBatchList = run(captions.slice(flag, index + 1), wordCountLimit + 1, maxTokens)
          list.push(...subBatchList)
        } else {
          list.push(captions.slice(flag, index + 1))
        }
        flag = index + 1
      }
    })
    return list
  }

  const captionList = run(captions, 1).map(batch => batch.map(({ text }) => text).join('|'))
    .filter(item => item.trim())
  const taskList = captionList.map((caption, index) => {
    return translateCaptionsV4(caption, { log })
  })
  await writeFile(`${outputDir}/captionList.json`, JSON.stringify(captionList), 'utf-8')
  await log(`共计 ${captionList.length} 条需要翻译`)

  // const result = captionList
  const response = await Promise.all(taskList)
  let result = response.map((caption, index) => {
    console.log(`译文 ${index}：`, caption.split('|').filter(item => item.trim()).length)
    return caption.split('|').filter(item => item.trim())
  }).flat().filter(item => item.trim())
  await writeFile(`${outputDir}/response.json`, JSON.stringify(response), 'utf-8')
  await writeFile(`${outputDir}/result.json`, JSON.stringify(result), 'utf-8')


  clearInterval(interval)
  await log(`总耗时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`)

  if (result.length !== captions.length) {
    console.error(`翻译失败，长度不一致, 原始长度: ${captions.length}, 翻译长度: ${result.length}`)
  }

  return convertToSRT(captions.map((caption, index) => {
    return {
      ...caption,
      origin: caption.text,
      text: result[index]
    }
  }));
}

/** 结合上下文逐句精准翻译 */
export async function translateCaptionsWithContext({ captions, outputDir }) {
  let log = createLog(`${outputDir}/translate.log`)
  const startTime = performance.now();
  const newCaptions = JSON.parse(JSON.stringify(captions)).map((caption) => {
    return {
      ...caption,
      origin: caption.text
    }
  })

  for (let i = 0; i < newCaptions.length; i++) {
    const caption = newCaptions[i];
    try {
      caption.text = await translateCaptionsV1({
        currentSubtitle: caption.origin,
        contextTranslatedCount: 3,
        contextUntranslatedCount: 3,
        contextTranslatedStr: (newCaptions[i - 3]?.text || '') + (newCaptions[i - 2]?.text || '') + (newCaptions[i - 1]?.text || ''),
        contextUntranslatedStr: (newCaptions[i + 1]?.origin || '') + (newCaptions[i + 2]?.origin || '') + (newCaptions[i + 3]?.origin || '')
      })
    } catch (error) {
      console.log("🚀 ~ translateCaptionsWithContext ~ error:", error)
      i--
    }
    console.log(`${caption.origin} | ${caption.text}`)
  }

  await log(`总耗时: ${((performance.now() - startTime) / 1000).toFixed(2)}秒`)
  return newCaptions
}