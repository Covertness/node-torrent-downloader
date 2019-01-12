import Downloader from './lib/downloader'

const downloader = new Downloader({
    attach: false,
    rpcSecret: 'UMczgvVPiBVuE6DYw2F8ZxjcAB62K9yjtxTSbGFFphNWPKgFRw6Ku6dnJ4RQwecE'
})

downloader.open().then(() => {
    console.log('downloader opened')

    downloader.on('shutdown', () => {
        console.log('downloader shutdown')
    })

    setInterval(() => {
        // downloader.getGlobalStat().then((stat) => {
        //     console.log('current stat', stat)
        // })

        downloader.torrentTable.forEach(torrent => {
            console.log('torrent:', torrent.id)

            downloader.getTorrent(torrent.id).then(torrent => {
                console.log('status:', torrent.status)
                console.log('files:', torrent.files)
            }).catch((error) => {
                console.error('getTorrent error:', error)
            })
        })
    }, 2000)

    // setInterval(() => {
    //     downloader.tellStatus('499c61dbb9b9ec9a').then((stat) => {
    //         console.log('torrent status', stat)
    //     })
    // }, 2000)

    // const torrentContent = parseTorrent(fs.readFileSync('./data/test.torrent'))
    // console.log(torrentContent)

    // fs.readFile('data/test2.torrent', (_, data) => {
    //     downloader.addTorrent(data).then((gid) => {
    //         console.log('add torrent success', gid)

            
    //     })
    // })
}).catch((error) => {
    console.error('downloader error:', error)
})

const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2']

signalTraps.map(type => {
    process.once(type, async () => {
        try {
            console.log('shutdown downloader')
            downloader.shutdown()
        } finally {
            process.kill(process.pid, type)
        }
    })
})