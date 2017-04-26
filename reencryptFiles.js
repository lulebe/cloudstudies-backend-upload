const Promise = require('bluebird')
const fs = require('fs')
const joinPath = require('path').join
const crypto = require('crypto')
const randomString = require('randomstring').generate

module.exports = (req, res) => {
  if (!req.body.files) return res.status(400).send('No files provided')
  reencrypt(req.body.files, err => {
    if (err)
      res.status(500).send(err.message)
    else
      res.status(200).send()
  })
}

function reencrypt (files, cb) {
  if (files.length == 0) {
    cb(null)
    return
  }
  const fileId = files[0].id
  const oldKey = files[0].oldKey
  const newKey = files[0].newKey
  const oldPath = joinPath(process.env.UPLOAD_PATH, fileId)
  const newPath = joinPath(process.env.UPLOAD_PATH, ''+fileId+randomString(4))
  const oldFile = fs.createReadStream(oldPath)
  const newFile = fs.createWriteStream(newPath)
  const decipher = crypto.createDecipher('aes-256-gcm', oldKey)
  const cipher = crypto.createCipher('aes-256-gcm', newKey)
  const reject = () => {} // just keep going
  oldFile.on('error', reject)
  .pipe(decipher).on('error', reject)
  .pipe(cipher).on('error', reject)
  .pipe(newFile).on('error', reject)
  .on('finish', () => {
    fs.rename(newPath, oldPath, err => { //ignore errors
      files.splice(0,1)
      reencrypt(files, cb)
    })
  })
}