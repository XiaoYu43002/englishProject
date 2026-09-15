import { apiUrl } from '@/config/api'

interface AuthUser {
  id: string
  phone?: string
  nickname?: string
  avatar?: string
  loginMethods?: string[]
  createdAt?: string
}

interface AuthResult {
  token: string
  user: AuthUser
  method: 'phone' | 'wechat'
}

function requestJson<T>(path: string, options: UniApp.RequestOptions = {}): Promise<T> {
  const url = apiUrl(path)
  if (!url) return Promise.reject(new Error('请先配置 VITE_API_BASE_URL'))

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(options.header || {}),
      },
      timeout: options.timeout || 20000,
      success: (response) => {
        const data = (response.data || {}) as T & { message?: string }
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data)
          return
        }
        reject(new Error(data.message || `请求失败(${response.statusCode || 0})`))
      },
      fail: (error) => reject(new Error(error.errMsg || '网络错误')),
    })
  })
}

export function sendSmsCode(phone: string, scene: 'login' | 'register' = 'login') {
  return requestJson<{ ok: boolean; cooldownSec: number; debugCode?: string }>('/api/auth/sms/send', {
    method: 'POST',
    data: { phone, scene },
  })
}

export function loginWithSms(phone: string, code: string) {
  return requestJson<AuthResult>('/api/auth/sms/login', {
    method: 'POST',
    data: { phone, code },
  })
}

export function loginWithWechatCode(code: string) {
  return requestJson<AuthResult>('/api/auth/wechat/miniprogram', {
    method: 'POST',
    data: { code },
  })
}

export function fetchAuthMe(token: string) {
  return requestJson<{ user: AuthUser }>('/api/auth/me', {
    method: 'GET',
    header: { Authorization: `Bearer ${token}` },
  })
}

export function uniLoginWechat(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (result) => {
        if (!result.code) {
          reject(new Error('未获取到微信登录 code'))
          return
        }
        resolve(result.code)
      },
      fail: (error) => reject(new Error(error.errMsg || '微信登录失败')),
    })
  })
}
