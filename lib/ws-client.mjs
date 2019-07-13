import Emitter from 'events'
import WebSocket from 'websocket'
const WebSocketClient = WebSocket.client

export default class WSClient extends Emitter {
    constructor() {
        super()

        this.messageTable = new Map()
        this.client = new WebSocketClient({
            maxReceivedFrameSize: 10*1024*1024
        })
    }

    async start(url) {
        return new Promise((resolve, reject) => {
            const client = this.client

            client.on('connectFailed', (error) => {
                reject('ws connect Error: ' + error.toString())
            })

            client.on('connect', (connection) => {
                this.connection = connection

                connection.on('error', (error) => {
                    console.log("Connection Error: " + error.toString())
                    this.stop()
                });
                connection.on('close', (reasonCode, desc) => {
                    console.log("Connection close: " + reasonCode + " " + desc)
                    this.emit('close')
                });
                connection.on('message', (message) => {
                    if (message.type !== 'utf8') return

                    let response
                    try {
                        response = JSON.parse(message.utf8Data)
                    } catch(_e) {
                        return
                    }

                    const messageInfo = this.messageTable.get(response['id'])
                    if (!messageInfo) return
                    
                    messageInfo.callback(response)
                })

                resolve()
            })

            client.connect(url)
        })
    }

    async call(message) {
        const messageId = message.id
        const messageTable = this.messageTable
        return new Promise((resolve, reject) => {
            if (messageTable.has(messageId)) {
                reject('dup')
                return
            }

            const msgTimeout = setTimeout(() => {
                messageTable.delete(messageId)
                reject('timeout')
            }, 5000)
            
            const msgCB = (response) => {
                clearTimeout(msgTimeout)
                messageTable.delete(messageId)
                resolve(response)
            }

            messageTable.set(messageId, {
                timeout: msgTimeout,
                callback: msgCB
            })

            this.send(JSON.stringify(message))
        })
    }

    send(message) {
        this.connection.sendUTF(message)
    }

    stop() {
        this.connection && this.connection.drop()
    }
}