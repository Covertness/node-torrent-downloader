# node-torrent-downloader

A torrent downloader utility based on [aria2](https://aria2.github.io/).


## API
#### `downloader = new Downloader()`

Create a new downloader instance.

#### `downloader.open()`

Start the downloader.

#### `torrentId = await downloader.addTorrent(torrentBin, options)`

Add a torrent.

#### `torrent = await downloader.getTorrent(torrentId)`

Get a torrent(refreshed).

#### `torrent.status`

The torrent status.

#### `torrent.files`

The torrent selected files.