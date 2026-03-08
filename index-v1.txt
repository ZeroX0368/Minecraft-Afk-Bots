const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'zerox-test.play.hosting',
  port: 25565,
  username: 'hirosi',
  version: '1.21.11',
  auth: 'offline'
});

bot.on('login', () => {
  console.log('Bot logged in successfully!');
  console.log(`Bot position: ${bot.player.position}`);
});

bot.on('spawn', () => {
  console.log('Bot spawned!');
  console.log(`Bot health: ${bot.health}`);
  console.log(`Bot food: ${bot.food}`);
});

bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  console.log(`${username}: ${message}`);
});

bot.on('error', (err) => {
  console.error('Bot error:', err);
});

bot.on('end', () => {
  console.log('Bot disconnected');
});

bot.on('kicked', (reason) => {
  console.log('Bot was kicked:', reason);
});

console.log('Bot connecting to direboss.progamer.me:44909...');
