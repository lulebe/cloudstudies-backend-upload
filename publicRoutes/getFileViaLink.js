const Promise = require('bluebird')
const jwt = require('jsonwebtoken')
const mime = require('mime')
const fs = require('fs')
const joinPath = require('path').join
const crypto = require('crypto')
const through = require('through2')

module.exports = (req, res) => {
  Promise.fromNode(cb => jwt.verify(req.params.jwt, process.env.JWTFILES, cb))
  .then(data => {
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(data.auth, 'base64'), Buffer.from(data.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(data.authTag, 'base64'))
    const file = fs.createReadStream(joinPath(process.env.UPLOAD_PATH, data.id.toString()))
    let position = 0
    const mimetype = mime.getType(req.params.filename.split('.').pop()) || 'application/octet-stream'
    res.set('Content-Type', mimetype)
    res.set('Content-Length', data.size-512)
    const reject = e => {
      console.log(e)
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
