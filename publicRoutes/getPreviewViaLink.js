const Promise = require('bluebird')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const joinPath = require('path').join
const crypto = require('crypto')
const through = require('through2')

const getMimeTypeForExtension = require('../previews/mimetypes')

module.exports = (req, res) => {
  Promise.fromNode(cb => jwt.verify(req.params.jwt, process.env.JWTFILES, cb))
  .then(data => {
    const decipher = crypto.createDecipher('aes-128-cbc', Buffer.from(data.auth, 'base64'))
    const previewFilePath = joinPath(process.env.UPLOAD_PATH, 'previews', data.id.toString(), req.params.previewNum)
    fs.access(previewFilePath, fs.constants.R_OK, (err) => {
      if (err)
        return res.status(404).send()
      const file = fs.createReadStream(previewFilePath)
      let position = 0
      let mimetype = getMimeTypeForExtension(req.params.filename.split('.').pop())
      res.set('Content-Type', mimetype)
      const reject = e => {
        console.log(e)
      }
      file.on('error', reject)
      .pipe(decipher).on('error', reject)
      .pipe(res)
    })
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
