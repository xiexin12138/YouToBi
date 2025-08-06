import { request } from 'undici';
import { exec, spawn } from 'child_process'
import { access, constants, mkdir, rm, stat, readFile, writeFile, rename, appendFile } from 'fs/promises';
import { translateTitle, batchTranslateCaptions, batchTranslateCaptionsV3, translateCaptionsWithContext } from './util/translate/index.mjs';
import { contentReview, time2Text, formatTime, FONT_COLOR, parseYouTubeTimedText, isFileExistsAndNotNull, formatSentence, convertToSRT } from './util/format/index.mjs'
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// 加载环境变量
dotenv.config();

async function getVideoInfo() {
  const url = process.env.URL
  if (!url) {
    throw new Error('请在 .env 中设置 Youtube 的视频URL')
  }

  let server = 'http://127.0.0.1:9000/';
  const bodyData = { url }; // 要发送的数据

  const { statusCode, body } = await request(server, {
    method: 'POST', // 设置请求方法为 POST
    headers: {
      'content-type': 'application/json', // 设置请求头
      'accept': 'application/json',
    },
    body: JSON.stringify(bodyData), // 将数据序列化为 JSON 字符串
  });

  const outputDir = this.outputPath
  const isInfoFileExist = await isFileExistsAndNotNull(`${outputDir}/videoInfo.txt`)
  if (isInfoFileExist) {
    return console.log('已获取过视频信息，无需重复获取')
  }

  // 处理响应
  console.log('Status Code:', statusCode);
  if (statusCode === 200) {
    const responseData = await body.json(); // 解析响应体为 JSON
    console.log('Response Data:', responseData);
    const {
      title,
      coverUrl,
      captions,
      filename
    } = responseData

    await writeFile(`${outputDir}/videoInfo.txt`, `原标题: ${title}\n 封面地址: ${coverUrl}\n字幕地址: ${captions[0].url}\n`)

    const coverImageFormat = coverUrl.split('.').pop()
    spawn('wget', [coverUrl, '-O', `${filename}.${coverImageFormat}`]);
    const downloadCaptions = spawn('wget', [captions[0].url, '-O', `${filename}.xml`]);
    downloadCaptions.on('close', (code) => {
      console.log(`子进程退出，退出码 ${code}`);
    });
  } else {
    console.error('请求失败');
  }
}

class YoutubeTranslator {
  static async create(url, {
    outDir = './output',
    forceRedownload = false
  } = {}) {
    const instance = new YoutubeTranslator({ url, outDir, forceRedownload });
    try {
      console.log('开始获取视频信息')
      const startTime = performance.now();
      await instance.getVideoInfo();
      formatTime(startTime, { prefix: '获取视频信息耗时：' + FONT_COLOR.green })
      return instance;
    } catch (error) {
      console.error('创建 YoutubeTranslator 实例失败:', error);
      return null; // 或者返回一个空对象实现
    }
  }
  constructor({ url, outDir, forceRedownload }) {
    // Youtube 视频的URL
    this.url = url
    // 视频标题
    this.title = ''
    // 视频封面图片URL
    this.coverUrl = ''
    // 字幕URL
    this.captions = ''
    // 视频文件名
    this.filename = ''
    // 之前是否下载过，如果有，会使用之前的缓存
    this.usedToDownload = false
    this.translatedTitle = ''

    /** 以下为用户配置的参数 */
    // 输出目录路径，确保没有末尾的斜杠
    this.outDir = outDir.endsWith('/') ? outDir.slice(0, -1) : outDir
    // 处理波浪号路径
    if (this.outDir.startsWith('~')) {
      this.outDir = this.outDir.replace('~', process.env.HOME)
    } else if (!path.isAbsolute(this.outDir)) {
      // 如果是相对路径，则基于当前工作目录解析
      this.outDir = path.resolve(process.cwd(), this.outDir)
    }
    // 是否强制重新下载，即使文件已存在
    this.forceRedownload = forceRedownload
  }

