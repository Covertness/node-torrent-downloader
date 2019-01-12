export default class Torrent {
    constructor(infoHash, gid, status, files, totalLength, completedLength, downloadSpeed, uploadSpeed, bitfield, pieceLength, numPieces) {
        this.id = this.infoHash = infoHash
        this.gid = gid
        this._status = status
        this._files = files
        this.totalLength = totalLength
        this.completedLength = completedLength
        this.downloadSpeed = downloadSpeed
        this.uploadSpeed = uploadSpeed
        this.bitfield = bitfield
        this.pieceLength = pieceLength
        this.numPieces = numPieces
    }

    updateStatus(status, bitfield, files) {
        this._status = status
        this.bitfield = bitfield
        this._files = files
    }

    get status() {
        const totalLength = this._selectedFiles().reduce((p, f) => p + parseInt(f.length), 0)
        const completedLength = this._selectedFiles().reduce((p, f) => p + parseInt(f.completedLength), 0)
        return {
            status: this._status,
            process: completedLength / totalLength,
            downloadSpeed: parseInt(this.downloadSpeed),
            uploadSpeed: parseInt(this.uploadSpeed),
            completedLength: completedLength,
            totalLength: totalLength
        }
    }

    get files() {
        return this._selectedFiles().map(f => {
            const completedLength = parseInt(f.completedLength)
            const length = parseInt(f.length)

            return {
                index: parseInt(f.index),
                path: f.path,
                process: completedLength / length,
                completedLength: completedLength,
                length: length
            }
        })
    }

    _selectedFiles() {
        return this._files.filter(f => f.selected === 'true')
    }
}