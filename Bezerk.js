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
  var msg
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
      socket.shardInfo = msg.c
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
    } else {
      socket.subscriptions = msg.c
      receivers.push(socket)
      socket.send(JSON.stringify({
        op: 'OK'
      }))
    }
  }
}