  async getVideoInfo() {
    if (!this.url) {
      throw new Error('请在 .env 中设置 Youtube 的视频URL')
    }


    let server = 'http://127.0.0.1:9000/';
    const bodyData = { url: this.url }; // 要发送的数据


    const { statusCode, body } = await request(server, {
      method: 'POST', // 设置请求方法为 POST
      headers: {
        'content-type': 'application/json', // 设置请求头
        'accept': 'application/json',
      },
      body: JSON.stringify(bodyData), // 将数据序列化为 JSON 字符串
    });


    // 处理响应
    if (statusCode === 200) {
      const responseData = await body.json(); // 解析响应体为 JSON
      console.log("🚀 ~ YoutubeTranslator ~ getVideoInfo ~ responseData:", JSON.stringify(responseData))
      const {
        title,
        coverUrl,
        captions,
        filename
      } = responseData;


      // 获取当前文件的目录路径
      this.title = title
      this.coverUrl = coverUrl
      this.captions = captions?.find((item) => item.language === 'en')?.[0]?.url || captions?.[0]?.url
      this.filename = filename
      this.outputPath = `${this.outDir}/${title.replace(/[\/\?<>\\:\*\|"]/g, '').replace(/\s+/g, '_')}`  // 添加完整输出路径


      const outputDir = this.outputPath
      const isInfoFileExist = await isFileExistsAndNotNull(`${outputDir}/videoInfo.txt`)
      if (!isInfoFileExist) {
        await mkdir(outputDir, { recursive: true });
      }
      await writeFile(`${outputDir}/videoInfo.txt`, `《${title}》\n原视频地址: ${this.url}\n\n英文字幕使用大模型校对，中文字幕使用大模型翻译\n如果有感兴趣的前端方向的内容，欢迎告诉我，我来搬运`)

      // if (isInfoFileExist) {
      //   return console.log('已获取过视频信息，无需重复获取')
      // }
      // this.outputPath = path.join(__dirname, `${this.outDir}/${title.replace(/ /g, '_')}`)  // 添加完整输出路径

      Object.keys(this).forEach((key) => {
        if (this[key] === undefined) {
          throw new Error(`获取视频信息失败，${key} 为空`);
        }
      });
    } else {
      throw new Error('请求失败', {
        cause: {
          statusCode,
          body
        }
      });
      console.error('请求失败');
    }
  }


  async initDirectory() {
    try {
      await access(this.outputPath, constants.F_OK);
      this.usedToDownload = true
      let log = '目录已存在'
      if (this.forceRedownload) {
        await rm(this.outputPath, { recursive: true, force: true });
        log += '，已删除旧目录，即将强制重新下载'
      } else {
        log += '，使用之前的缓存'
      }
      console.log(this.outputPath + log);
    } catch (error) {
      this.usedToDownload = false
      console.log('目录不存在，创建目录' + this.outputPath);
      await mkdir(this.outputPath, { recursive: true });
    }
  }

  async translateTitle() {
    const outputDir = this.outputPath
    const isInfoFileExist = await isFileExistsAndNotNull(`${outputDir}/videoInfo.txt`)
    const startTime = performance.now();
    console.log('开始翻译标题')
    this.translatedTitle = await translateTitle(this.title)
    await appendFile(`${outputDir}/videoInfo.txt`, `\n\n中文标题：${this.translatedTitle}` + '\n').catch(err => console.error('写入日志失败:', err));

    /**
     * 《Every React Concept Explained in 12 Minutes》 原视频地址: https://www.youtube.com/watch?app=desktop&v=wIyHSOugGGw  英文字幕使用大模型校对，中文字幕使用大模型翻译 如果有感兴趣的前端方向的内容，欢迎告诉我，我来搬运
     */
    console.log("标题翻译完成:" + this.translatedTitle)
    formatTime(startTime, { prefix: '标题翻译耗时：' + FONT_COLOR.green })
  }

  async downloadVideo() {
    console.log(FONT_COLOR.red + '视频下载功能暂未实现' + FONT_COLOR.reset);
  }

