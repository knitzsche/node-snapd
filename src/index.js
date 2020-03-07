'use strict'

const http = require('http')
const path = require('path')
const fs = require('fs')
const os = require('os')

const reach = require('./reach')

/**
 * Represents a snapd formatter error
 * @class
 * @param {object}    body
 */
class SnapdError extends Error {
  constructor(body){
    super(reach(body, 'result.message') || 'something went wrong')
    Error.captureStackTrace(this, SnapdError)
    this.code = reach(body, 'result.kind')
  }
}


/**
 * A snap client instance which makes restful call to snapd process using Unix sockets
 * @class
 * @param {string}  authFile    Defaults to `$HOME/.snap/auth.json`
 * @param {string}  socketPath  Defaults to `/run/snapd.socket`
 */
class SnapClient {
  constructor(
    authFile=path.join(os.homedir(), '.snap', 'auth.json'),
    socketPath=`/run/snapd.socket`
  ){
    this.auth = undefined
    this.socketPath = socketPath
  }


  /**
   * make restful call to snapd process thru /run/snapd.socket
   * @method
   * @param {object}  options
   * @param {object}  options.auth
   * @param {string}  options.method
   * @param {string}  options.path
   * @param {string}  options.data
   */
  async rest({auth, method, path, data}) {
    return new Promise((resolve, reject) => {
      const post = method === 'POST' || method === 'PUT'
      const headers = { 'Content-Type': 'application/json' }
      if (post) {
        headers['Content-Length'] = Buffer.byteLength(data)
      }
      if (auth && typeof auth.macaroon === 'string') {
        headers['Authorization'] = `Macaroon root="${auth.macaroon}"`
      }
      const options = {
        socketPath: this.socketPath,
        path: path,
        method: method,
        headers: headers
      }

      const req = http.request(options, (res) => {
        res.setEncoding('utf8')

        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 202) {
            if (body.length < 1) {
              return reject(new Error('empty response'))
            }
            const json = JSON.parse(body)
            return resolve(json)
          }
          const json = JSON.parse(body)

          return reject(new SnapdError(json))
        })
      })

      req.on('error', (error) => {
        return reject(error)
      })

