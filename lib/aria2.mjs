import Emitter from 'events'
import fs from 'fs-extra'
import ChildProcess from 'child_process'
const spawn = ChildProcess.spawn

export default class Aria2 extends Emitter {
    constructor(options = {}) {
        super()

        // logLevel only permit notice or above for monitoring start status
        if (['warn', 'error'].indexOf(options.logLevel) >= 0) {
            options.logLevel = 'notice'
        }

        this.config = Object.assign({
            logLevel: 'notice',
            workPath: 'aria2',
            sessionFile: '.aria2.session',
            btTrackers: []
        }, options)
    }

    async start() {
        const sessionFilePath = `${this.config.workPath}/${this.config.sessionFile}`
        fs.ensureFileSync(sessionFilePath)

        return new Promise((resolve, reject) => {
            const aria2Process = this.aria2Process = spawn('aria2c', [
                `--console-log-level=${this.config.logLevel}`, 
                '--enable-rpc',
                `--rpc-listen-port=${this.config.rpcPort}`,
                `--dir=${this.config.workPath}`,
                `--input-file=${sessionFilePath}`, 
                `--save-session=${sessionFilePath}`, 
                '--save-session-interval=10',
                '--file-allocation=none',
                '--bt-remove-unselected-file=true',
                this.config.btTrackers.length > 0 ? `--bt-tracker=${this.config.btTrackers.join(',')}` : null
            ])

            aria2Process.stdout.on('data', (data) => {
                if (data.indexOf('RPC: listening on TCP port') >= 0) {
                    resolve()
                }
            })

            aria2Process.stderr.on('data', (data) => {
                console.error(`aria2c stderr: ${data}`)
            });

            aria2Process.on('close', (code) => {
                reject(`aria2c process exited with code ${code}`)
                this.emit('close', code)
            })
        })
    }



    stop() {
        this.aria2Process.kill()
    }
}