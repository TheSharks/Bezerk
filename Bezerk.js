const Debug = require('debug')
const Logger = new Debug('bezerk')
const WSS = require('ws').Server
const Config = require('./config.json')

let shards = []
let receivers = []

const BezerkWS = new WSS({
  port: Config.port
})

BezerkWS.on('connection', (socket) => {
  Logger('New websocket.')
  socket.send(JSON.stringify({
    op: 'HELLO'
  }))
  socket.on('message', (msg) => process(socket, msg))
})

function process (socket, message) {
  Logger('Attempting to process a message.')
  let msg
  try {
    JSON.parse(message)
  } catch (e) {
    socket.close()
    Logger('Closing socket, invalid data received.')
  }
  if (!msg.op) {
    socket.close()
    Logger('Closing socket, no OP code received.')
    return
  }
  if (msg.op === 'IDENTIFY_SHARD') {
    Logger('A socket is trying to connect as a shard.')
    if (!msg.c) {
      socket.close()
      Logger('Closing socket, no sharding info recieved.')
      return
    } else {
      if (!Array.isArray(msg.c)) {
        socket.close()
        Logger('Closing connection, invalid sharding info')
        return
      } // We're assuming only wildbeast is going to connect to bezerk as a shard, so we are not going to check for valid data
      Logger('Accepted shard.')
      socket.shardInfo = msg.c
      socket.type = 'shard'
      shards.push(socket)
      socket.send(JSON.stringify({
        op: 'OK'
      }))
    }
  } else if (msg.op === 'IDENTIFY_LISTENER') {
    Logger('A socket is trying to connect as a listener')
    if (!msg.c) {
      socket.close()
      Logger('Closing socket, no subscriptions.')
      return
    }
    if (!Array.isArray(msg.c)) {
      socket.close()
      Logger('Closing socket, invalid subscriptions.')
    } else {
      Logger('Accepted listener')
      socket.subscriptions = msg.c
      socket.type = 'listener'
      receivers.push(socket)
      socket.send(JSON.stringify({
        op: 'OK'
      }))
    }
  } else {
    // This is where it's going to get fun.
    if (receivers.indexOf(socket) === -1 && shards.indexOf(socket) === -1) {
      socket.close()
      Logger('Socket tried sending events without being identified first.')
      return
    }
    if (socket.type === 'listener') {
      if (msg.shard) {
        Logger('Listener event defined a shard, trying to find it and send the message.')
        for (let shard of shards) {
          if (shard.shardInfo[0] === msg.shard) {
            Logger('Shard found, sending payload.')
            shard.send(msg)
          }
        }
      } else {
        Logger('Listener event did not define a shard, falling back to sending to all shards.')
        for (let shard of shards) {
          shard.send(msg)
        }
      }
    } else {
      if (!msg.op) {
        socket.close()
        Logger('Closing shard connection, no event passed.')
        return
      }
      if (!msg.c) {
        socket.close()
        Logger('Closing shard connection, no data.')
      } else {
        Logger('Request accepted, attempting to send data to subscribed listeners.')
        for (let listener of receivers) {
          if (listener.indexOf(msg.c) > -1) {
            Logger('Sending data.')
            listener.send(msg)
          }
        }
      }
    }
  }
}
