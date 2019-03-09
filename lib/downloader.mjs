import Emitter from 'events'
import bncode from 'bncode'
import crypto from 'crypto'
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

    get torrents() {
        return Array.from(this.torrentTable.values())
    }

    async addTorrent(torrentBin, options = {}) {
        const torrent = bncode.decode(torrentBin)
        const infoHash = this.constructor.sha1(bncode.encode(torrent.info))

        if (this.torrentTable.has(infoHash)) return infoHash

        const gid = await this._callMethod({
            'method': 'aria2.addTorrent',
            'params': [torrentBin.toString('base64'), [], options]
        })

        const newTorrent = new Torrent(infoHash, gid)
        this.torrentTable.set(newTorrent.id, newTorrent)
        return newTorrent.id
    }

    async getTorrent(id) {
        const torrent = this._getTorrent(id)

        const t = await this._tellStatus(torrent.gid)
        torrent.updateStatus(t.status, t.files, t.totalLength, t.completedLength, t.downloadSpeed, t.uploadSpeed, t.bitfield, t.pieceLength, t.numPieces)
        return torrent
    }

    async pauseTorrent(id) {
        const torrent = this._getTorrent(id)

        await this._callMethod({
            'method': 'aria2.pause',
            'params': [torrent.gid]
        })
    }

    async updateTorrent(id, options) {
        const torrent = this._getTorrent(id)

        const result = await this._callMethod({
            'method': 'aria2.changeOption',
            'params': [torrent.gid, options]
        })

        if (result !== 'OK') throw new Error(result)
    }

    async unpauseTorrent(id) {
        const torrent = this._getTorrent(id)

        await this._callMethod({
            'method': 'aria2.unpause',
            'params': [torrent.gid]
        })
    }

    async removeTorrent(id) {
        const torrent = this._getTorrent(id)

        await this._callMethod({
            'method': 'aria2.remove',
            'params': [torrent.gid]
        })
    }

    async purgeDownloadResult() {
        await this._callMethod({
            'method': 'aria2.purgeDownloadResult'
        })

        this.torrents.forEach(torrent => {
            if (torrent._status === 'removed') {
                this.torrentTable.delete(torrent.id)
            }
        })
    }

    shutdown() {
        this.wsClient.stop()
        this.aria2.stop()
        this.emit('shutdown')
    }

    async _tellStatus(gid) {
        return await this._callMethod({
            'method': 'aria2.tellStatus',
            'params': [gid]
        })
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
        if (this.config.rpcSecret) {
            params.params = [`token:${this.config.rpcSecret}`].concat(params.params || [])
        }

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

    _getTorrent(id) {
        if (!this.torrentTable.has(id)) throw new Error('NOT_FOUND')
        return this.torrentTable.get(id)
    }

    _generateId() {
        return this.reqId += 1
    }

    static sha1(data) {
        return crypto.createHash('sha1').update(data).digest('hex')
    }
}