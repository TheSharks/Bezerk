const WS = require('ws')

class SocketManager {
  constructor (options) {
    this._sockets = []
  }
  add (socket) {
    if (!(socket instanceof WS)) throw new TypeError('socket is not instanceof WS')
    if (!socket.bezerk) throw new TypeError('not a bezerk socket')
    this._sockets.push(socket)
  }
  get (type, value) {
    switch (type) {
      case 'listener': {
        return this._sockets.filter(c => c.bezerk.type === 'listener' && c.bezerk.subscriptions.indexOf(value) > -1)
      }
      case 'shard': {
        return this._sockets.find(c => c.bezerk.type === 'shard' && c.bezerk.shard === value)
      }
      default: {
        throw new TypeError('no such type')
      }
    }
  }
  getAll (type) {
    if (!type) return this._sockets
    else return this._sockets.filter(c => c.bezerk.type === type)
  }
  get length () { return this._sockets.length }
  get size () {
    return {
      shards: this._sockets.filter(c => c.bezerk.type === 'shard').length,
      listeners: this._sockets.filter(c => c.bezerk.type === 'listener').length,
      total: this._sockets.length
    }
  }
}

module.exports = SocketManager
