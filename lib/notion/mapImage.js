import BLOG from '@/blog.config'
import { siteConfig } from '../config'

/**
 * 图片映射
 *
 * @param {*} img 图片地址，可能是相对路径，可能是外链
 * @param {*} block 数据块，可能是单个内容块，可能是Page
 * @param {*} type block 单个内容块 ； collection 集合列表
 * @param {*} from 来自
 * @returns
 */

const isAvif = img => {
  try {
    const urlObj = new URL(img) // 解析为 URL 对象
    const path = urlObj.pathname // 获取路径部分

    // 匹配所有扩展名，并将其捕获为数组
    const matches = path.match(/\.[a-zA-Z0-9]+/g)

    if (!matches) return false // 如果没有匹配到任何扩展名，返回 false

    // 遍历所有扩展名，找到 avif 时直接返回 true
    for (const ext of matches) {
      if (ext.toLowerCase() === '.avif') {
        return true
      }
    }

    return false // 没有找到 avif 扩展名时返回 false
  } catch (error) {
    console.error('URL 解析错误:', error)
    return false
  }
}

const mapImgUrl = (img, block, type = 'block', needCompress = true) => {
  if (!img) {
    return null
  }

  let ret = null
  // 相对目录，则视为notion的自带图片
  if (img.startsWith('/')) {
    ret = BLOG.NOTION_HOST + img
  } else {
    ret = img
  }

  if (isAvif(img)) {
    ret =
      'https://file.notion.so/f/f/' +
      ret.substring(ret.search('.amazonaws.com/') + 15) +
      '?table=' +
      type +
      '&id=' +
      block.id
  } else {
    // Notion 图床转换为永久地址
    const hasConverted =
      ret.indexOf('https://www.notion.so/image') === 0 ||
      ret.includes('notion.site/images/page-cover/')
    // 需要转化的URL ; 识别aws图床地址，或者bookmark类型的外链图片
    const needConvert =
      !hasConverted &&
      (block.type === 'bookmark' ||
        ret.includes('secure.notion-static.com') ||
        ret.includes('prod-files-secure'))

    // 使用Notion图传
    if (needConvert) {
      ret =
        BLOG.NOTION_HOST +
        '/image/' +
        encodeURIComponent(ret) +
        '?table=' +
        type +
        '&id=' +
        block.id
    }
  }

  if (!isEmoji(ret) && ret.indexOf('notion.so/images/page-cover') < 0) {
    if (BLOG.RANDOM_IMAGE_URL) {
      // 只有配置了随机图片接口，才会替换图片
      const texts = BLOG.RANDOM_IMAGE_REPLACE_TEXT
      let isReplace = false
      if (texts) {
        const textArr = texts.split(',')
        // 判断是否包含替换的文本
        textArr.forEach(text => {
          if (ret.indexOf(text) > -1) {
            isReplace = true
          }
        })
      } else {
        isReplace = true
      }
      if (isReplace) {
        ret = BLOG.RANDOM_IMAGE_URL19
      }
    }

    // 图片url优化，确保每一篇文章的图片url唯一
    if (isAvif(img)) {
      ret =
        ret +
        '&spaceId=' +
        ret.substr(ret.search('file.notion.so/f/f/') + 19, 36) +
        '&expirationTimestamp=1730109600000&signature=T8Kh6sMvbytq6usbjruWdVS5siv-EmRAg0Hr_KzaNQg'
    } else {
      if (
        ret &&
        ret.length > 4 &&
        !ret.includes('https://www.notion.so/images/')
      ) {
        // 图片接口拼接唯一识别参数，防止请求的图片被缓，而导致随机结果相同
        const separator = ret.includes('?') ? '&' : '?'
        ret = `${ret.trim()}${separator}t=${block.id}`
      }
    }
  }

  // 统一压缩图片
  if (needCompress) {
    const width = block?.format?.block_width
    ret = compressImage(ret, width)
  }

  return ret
}

/**
 * 是否是emoji图标
 * @param {*} str
 * @returns
 */
function isEmoji(str) {
  const emojiRegex =
    /[\u{1F300}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}\u{2B06}\u{2B07}\u{2B05}\u{27A1}\u{2194}-\u{2199}\u{2194}\u{21A9}\u{21AA}\u{2934}\u{2935}\u{25AA}\u{25AB}\u{25FE}\u{25FD}\u{25FB}\u{25FC}\u{25B6}\u{25C0}\u{1F200}-\u{1F251}]/u
  return emojiRegex.test(str)
}

/**
 * 压缩图片
 * 1. Notion图床可以通过指定url-query参数来压缩裁剪图片 例如 ?xx=xx&width=400
 * 2. UnPlash 图片可以通过api q=50 控制压缩质量 width=400 控制图片尺寸
 * @param {*} image
 */
const compressImage = (image, width, quality = 50, fmt = 'avif') => {
  if (isAvif(image)) {
    return image
  }

  if (!image || image.indexOf('http') !== 0) {
    return image
  }

  if (image.includes('.svg')) return image

  if (!width || width === 0) {
    width = siteConfig('IMAGE_COMPRESS_WIDTH')
  }

  // 将URL解析为一个对象
  const urlObj = new URL(image)
  // 获取URL参数
  const params = new URLSearchParams(urlObj.search)

  // Notion图床
  if (
    image.indexOf(BLOG.NOTION_HOST) === 0 &&
    image.indexOf('amazonaws.com') > 0
  ) {
    params.set('width', width)
    params.set('cache', 'v2')
    // 生成新的URL
    urlObj.search = params.toString()
    return urlObj.toString()
  } else if (image.indexOf('https://images.unsplash.com/') === 0) {
    // 压缩unsplash图片
    // 将q参数的值替换
    params.set('q', quality)
    // 尺寸
    params.set('width', width)
    // 格式
    params.set('fmt', fmt)
    params.set('fm', fmt)
    // 生成新的URL
    urlObj.search = params.toString()
    return urlObj.toString()
  } else if (image.indexOf('https://your_picture_bed') === 0) {
    // 此处还可以添加您的自定义图传的封面图压缩参数。
    // .e.g
    return 'do_somethin_here'
  }

  return image
}

export { compressImage, mapImgUrl }
