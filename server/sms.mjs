import { createHmac, randomUUID } from 'node:crypto'

function encode(value) {
  return encodeURIComponent(String(value))
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~')
}

function resolveCredentials() {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY || process.env.ALIYUN_ACCESS_KEY_ID || ''
  const accessKeySecret = process.env.ALIYUN_SMS_SECRET_KEY || process.env.ALIYUN_ACCESS_KEY_SECRET || ''
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || ''
  return { accessKeyId, accessKeySecret, signName }
}

export function smsConfigured() {
  const { accessKeyId, accessKeySecret, signName } = resolveCredentials()
  return Boolean(accessKeyId && accessKeySecret && signName)
}

export function templateForScene(scene = 'login') {
  const map = {
    login: process.env.ALIYUN_SMS_TEMPLATE_LOGIN,
    register: process.env.ALIYUN_SMS_TEMPLATE_REGISTER,
    bind: process.env.ALIYUN_SMS_TEMPLATE_BIND_PHONE,
    reset: process.env.ALIYUN_SMS_TEMPLATE_RESET_PASSWORD,
    change: process.env.ALIYUN_SMS_TEMPLATE_CHANGE_PASSWORD,
    delete: process.env.ALIYUN_SMS_TEMPLATE_DELETE_ACCOUNT,
  }
  return map[scene] || process.env.ALIYUN_SMS_TEMPLATE_CODE || map.login || ''
}

export async function sendAliyunSms({ phone, code, scene = 'login' }) {
  const { accessKeyId, accessKeySecret, signName } = resolveCredentials()
  const templateCode = templateForScene(scene)
  if (!accessKeyId || !accessKeySecret || !signName) throw new Error('阿里云短信未配置')
  if (!templateCode) throw new Error('未配置短信模板 CODE')

  const params = {
    AccessKeyId: accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    RegionId: 'cn-hangzhou',
    SignName: signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: randomUUID(),
    SignatureVersion: '1.0',
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code: String(code) }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    Version: '2017-05-25',
  }

  const canonicalized = Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join('&')
  const stringToSign = `GET&${encode('/')}&${encode(canonicalized)}`
  const signature = createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64')
  const url = `https://dysmsapi.aliyuncs.com/?${canonicalized}&Signature=${encode(signature)}`
  const response = await fetch(url)
  const data = await response.json()
  if (data.Code !== 'OK') throw new Error(data.Message || data.Code || '短信发送失败')
  return data
}
