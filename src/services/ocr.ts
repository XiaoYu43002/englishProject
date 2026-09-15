import { apiUrl } from '@/config/api'
import type { OcrResult } from '@/types/domain'

interface UploadResponse {
  statusCode: number
  data: string
}

export function recognizeImage(filePath: string): Promise<OcrResult> {
  const endpoint = apiUrl('/api/ocr/words')
  if (!endpoint) return Promise.reject(new Error('请先配置 VITE_API_BASE_URL 并启动 OCR 服务'))

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: endpoint,
      filePath,
      name: 'file',
      timeout: 60000,
      success: (response: UploadResponse) => {
        try {
          const data = JSON.parse(response.data || '{}') as OcrResult & { message?: string }
          if (response.statusCode !== 200) throw new Error(data.message || '图片识别失败')
          resolve(data)
        } catch (error) {
          reject(error instanceof Error ? error : new Error('OCR 返回格式错误'))
        }
      },
      fail: (error) => {
        const detail = error.errMsg || '图片上传失败'
        reject(
          new Error(
            `${detail}。请确认手机能访问 ${endpoint}（真机不要用 localhost，应填电脑局域网 IP，并重新编译）`,
          ),
        )
      },
    })
  })
}
