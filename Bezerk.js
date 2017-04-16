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

setInterval(() => {
  for (let socket of shards) {
    if (socket.readyState !== 1) {
      shards.splice(shards.indexOf(socket), 1)
      send({
        op: "SHARD_LEFT",
        c: socket.shardInfo
      })
    }
  }
}, 1000)

function process (socket, message) {
  Logger('Attempting to process a message.')
  Logger(message)
  var msg
  try {
    msg = JSON.parse(message)
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
    if (msg.c == undefined) {
      socket.close()
      Logger('Closing socket, no sharding info recieved.')
      return
    } else {
      // We're assuming only wildbeast is going to connect to bezerk as a shard, so we are not going to check for valid data
      Logger('Accepted shard.')
      socket.shardInfo = msg.c
      socket.type = 'shard'
      shards.push(socket)
      socket.send(JSON.stringify({
        op: 'OK'
      }))
      send({
        op: "SHARD_JOINED",
        c: socket.shardInfo
      })
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
    if (socket.type === 'listener' || msg.op === 'EVAL') {
      if (msg.shard) {
        Logger('Listener event defined a shard, trying to find it and send the message.')
        for (let shard of shards) {
          if (shard.shardInfo === msg.shard) {
            Logger('Shard found, sending payload.')
            if (shard.readyState === 1) shard.send(JSON.stringify(msg))
          }
        }
      } else {
        Logger('Listener event did not define a shard, falling back to sending to all shards.')
        for (let shard of shards) {
          if (shard.readyState === 1) shard.send(JSON.stringify(msg))
        }
      }
    } else {
      if (!msg.op) {
        socket.close()
        Logger('Closing shard connection, no event passed.')
        return
      }
      if (msg.c === undefined && msg.op !== 'EVAL_REPLY') {
        socket.close()
        Logger('Closing shard connection, no data.')
      } else {
        Logger('Request accepted, attempting to send data to subscribed listeners.')
        for (let listener of receivers) {
          if (listener.subscriptions.indexOf(msg.op) > -1 || listener.subscriptions.indexOf('*') > -1 && listener.readyState === 1) {
            msg.shard = socket.shardInfo
            Logger('Sending data.')
            listener.send(JSON.stringify(msg))
          }
        }
      }
    }
  }
}

function send(msg) {
  for (let listener of receivers) {
    if (listener.subscriptions.indexOf(msg.op) > -1 || listener.subscriptions.indexOf('*') > -1 && listener.readyState === 1) {
      Logger('Sending data.')
      listener.send(JSON.stringify(msg))
    }
  }
}