require('dotenv').config()

const WSS = require('ws').Server
const secret = process.env.BEZERK_SECRET
const Server = new WSS({
  clientTracking: true,
  port: process.env.BEZERK_PORT
})

Server.on('connection', socket => {
  socket.on('message', msg => handle(socket, msg))
  socket.on('close', () => {})
  socket.on('error', console.error)
  send(socket, {
    op: '1001'
  })
})

function handle (socket, msg) {
  if (socket.readyState !== 1) return
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
          socket.shardid = msg.c.shard
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
        if (msg.d !== undefined) {
          Server.clients.forEach(x => {
            if (x.type === 'shard' && x.shardid) {
              return send(x, {
                op: '2001', // REQUEST
                c: msg.c
              })
            }
          })
          send(socket, {
            op: '5000' // CANNOT_COMPLY
          })
        } else {
          Server.clients.forEach(x => {
            if (x.type === 'shard') {
              send(x, {
                op: '2001', // REQUEST
                c: msg.c
              })
            }
          })
        }
      }
      break
    }
    case '5000': { // CANNOT_COMPLY
      Server.clients.forEach(x => {
        if (x.type !== socket.type) send(x, msg)
      })
      break
    }
  }
}

function send (socket, payload) {
  if (socket.readyState !== 1) return
  if (typeof payload === 'object') payload = JSON.stringify(payload)
  socket.send(payload)
}

function validate (socket, msg) {
  if (socket.readyState !== 1) return
  if (msg.op === undefined) throw new Error()
  if (msg.c === undefined) throw new Error()
  return true
}
