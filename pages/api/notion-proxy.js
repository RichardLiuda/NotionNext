export default async function handler(req, res) {
  // 获取用户请求中的路径参数
  const { path } = req.query

  // 构建 Notion 图片的完整 URL
  const notionURL = `https://file.notion.so/${path}`

  try {
    // 向 Notion 服务器发起请求
    const notionResponse = await fetch(notionURL)

    // 获取 Notion 响应的所有头部信息
    const headers = new Headers(notionResponse.headers)
    headers.set('Access-Control-Allow-Origin', '*') // 设置 CORS 头

    // 将响应头转发给客户端
    res.writeHead(notionResponse.status, headers.raw())

    // 将响应体直接传递给客户端
    notionResponse.body.pipe(res)
  } catch (error) {
    // 捕获错误并返回 500 状态码
    res.status(500).json({ error: 'Failed to proxy request.' })
  }
}
