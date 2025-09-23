import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'

const allowedRoles = ['dm', 'player']
const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12)

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  avatarUrl: user.avatarUrl ?? null,
})

const signToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  )

const ensureUniqueUsername = async (base) => {
  const trimmed = base.replace(/\s+/g, '').toLowerCase()
  if (!trimmed) {
    return ensureUniqueUsername('user')
  }

  let candidate = trimmed
  let suffix = 1

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await User.findOne({ where: { username: candidate } })
    if (!existing) break
    candidate = `${trimmed}${suffix}`
    suffix += 1
  }

  return candidate
}

export const register = async (req, res, next) => {
  try {
    const { email, username, password, role = 'player', displayName } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existingEmail = await User.findOne({ where: { email: normalizedEmail } })
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already in use' })
    }

    let finalUsername = username?.trim().toLowerCase()
    if (finalUsername) {
      const existingUsername = await User.findOne({ where: { username: finalUsername } })
      if (existingUsername) {
        finalUsername = await ensureUniqueUsername(finalUsername)
      }
    } else {
      const base = normalizedEmail.split('@')[0]
      finalUsername = await ensureUniqueUsername(base)
    }

    const targetRole = allowedRoles.includes(role) ? role : 'player'
    const passwordHash = await bcrypt.hash(password, saltRounds)

    const user = await User.create({
      email: normalizedEmail,
      username: finalUsername,
      passwordHash,
      role: targetRole,
      displayName: displayName?.trim() || null,
    })

    res.status(201).json({ user: sanitizeUser(user) })
  } catch (error) {
    next(error)
  }
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await User.findOne({ where: { email: normalizedEmail } })

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = signToken(user)

    res.json({
      token,
      user: sanitizeUser(user),
    })
  } catch (error) {
    next(error)
  }
}

export const me = async (req, res) => {
  res.json({ user: sanitizeUser(req.user) })
}
