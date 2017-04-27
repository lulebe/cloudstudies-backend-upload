const Promise = require('bluebird')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const joinPath = require('path').join
const crypto = require('crypto')
const through = require('through2')

module.exports = (req, res) => {
  Promise.fromNode(cb => jwt.verify(req.params.jwt, process.env.JWTFILES, cb))
  .then(data => {
    const cipherKey = data.auth
    const decipher = crypto.createDecipher('aes-256-gcm', cipherKey)
    const file = fs.createReadStream(joinPath(process.env.UPLOAD_PATH, data.id.toString()))
    let position = 0
    res.set('Content-Type', 'application/octet-stream')
    const reject = () => {
      res.status(500).send('decryption error')
    }
    file.on('error', reject)
    .pipe(decipher).on('error', reject)
    .pipe(through(function (chunk, enc, cb) {
      if (position >= 512)
        this.push(chunk)
      else if (position + chunk.length >= 512)
        this.push(chunk.slice(512-position))
      position += chunk.length
      cb()
    })).on('error', reject)
    .pipe(res)
  })
  .catch(e => {
    if (e.httpstatus)
      res.status(e.httpstatus).send(e.message)
    else if (e.expiredAt)
      res.status(401).send(e.message)
    else
      res.status(500).send(e.message)
  })
}