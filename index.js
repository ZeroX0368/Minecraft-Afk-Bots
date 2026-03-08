const mineflayer = require('mineflayer')

const host = 'zerox-test.play.hosting'
const port = 25565
const BOT_COUNT = 5

// Global error handlers to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
  // Continue running instead of crashing
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Continue running instead of crashing
})

function randomName() {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'

  let name = ''

  const length = Math.floor(Math.random() * 5) + 5 // 5-10 chars

  for (let i = 0; i < length; i++) {
    if (Math.random() < 0.8) {
      name += chars[Math.floor(Math.random() * chars.length)]
    } else {
      name += numbers[Math.floor(Math.random() * numbers.length)]
    }
  }

  return name
}

function createBot() {

  const username = randomName()

  const bot = mineflayer.createBot({
    host: host,
    port: port,
    username: username,
    auth: 'offline',
    version: false
  })

  console.log(`Bot connecting: ${username}`)

  bot.on('login', () => {
    console.log(`${username} logged in`)
  })

  bot.on('spawn', () => {
    console.log(`${username} spawned`)
    console.log(`Health: ${bot.health}`)
    console.log(`Food: ${bot.food}`)
  })

  bot.on('chat', (user, message) => {
    if (user === username) return
    console.log(`[${username}] ${user}: ${message}`)
  })

  bot.on('kicked', reason => {
    console.log(`${username} kicked:`, reason)
  })
  bot.on('spawn', () => {
  setInterval(() => {
    bot.setControlState('jump', true)
    setTimeout(() => bot.setControlState('jump', false), 500)
  }, 10000)
})
  
  bot.on('end', () => {
    console.log(`${username} disconnected`)
  })

  bot.on('error', err => {
    console.log(`${username} error:`, err)
  })
}

for (let i = 0; i < BOT_COUNT; i++) {
  setTimeout(createBot, i * 2000) // join cách nhau 2s
}
