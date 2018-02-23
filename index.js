require('dotenv').config()

const WSS = require('ws').Server
const secret = process.env.BEZERK_SECRET
const Server = new WSS({
  clientTracking: true,
  port: process.env.BEZERK_PORT
})

const sockets = new Map()

Server.on('connection', socket => {
  socket.on('message', msg => handle(socket, msg))
  send(socket, {
    op: '1001'
  })
})

function handle (socket, msg) {
  try {
    msg = JSON.parse(msg)
    validate(socket, msg)
  } catch (e) {
    return socket.close(4001) // JSON_DECRYPT_ERROR
  }
  switch (msg.op) {
    case '1003': { // IDENTIFY_SUPPLY
      if (socket.type) return socket.close(4002) // ALREADY_AUTHENTICATED
      if (msg.c.secret === secret) {
        send(socket, {
          op: '1002',
          c: {
            success: true
          }
        })
        if (msg.c.shard) {
          socket.type = 'shard'
          sockets.set(`shard:${msg.c.shard}`, socket)
        } else {
          socket.type = 'listener'
        }
      } else {
        send(socket, {
          op: '1002',
          c: {
            success: false
          }
        })
      }
      break
    }
    case '2002': { // REQUEST_REPLY
      if (socket.type === 'shard') {
        Server.clients.forEach(x => {
          if (x.type === 'listener') {
            send(x, {
              op: '2002',
              c: msg.c
            })
          }
        })
      }
      break
    }
    case '2005': { // REQUEST_APPLY
      if (socket.type === 'listener') {
        if (msg.c.shard !== undefined) {
          if (sockets.has(`shard:${msg.c.shard}`)) {
            send(sockets.get(`shard:${msg.c.shard}`), {
              op: '2001', // REQUEST
              c: msg.c
            })
          } else {
            send(socket, {
              op: '5000' // CANNOT_COMPLY
            })
          }
        } else {
          sockets.forEach((value, key) => {
            if (value.startsWith('shard:')) {
              send(key, {
                op: '2001', // REQUEST
                c: msg.c
              })
            }
          })
        }
      }
      break
    }
  }
}

function send (socket, payload) {
  if (typeof payload === 'object') payload = JSON.stringify(payload)
  socket.send(payload)
}

function validate (socket, msg) {
  if (msg.op === undefined) throw new Error()
  if (msg.c === undefined) throw new Error()
  return true
}
