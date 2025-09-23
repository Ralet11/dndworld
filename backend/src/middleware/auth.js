import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User } from '../models/User.js'

const extractToken = (header) => {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null
  return value ?? null
}

export const requireAuth = async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization)
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const payload = jwt.verify(token, env.jwtSecret)
    const user = await User.findByPk(payload.sub)

    if (!user) {
      return res.status(401).json({ message: 'User not found' })
    }

    req.user = user
    req.auth = {
      token,
      payload,
    }

    return next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
    return next(error)
  }
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  return next()
}
