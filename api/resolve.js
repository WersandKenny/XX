// Vercel Serverless Function - 抖音视频解析
// 部署: 将整个 douyin-api 文件夹上传到 Vercel

export default async function handler(req, res) {
  // 允许跨域（小程序wx.request需要）
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const url = req.query.url
  if (!url) {
    return res.status(400).json({ error: '缺少url参数' })
  }

  // 提取video ID
  let videoId = null
  const idMatch = url.match(/video\/(\d+)/)
  if (idMatch) {
    videoId = idMatch[1]
  } else {
    // 跟随重定向获取ID
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' }
      })
      const finalUrl = resp.url
      const finalMatch = finalUrl.match(/video\/(\d+)/)
      if (finalMatch) videoId = finalMatch[1]
      if (!videoId) {
        const html = await resp.text()
        const htmlMatch = html.match(/video\/(\d+)/)
        if (htmlMatch) videoId = htmlMatch[1]
      }
    } catch (e) {
      return res.status(500).json({ error: '链接请求失败', detail: e.message })
    }
  }

  if (!videoId) {
    return res.status(400).json({ error: '无法解析视频ID' })
  }

  // 请求抖音官方API - Vercel的IP段和Cloudflare不同，成功率更高
  try {
    const apiResp = await fetch(
      `https://www.douyin.com/aweme/v1/web/aweme/detail/?aweme_id=${videoId}&aid=1128`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S9080) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.douyin.com/',
          'Cookie': 'ttwid=1%7C' + Date.now().toString(16) + ';'
        }
      }
    )

    const data = await apiResp.json()

    let videoUrl = null
    if (data.aweme_detail?.video?.play_addr?.url_list?.[0]) {
      videoUrl = data.aweme_detail.video.play_addr.url_list[0]
    } else if (data.aweme_detail?.video?.play_addr_lowbr?.url_list?.[0]) {
      videoUrl = data.aweme_detail.video.play_addr_lowbr.url_list[0]
    }

    if (!videoUrl) {
      // 容错：尝试从其他路径提取
      if (data.aweme_detail?.video?.play_addr?.url_list?.length > 0) {
        videoUrl = data.aweme_detail.video.play_addr.url_list[0]
      }
    }

    if (!videoUrl) {
      return res.status(404).json({
        error: 'API返回无视频地址',
        hasDetail: !!data.aweme_detail,
        statusCode: data.status_code,
        msg: data.status_msg
      })
    }

    videoUrl = videoUrl.replace(/\\u002F/g, '/').replace(/\\\//g, '/')

    res.json({ videoUrl, videoId })
  } catch (e) {
    res.status(500).json({ error: 'API请求失败', detail: e.message })
  }
}
