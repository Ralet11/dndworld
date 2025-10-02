const test = require('node:test')
const assert = require('node:assert/strict')

const Module = require('module')
const originalLoad = Module._load

Module._load = function (request, parent, isMain) {
  if (request === 'sequelize') {
    return { Op: {} }
  }
  if (request.endsWith('workers/equipPortrait')) {
    return { enqueuePortraitRefresh: async () => {} }
  }
  if (request === 'bullmq') {
    return {}
  }
  if (request === 'ioredis') {
    return function MockRedis() {}
  }
  return originalLoad(request, parent, isMain)
}

const modelStub = {
  Character: {
    count: async () => 0,
  },
}

require.cache[require.resolve('../../models')] = { exports: modelStub }

const controller = require('../charactersController')

const resetTestHarness = () => {
  Module._load = originalLoad
  modelStub.Character.count = async () => 0
}

const { hasReachedCharacterLimit, CHARACTER_LIMIT } = controller.__test__

test('allows creation when below the limit', async () => {
  modelStub.Character.count = async ({ where }) => {
    assert.equal(where.userId, 1)
    return CHARACTER_LIMIT - 1
  }

  const result = await hasReachedCharacterLimit(1)
  assert.equal(result, false)
})

test('detects the limit when exactly at the cap', async () => {
  modelStub.Character.count = async () => CHARACTER_LIMIT

  const result = await hasReachedCharacterLimit(42)
  assert.equal(result, true)
})

test('createCharacter returns 400 when limit reached', async () => {
  modelStub.Character.count = async () => CHARACTER_LIMIT

  const req = { user: { id: 99 }, body: { name: 'Test', raceId: 1, classId: 1 } }
  let statusCode
  let responseBody
  const res = {
    status(code) {
      statusCode = code
      return this
    },
    json(payload) {
      responseBody = payload
      return this
    },
  }

  await controller.createCharacter(req, res, () => {})

  assert.equal(statusCode, 400)
  assert.deepEqual(responseBody, { error: 'Ya alcanzaste el máximo de 3 personajes.' })
})

test.after(resetTestHarness)
