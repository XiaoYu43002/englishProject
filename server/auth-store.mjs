import { createHash, randomBytes, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const CODE_TTL_MS = 5 * 60 * 1000
const CODE_COOLDOWN_MS = 60 * 1000
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function createAuthStore(filePath) {
  const codes = new Map()
  let db = { users: [], sessions: [] }

  function load() {
    try {
      if (fs.existsSync(filePath)) db = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      db = { users: [], sessions: [] }
    }
    if (!Array.isArray(db.users)) db.users = []
    if (!Array.isArray(db.sessions)) db.sessions = []
  }

  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2))
  }

  function publicUser(user) {
    return {
      id: user.id,
      phone: user.phone || '',
      nickname: user.nickname || '',
      avatar: user.avatar || '',
      loginMethods: user.loginMethods || [],
      createdAt: user.createdAt,
    }
  }

  function findUserByPhone(phone) {
    return db.users.find((item) => item.phone === phone)
  }

  function findUserByWechatOpenId(openId) {
    return db.users.find((item) => item.wechatOpenId === openId)
  }

  function findUserById(id) {
    return db.users.find((item) => item.id === id)
  }

  function createSession(userId) {
    const now = Date.now()
    const token = randomBytes(24).toString('hex')
    db.sessions = db.sessions.filter((item) => item.expiresAt > now)
    db.sessions.push({ token, userId, createdAt: now, expiresAt: now + SESSION_TTL_MS })
    save()
    return token
  }

  function getSessionUser(token) {
    if (!token) return null
    const now = Date.now()
    const session = db.sessions.find((item) => item.token === token && item.expiresAt > now)
    if (!session) return null
    const user = findUserById(session.userId)
    return user ? publicUser(user) : null
  }

  function upsertPhoneUser(phone) {
    let user = findUserByPhone(phone)
    if (!user) {
      user = {
        id: randomUUID(),
        phone,
        nickname: `用户${phone.slice(-4)}`,
        avatar: '',
        wechatOpenId: '',
        wechatUnionId: '',
        loginMethods: ['phone'],
        createdAt: new Date().toISOString(),
      }
      db.users.push(user)
    } else if (!user.loginMethods.includes('phone')) {
      user.loginMethods.push('phone')
    }
    save()
    return user
  }

  function upsertWechatUser({ openId, unionId }) {
    let user = findUserByWechatOpenId(openId)
    if (!user) {
      user = {
        id: randomUUID(),
        phone: '',
        nickname: `微信用户${openId.slice(-4)}`,
        avatar: '',
        wechatOpenId: openId,
        wechatUnionId: unionId || '',
        loginMethods: ['wechat'],
        createdAt: new Date().toISOString(),
      }
      db.users.push(user)
    } else {
      if (unionId) user.wechatUnionId = unionId
      if (!user.loginMethods.includes('wechat')) user.loginMethods.push('wechat')
    }
    save()
    return user
  }

  function saveCode(phone, code) {
    codes.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS, sentAt: Date.now() })
  }

  function getCodeRecord(phone) {
    const record = codes.get(phone)
    if (!record) return null
    if (record.expiresAt < Date.now()) {
      codes.delete(phone)
      return null
    }
    return record
  }

  function consumeCode(phone, code) {
    const record = getCodeRecord(phone)
    if (!record || record.code !== String(code)) return false
    codes.delete(phone)
    return true
  }

  function canSend(phone) {
    const record = codes.get(phone)
    if (!record) return true
    return Date.now() - record.sentAt >= CODE_COOLDOWN_MS
  }

  function hashDebug(code) {
    return createHash('sha256').update(String(code)).digest('hex').slice(0, 8)
  }

  load()

  return {
    publicUser,
    createSession,
    getSessionUser,
    upsertPhoneUser,
    upsertWechatUser,
    saveCode,
    getCodeRecord,
    consumeCode,
    canSend,
    hashDebug,
  }
}