      // write data to request body
      if (post && typeof data === 'string') {
        req.write(data)
      }
      req.end()
    })
  }


  /**
   * read auth email & macaroon from ~/.snap/auth.json
   * @method
   * @param {string}  filename
   */
  async readAuth(filename) {

    if(this.auth){
      return Promise.resolve({ email: this.auth.email, macaroon: this.auth.macaroon })
    }

    return new Promise((resolve, reject) => {
      const fn = filename || path.join(os.homedir(), '.snap', 'auth.json')
      fs.readFile(fn, (error, data) => {
        if (error) {
          return reject(error)
        }

        this.auth = JSON.parse(data)

        if (typeof this.auth.macaroon !== 'string') {
          return reject(new Error('failed to read macaroon from auth file'))
        }

        return resolve({ email: this.auth.email, macaroon: this.auth.macaroon })
      })
    })
  }


  /**
   * login may require root privilege
   * @method
   * @param {object}  options
   * @param {object}  options.auth
   * @param {string}  options.method
   * @param {string}  options.path
   * @param {string}  options.data
   */
  async login({ email, password, otp }) {
    const data = {
      email: email,
      password: password,
      otp: otp // one time passkey for 2fa
    }

    const response = await this.rest({
      method: 'POST',
      path: '/v2/login',
      data: JSON.stringify(data)
    })

    if (response && response['status-code'] === 200) {
      return {
        email: response.result.email,
        macaroon: response.result.macaroon
      }
    }

    return Promise.reject(new Error('malformed response'))
  }

  /**
   * logout may require root privilege
   * @method
   * @param {object}  options
   * @param {object}  options.auth
   */
  async logout({ auth }) {
    const response = await this.rest({
      auth: auth || await this.readAuth(),
      method: 'POST',
      path: '/v2/logout'
    })

    if (response && response['status-code'] === 200) {
      return true
    }

    return Promise.reject(new Error('malformed response'))
  }

  /**
   * list of installed snaps
   * @method
   */
  async listSnaps() {
    const response = await this.rest({
      method: 'GET',
      path: '/v2/snaps'
    })

    if (response && response['status-code'] === 200) {
      return response.result.map(entry => entry.name)
    }

    throw new Error('malformed response')
  }
  /**
   * control snaps via start/stop/enable/disable
   * @method
   * @param {object}  data
   * @param {object}  data.names
   * @param {string}  data.action
   * @param {boolean}  options.enable
   * @param {boolean}  options.disable
   * @param {boolean}  options.reload
   */
  async postApps(data) {
    const response = await this.rest({
      method: 'POST',
      path: '/v2/apps',
      data: JSON.stringify(data)
    })
    if (response && response['status-code'] === 202) {
      return response.status
    }

    throw new Error('malformed response')
  }

  /**
   * get snap configuration parameters
   * @method
   * @param {object}  data
   * @param {string}  data.name
   * @param {array}  data.keys
   */
  async getConf(data) {
    const response = await this.rest({
      auth: await this.readAuth(),
      method: 'GET',
      path: '/v2/snaps/'+data.name+'/conf',
      data: JSON.stringify(data.keys)
    })
    if (response && response['status-code'] === 200) {
      return response.result
    }

    throw new Error('malformed response')
  }
  /**
   * set snap configuration parameters
   * @method
   * @param {object}  data
   * @param {string}  data.name
   * @param {object}  data.keys
   */
  async putConf(data) {
    const response = await this.rest({
      auth: await this.readAuth(),
      method: 'PUT',
      path: '/v2/snaps/'+data.name+'/conf',
      data: JSON.stringify(data.keys)
    })
    if (response && (response['status-code'] === 202 || response['status-code'] === 200)) {
      return response.status
    }

    throw new Error('malformed response')
  }

  /**
   * Get detailed info about a snap
   * @method
   * @param {object}  options
   * @param {object}  options.name
   */
  async info({ name }) {

    if (typeof name !== 'string') {
      return Promise.reject(new Error('malformed name argument'))
    }

    const response = await this.rest({
      method: 'GET',
      path: `/v2/snaps/${name}`
    })

    if (response && response['status-code'] === 200) {
      return response.result
    }

    return Promise.reject(new Error('malformed response'))
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.action
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async modify({ action, name, auth, ...opts }) {

    if (typeof name !== 'string') {
      return Promise.reject(new Error('malformed name argument'))
    }

    const data = { action: action }
    if (opts) {
      for (const b of ['classic', 'devmode', 'ignore-validation', 'jailmode']) {
        if (opts[b]) {
          data[b] = true
        }
      }
      for (const str of ['channel', 'version']) {
        if (typeof opts[str] === 'string') {
          data[str] = opts[str]
        }
      }
    }

    const response = await this.rest({
      auth: auth || await this.readAuth(),
      method: 'POST',
      path: `/v2/snaps/${name}`,
      data: JSON.stringify(data)
    })

    if (response && response['status-code'] === 202) {
      return response.change
    }

    return Promise.reject(new Error('malformed response'))
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async install ({ name, auth, ...opts }) {
    return this.modify({ action: 'install', name, auth, ...opts })
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async remove ({ name, auth, ...opts }) {
    return this.modify({ action: 'remove', name, auth, ...opts })
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async switch ({ name, auth, ...opts }) {
    return this.modify({ action: 'switch', name, auth, ...opts })
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async refresh ({ name, auth, ...opts }) {
    return this.modify({ action: 'refresh', name, auth, ...opts })
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async revert ({ name, auth, ...opts }) {
    return this.modify({ action: 'revert', name, auth, ...opts })
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async enable ({ name, auth, ...opts }) {
    return this.modify({ action: 'enable', name, auth, ...opts })
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async disable ({ name, auth, ...opts }) {
    return this.modify({ action: 'disable', name, auth, ...opts })
  }

  /**
   * check on status of change by id (or all changes without id arg)
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.id
   */
  async status ({ id }) {
    const response = await this.rest({
      method: 'GET',
      path: id ? `/v2/changes/${id}` : '/v2/changes'
    })

    if (response && response['status-code'] === 200) {
      return response.result
    }

    return Promise.reject(new Error('malformed response'))
  }

  /**
   * abort ongoing change by id
   * 
   * @method
   * @param {object}  options

   * @param {string}  options.id
   * @param {object}  options.auth
   */
  async abort ({ id, auth }) {

    if (typeof id !== 'string') {
      return Promise.reject(new Error('malformed id argument'))
    }

    const response = await this.rest({
      auth: auth || await this.readAuth(),
      method: 'POST',
      path: `/v2/changes/${id}`,
      data: JSON.stringify({ action: 'abort' })
    })

    if (response && response['status-code'] === 200) {
      return response.result
    }

    return Promise.reject(new Error('malformed response'))
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {object}  options.auth
   */
  async listInterfaces ({ auth }={}) {
    const response = await this.rest({
      auth: auth || await this.readAuth(),
      method: 'GET',
      path: '/v2/interfaces'
    })

    if (response && response['status-code'] === 200) {
      return response.result
    }

    return Promise.reject(new Error('malformed response'))
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.action
   * @param {object}  options.slot
   * @param {object}  options.plug
   * @param {object}  options.auth
   */
  async modifyInterface ({ action, slot, plug, auth }) {

    const data = {
      action: action,
      slots: [{ snap: slot.snap, slot: slot.slot }],
      plugs: [{ snap: plug.snap, plug: plug.plug }]
    }

    const response = await this.rest({
      auth: auth || await this.readAuth(),
      method: 'POST',
      path: '/v2/interfaces',
      data: JSON.stringify(data)
    })

    if (response && response['status-code'] === 202) {
      return response.change
    }

    return Promise.reject(new Error('malformed response'))
  }


  /**
   * 
   * @method
   * @param {object}  options
   * @param {object}  options.slot
   * @param {object}  options.plug
   * @param {object}  options.auth
   */
  async connect ({ slot, plug, auth }) {
    return this.modifyInterface({ action: 'connect', slot, plug, auth })
  }

  /**
   * 
   * @method
   * @param {object}  options
   * @param {string}  options.name
   * @param {object}  options.auth
   * @param {object}  options.opts
   */
  async disconnect ({ slot, plug, auth }) {
    return this.modifyInterface({ action: 'disconnect', slot, plug, auth })
  }

}

module.exports = SnapClient
