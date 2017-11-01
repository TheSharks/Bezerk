const log = require('debug')('bezerk')
const WS = require('ws')
const Manager = require('./src/models/SocketManager')()

const Server = new WS.Server({
  port: require('./config.json').port
})

Server.on('connection', socket => {
  log('New socket connected')
  socket.on('message', m => process(socket, m))
  identify(socket)
})

function process (socket, message) {
  let msg
  try {
    msg = JSON.parse(message)
  } catch (e) {
    socket.close(4002) // unprocessable entity
  }
  if (!socket.bezerk) { // this is either not a bezerk socket, or its uninitialized
    if (socket.readyState === WS.OPEN) { // confirm we havent closed the socket
      if (!msg.op || msg.op !== 20) return socket.close(4003) // invalid data
      if (!msg.c || msg.c !== 'shard' || msg.c !== 'listener') return socket.close(4003)
      if (!msg.d) return socket.close(4003)
      if (msg.c === 'listener' && !Array.isArray(msg.d)) return socket.close(4003)
      if (msg.c === 'shard' && typeof msg.d !== 'number') return socket.close(4003)
      socket.bezerk = {type: msg.c}
      (msg.c === 'listener') ? socket.bezerk.subscriptions = msg.d : socket.bezerk.shard = msg.d
      log(`New socket is successfully authenticated as a ${msg.c}`)
      Manager.add(socket)
      socket.send(JSON.stringify({
        op: 11
      }))
    }
  } else {
    // this is a proper bezerk socket, continue
    bezerkProcess(socket, msg)
  }
}

function bezerkProcess (socket, packet) {
  if (!socket.bezerk) return // PANIC!!!!
  if (!packet.op) return socket.close(4003)
  switch (packet.op) {
    case 1: { // HEARTBEAT
      Manager.touch(socket.bezerk)
      socket.send(JSON.stringify({
        op: 2
      }))
      break
    }
    case 21: { // DISPATCH
      if (socket.bezerk.type !== 'shard') return socket.close(4004) // Invalid opcode
      Manager.get('listener', packet.d).send(packet)
      break
    }
    case 30: // REQUEST_USER
    case 40: // REQUEST_GUILD
    case 50: { // EVAL
      if (socket.bezerk.type === 'listener') {
        if (!packet.shard) {
          let shards = Manager.getAll('shard')
          shards.map(s => {
            s.send(packet)
          })
        } else {
          let shard = Manager.get('shard', packet.shard)
          if (shard) shard.send(packet)
        }
      } else {
        Manager.getAll('listeners').map(c => {
          c.send(packet)
        })
      }
    }
  }
}

function identify (socket) {
  socket.send(JSON.stringify({
    op: 10,
    heartbeat_interval: 4750 // 250ms to account for jitter
  }))
}