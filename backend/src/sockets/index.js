import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { Campaign } from '../models/Campaign.js'
import { CampaignMembership } from '../models/CampaignMembership.js'
import { User } from '../models/User.js'

const getTokenFromHandshake = (socket) => {
  const authHeader = socket.handshake.headers.authorization
  if (authHeader) {
    const [scheme, value] = authHeader.split(' ')
    if (scheme?.toLowerCase() === 'bearer' && value) {
      return value
    }
  }

  const authToken = socket.handshake.auth?.token
  if (typeof authToken === 'string' && authToken.trim()) {
    return authToken.trim()
  }

  return null
}

const verifyMembership = async (campaignId, userId) => {
  const campaign = await Campaign.findByPk(campaignId)
  if (!campaign) {
    return { authorized: false, reason: 'Campaign not found' }
  }

  if (campaign.dmId === userId) {
    return { authorized: true, role: 'dm', campaign }
  }

  const membership = await CampaignMembership.findOne({
    where: { campaignId, userId },
  })

  if (!membership || membership.status !== 'accepted') {
    return { authorized: false, reason: 'Not a campaign member' }
  }

  return { authorized: true, role: membership.roleInCampaign, campaign }
}

const rooms = {
  campaign: (campaignId) => `campaign:${campaignId}`,
  board: (boardId) => `board:${boardId}`,
}

export const registerSocketHandlers = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = getTokenFromHandshake(socket)
      if (!token) {
        return next(new Error('Missing token'))
      }

      const payload = jwt.verify(token, env.jwtSecret)
      const user = await User.findByPk(payload.sub)

      if (!user) {
        return next(new Error('User not found'))
      }

      socket.data.user = {
        id: user.id,
        role: user.role,
        displayName: user.displayName,
        username: user.username,
      }

      return next()
    } catch (error) {
      return next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const { user } = socket.data
    console.info(`Socket connected: ${socket.id} user=${user.id}`)

    socket.on('disconnect', (reason) => {
      console.info(`Socket disconnected: ${socket.id} reason=${reason}`)
    })

    socket.on('join:campaign', async ({ campaignId }, callback) => {
      if (!campaignId) {
        callback?.({ status: 'error', message: 'campaignId is required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.campaign(campaignId)
      await socket.join(room)
      callback?.({ status: 'ok', room, role: membership.role })
    })

    socket.on('join:board', async ({ campaignId, boardId }, callback) => {
      if (!boardId) {
        callback?.({ status: 'error', message: 'boardId is required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.board(boardId)
      await socket.join(room)
      callback?.({ status: 'ok', room, role: membership.role })
    })

    socket.on('chat:send', ({ campaignId, message }, callback) => {
      if (!message?.trim()) {
        callback?.({ status: 'error', message: 'Message cannot be empty' })
        return
      }

      const room = rooms.campaign(campaignId)
      io.to(room).emit('chat:message', {
        message,
        campaignId,
        user: socket.data.user,
        timestamp: new Date().toISOString(),
      })

      callback?.({ status: 'ok' })
    })

    socket.on('token:create', ({ boardId, token }, callback) => {
      if (!boardId || !token) {
        callback?.({ status: 'error', message: 'boardId and token required' })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('token:created', {
        token,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })

    socket.on('token:update', ({ boardId, token }, callback) => {
      if (!boardId || !token) {
        callback?.({ status: 'error', message: 'boardId and token required' })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('token:updated', {
        token,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })

    socket.on('token:delete', ({ boardId, tokenId }, callback) => {
      if (!boardId || !tokenId) {
        callback?.({ status: 'error', message: 'boardId and tokenId required' })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('token:deleted', {
        tokenId,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })

    socket.on('board:image:set', async ({ campaignId, boardId, scenarioId, imageIndex }, callback) => {
      if (!campaignId || !boardId || !scenarioId || !Number.isInteger(imageIndex) || imageIndex < 0) {
        callback?.({ status: 'error', message: 'campaignId, boardId, scenarioId and imageIndex required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('board:image:changed', {
        campaignId,
        boardId,
        scenarioId,
        imageIndex,
        user: socket.data.user,
      })

      callback?.({ status: 'ok' })
    })

    socket.on('npc:highlight', async ({ campaignId, boardId, npcId }, callback) => {
      if (!campaignId || !boardId || !npcId) {
        callback?.({ status: 'error', message: 'campaignId, boardId and npcId required' })
        return
      }

      const membership = await verifyMembership(campaignId, user.id)
      if (!membership.authorized) {
        callback?.({ status: 'error', message: membership.reason })
        return
      }

      const room = rooms.board(boardId)
      io.to(room).emit('npc:highlighted', {
        campaignId,
        boardId,
        npcId,
        user: socket.data.user,
        timestamp: new Date().toISOString(),
      })

      callback?.({ status: 'ok' })
    })

    socket.on('scenario:set', ({ campaignId, scenarioId }, callback) => {
      if (!campaignId || !scenarioId) {
        callback?.({ status: 'error', message: 'campaignId and scenarioId required' })
        return
      }

      const room = rooms.campaign(campaignId)
      io.to(room).emit('scenario:changed', {
        scenarioId,
        user: socket.data.user,
      })
      callback?.({ status: 'ok' })
    })
  })
}
