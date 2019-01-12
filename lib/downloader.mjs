import Emitter from 'events'
import Aria2 from './aria2'
import WSClient from './ws-client'
import Torrent from './torrent'

export default class Downloader extends Emitter {
    constructor(options = {}) {
        super()

        this.config = Object.assign({
            attach: true,
            maxTorrentTableLen: 10000,
            rpcPort: 6800
        }, options)

        this.aria2 = new Aria2(Object.assign({
            rpcPort: this.config.rpcPort
        }, this.config.aria2))

        if (this.config.attach) {
            this.aria2.on('close', () => {
                this.shutdown()
            })
        }

        this.wsClient = new WSClient()
        this.wsClient.on('close', () => {
            this.shutdown()
        })

        this.reqId = 0
        this.torrentTable = new Map()
    }

    async open() {
        this.wsClient.on('message', (message) => {
            console.log('got message', message)
        })

        if (this.config.attach) {
            await this.aria2.start()
        }

        await this.wsClient.start(`ws://localhost:${this.config.rpcPort}/jsonrpc`)

        const activeTorrents = await this._tellActive()
        const waitingTorrents = await this._tellWaiting(0, this.config.maxTorrentTableLen)
        const stoppedTorrents = await this._tellStopped(0, this.config.maxTorrentTableLen)

        activeTorrents.concat(waitingTorrents).concat(stoppedTorrents).forEach(t => {
            const torrent = new Torrent(t.infoHash, t.gid, t.status, t.files, t.totalLength, t.completedLength, t.downloadSpeed, t.uploadSpeed, t.bitfield, t.pieceLength, t.numPieces)
            this.torrentTable.set(torrent.id, torrent)
        })
    }

    async getGlobalStat() {
        return this._callMethod({
            'method': 'aria2.getGlobalStat'
        })
    }

    async addTorrent(torrentBin) {
        return this._callMethod({
            'method': 'aria2.addTorrent',
            'params': [torrentBin.toString('base64')]
        })
    }

    async getTorrent(id) {
        if (!this.torrentTable.has(id)) throw new Error('NOT_FOUND')
        const torrent = this.torrentTable.get(id)

        const s = await this._callMethod({
            'method': 'aria2.tellStatus',
            'params': [torrent.gid]
        })

        torrent.updateStatus(s.status, s.bitfield, s.files)
        return torrent
    }

    shutdown() {
        this.wsClient.stop()
        this.aria2.stop()
        this.emit('shutdown')
    }

    async _tellActive() {
        return this._callMethod({
            'method': 'aria2.tellActive'
        })
    }

    async _tellWaiting(offset, num) {
        return this._callMethod({
            'method': 'aria2.tellWaiting',
            'params': [offset, num]
        })
    }

    async _tellStopped(offset, num) {
        return this._callMethod({
            'method': 'aria2.tellStopped',
            'params': [offset, num]
        })
    }

    async _callMethod(params) {
        const response = await this.wsClient.call(Object.assign({
            'jsonrpc': '2.0',
            'id': this._generateId()
        }, params))

        if (response['error']) {
            throw new Error(JSON.stringify(response['error']))
        } else {
            return response['result']
        }
    }

    _generateId() {
        return this.reqId += 1
    }
}