  async downloadCover() {
    const startTime = performance.now();
    const coverName = `${this.title}.${this.coverUrl.split('.').pop()}`
      .replace(/[\/\?<>\\:\*\|"]/g, '')  // 移除文件系统不允许的字符
      .replace(/\s+/g, '_');  // 空格替换为下划线
    const filePath = `${this.outputPath}/${coverName}`
    const args = [
      this.coverUrl,
      '-O',  // wget 使用大写的 O
      filePath,
      '--tries=3',  // 设置重试次数
      '--timeout=15',  // 设置超时时间
      '--show-progress'  // 显示进度条
    ]
    const isExist = await isFileExistsAndNotNull(filePath)
    if (isExist) {
      console.log('视频封面已存在，无需重复下载');
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const child = spawn('wget', args)
      child.on('error', (err) => {
        console.error('无法启动下载进程:', err);
        reject(err)
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`封面图片文件已保存为："${filePath}"`);
          resolve();
        } else {
          reject(new Error(`封面下载失败，退出码: ${code}`))
        }
        formatTime(startTime)
      });
    })
  }

  async downloadCaptions() {
    const startTime = performance.now();
    const title = this.title
      .replace(/[\/\?<>\\:\*\|"]/g, '')
      .replace(/\s+/g, '_')
    const filePath = `${this.outputPath}/${title}.xml`
    const isExist = await isFileExistsAndNotNull(filePath)
    if (isExist) {
      console.log("字幕文件已存在，无需重复下载");
      return Promise.resolve()
    }
    const args = [
      this.captions,
      '-O',  // wget 使用大写的 O
      filePath,
      '--tries=3',
      '--timeout=15',
      '--show-progress'
    ]

    return new Promise((resolve, reject) => {
      const child = spawn('wget', args)
      child.on('error', (err) => {
        console.error('无法启动下载进程:', err);
        reject(err)
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`字幕文件已保存为："${filePath}"`);
          resolve();
        } else {
          reject(new Error(`字幕下载失败，退出码: ${code}`))
        }
        formatTime(startTime)
      });
    })
  }

  async translateCaptions() {
    const outputDir = this.outputPath

    try {
      // YTT 原文件
      const title = this.title
        .replace(/[\/\?<>\\:\*\|"]/g, '')
        .replace(/\s+/g, '_')
      const filePath = `${this.outputPath}/${title}.xml`

      /** 把 YTT 文件转为对象数组，对象包含index、开始时间、结束时间、文本内容 */
      const captionsPath = `${this.outputPath}/captions.json`
      const isCaptionsExist = await isFileExistsAndNotNull(captionsPath)
      let captions
      if (!isCaptionsExist) {
        const xmlContent = await readFile(filePath, 'utf-8');
        captions = parseYouTubeTimedText(xmlContent, { isFormatTime: false });
        await writeFile(captionsPath, JSON.stringify(captions), 'utf-8')
      } else {
        captions = await readFile(captionsPath, 'utf-8')
        captions = JSON.parse(captions)
      }

      // 分割成`数字+ | + 原文`的格式，防止大模型整理格式或翻译后错行
      const orderCaptions = captions.map((caption, index) => {
        caption.text = `${index + 1} | ${caption.text}`
        return caption
      })
      await writeFile(`${this.outputPath}/orderCaptions.txt`, orderCaptions.map(({ text }) => text).join('\n'), 'utf-8')

      // 对文本内容进行校验，然后持久化留档
      let pureCaptionsAfterReview
      const pureCaptionsAfterReviewPath = `${this.outputPath}/pureCaptionsAfterReview.txt`
      const isPureCaptionsAfterReviewExist = await isFileExistsAndNotNull(pureCaptionsAfterReviewPath)

      if (!isPureCaptionsAfterReviewExist) {
        const batch = []
        let flag = 0, textLength = 0
        const maxTokens = 3500
        orderCaptions.forEach((caption, index) => {
          if (textLength + caption.text.length > maxTokens) {
            batch.push(captions.slice(flag, index + 1).map(caption => caption.text).join('\n'))
            flag = index + 1
            textLength = 0
          } else if (index + 1 === orderCaptions.length) {
            batch.push(captions.slice(flag, index + 1).map(caption => caption.text).join('\n'))
          } else {
            textLength += caption.text.length
          }
        })

        await writeFile(`${this.outputPath}/batch.json`, JSON.stringify(batch), 'utf-8')

        pureCaptionsAfterReview = await Promise.all(
          batch.map((text, index) => {
            return contentReview(this.title, text, { outputDir, segmentIndex: index })
          })
        )
        pureCaptionsAfterReview = pureCaptionsAfterReview.join('\n')
        // pureCaptionsAfterReview = await contentReview(this.title, orderCaptions, { outputDir })
        await writeFile(pureCaptionsAfterReviewPath, pureCaptionsAfterReview, 'utf-8')
      } else {
        pureCaptionsAfterReview = await readFile(pureCaptionsAfterReviewPath, 'utf-8')
      }
      let captionsAfterReview = pureCaptionsAfterReview.split('\n').map((text = "", index) => {
        return {
          ...captions[index],
          text: text?.split('|')[1]?.trim() || ''
        }
      })

      // 翻译前对内容进行预处理
      captionsAfterReview = formatSentence(captionsAfterReview)

      captionsAfterReview = [{ index: 0, start: 0, end: captionsAfterReview[0].start > 5 * 1000 ? 5000 : captionsAfterReview[0].start, text: '字幕使用大模型翻译，翻译效果持续优化中……' }, ...captionsAfterReview].map((item, index) => ({
        ...item,
        start: time2Text(item.start),
        end: time2Text(item.end),
        index: index + 1
      }))

      const captionsAfterReviewPath = `${this.outputPath}/captionsAfterReview.json`
      await writeFile(captionsAfterReviewPath, JSON.stringify(captionsAfterReview), 'utf-8')

      console.log("开始翻译")
      // const translateCaptions = await batchTranslateCaptions({ captions: captionsAfterReview, maxBatchSize: 10, outputDir })
      const srtContentZH = await batchTranslateCaptionsV3({ captions: captionsAfterReview, outputDir, maxTokens: 500 })
      // const translateCaptions = await translateCaptionsWithContext({ captions: captionsAfterReview, outputDir })

      // const srtContentZH = convertToSRT(translateCaptions);
      const srtContentEN = convertToSRT(captionsAfterReview);

      // 写入 SRT 文件
      await writeFile(`${outputDir}/${title}-ZH.srt`, srtContentZH, 'utf-8');
      await writeFile(`${outputDir}/${title}-EN.srt`, srtContentEN, 'utf-8');

      // // 修改当前父文件夹名称
      // const newDirName = `${outputDir}[Done]`;
      // try {
      //   // 如果目标文件夹存在，先删除
      //   await rm(newDirName, { recursive: true, force: true });
      //   await rename(outputDir, newDirName);
      // } catch (renameError) {
      //   console.error('重命名文件夹失败:', renameError);
      //   // 重命名失败不影响整体流程，继续执行
      // }
    } catch (error) {
      console.log("🚀 ~ YoutubeTranslator ~ translateCaptions ~ error:", error)
    }
  }
}

/**
 * 合并时间间隔短的字幕
 * @param {Array} subtitles 原始字幕数组
 * @param {number} threshold 时间阈值（秒），小于此值的间隔将被合并
 * @returns {Array} 合并后的字幕数组
 */
function mergeCloseSubtitles(subtitles, threshold = 0.5) {
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
function ensureSentenceCompleteness(subtitles) {
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

async function main() {
  const startTime = performance.now();
  try {
    const url = process.argv[2]
    if (!url) {
      throw new Error('请在命令行中输入 Youtube 的视频URL, 如 node main.mjs https://xxxxx')
    }
    const instance = await YoutubeTranslator.create(url, { outDir: '~/哔哩哔哩' })
    if (!instance) {
      throw new Error('创建 YoutubeTranslator 实例失败');
    }
    console.log(FONT_COLOR.cyan + '=========初始化目录=========' + FONT_COLOR.reset);
    // 初始化目录
    await instance.initDirectory()
    console.log(FONT_COLOR.cyan + '=========初始化目录结束=========' + FONT_COLOR.reset);

    // 并发翻译标题、下载视频、封面，异步进行即可
    Promise.all([
      instance.translateTitle(),
      instance.downloadVideo(),
      instance.downloadCover(),
    ]);

    // 下载字幕
    console.log(FONT_COLOR.cyan + '=========下载字幕=========' + FONT_COLOR.reset);
    await instance.downloadCaptions()
    console.log(FONT_COLOR.cyan + '=========下载字幕结束=========' + FONT_COLOR.reset);

    // 翻译字幕
    console.log(FONT_COLOR.cyan + '=========翻译字幕=========' + FONT_COLOR.reset);
    await instance.translateCaptions()
    console.log(FONT_COLOR.cyan + '=========翻译字幕结束=========' + FONT_COLOR.reset);
  } catch (error) {
    console.error("🚀 ~ main ~ error:", error)
  }
  formatTime(startTime, { prefix: '总耗时：' + FONT_COLOR.green })
}

main()