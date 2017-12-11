const Promise = require('bluebird')
const axios = require('axios')
const fs = require('fs')
const mime = require('mime')
const joinPath = require('path').join
const crypto = require('crypto')
const through = require('through2')

module.exports = (req, res) => {
  if (!req.headers['x-store-auth'])
    return res.status(400).send()
  axios({
    method: 'POST',
    url: process.env.API_URL + '/internal/fileaccess/'+req.params.fileId,
    headers: {Authorization: 'i '+process.env.INTERNAL_AUTH_KEY},
    data: {
      userAuthentication: req.headers.authorization || null,
      storeAuthentication: req.headers['x-store-auth']
    }
  })
  .then(ares => {
    const dbFile = ares.data
    res.set('Content-Length', dbFile.size-512)
    const mimetype = mime.getType(dbFile.name.split('.').pop()) || 'application/octet-stream'
    res.set('Content-Type', mimetype)
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(dbFile.key, 'base64'), Buffer.from(dbFile.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(dbFile.authTag, 'base64'))
    const file = fs.createReadStream(joinPath(process.env.UPLOAD_PATH, dbFile.id.toString()))
    let position = 0
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
    console.log(e)
    res.status(500).send('an error occurred')
  })
}
