const Promise = require('bluebird')
const axios = require('axios')
const fs = require('fs')
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
    const cipherKey = dbFile.key
    const decipher = crypto.createDecipher('aes-256-gcm', cipherKey)
    const file = fs.createReadStream(joinPath(process.env.UPLOAD_PATH, dbFile.id.toString()))
    let position = 0
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
    console.log(e)
    res.status(500).send('an error occurred')
  })
}