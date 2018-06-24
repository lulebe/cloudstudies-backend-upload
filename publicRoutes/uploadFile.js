const Promise = require('bluebird')
const axios = require('axios')
const fs = require('fs')
const joinPath = require('path').join
const crypto = require('crypto')
const bufToStream = require('streamifier').createReadStream
const multistream = require('combined-stream2')
const multiparty = require('multiparty')
const through = require('through2')

const AppError = require('../error')
const previewQueue = require('../previews/queue')

module.exports = (req, res) => {
  if (!req.headers['x-store-auth'])
    return res.status(400).send()
  const form = new multiparty.Form()
  form.on('part', part => {
    if (part.filename) {
      handleFile(req, part)
      .catch(e => {
        console.log('error', e)
        if (!res.headersSent) {
          res.set('Connection', 'close')
          if (e.httpstatus)
            res.status(e.httpstatus).end(e.message)
          else
            res.status(500).end(e.message)
        }
      })
    }
  })
  form.on('error', e => {
    console.log('error', e)
    if (!res.headersSent) {
      res.set('Connection', 'close')
      if (e.httpstatus)
        res.status(e.httpstatus).end(e.message)
      else
        res.status(500).end(e.message)
    }
  })
  form.on('close', () => {
    res.status(201).send()
  })
  form.parse(req)
}

function handleFile (req, part) {
  let dbFile
  return new Promise((resolve, reject) => {
    part.on('error', reject)
    axios({
      method: 'POST',
      url: process.env.API_URL + '/internal/fileadd/'+req.params.folderId,
      headers: {Authorization: 'i '+process.env.INTERNAL_AUTH_KEY},
      data: {
        userAuthentication: req.headers.authorization || null,
        storeAuthentication: req.headers['x-store-auth'],
        fileName: part.filename
      }
    })
    //1 create start padding stream and file, gzip and cipher
    //2 use multistream to combine start+data
    //3 pipe into encryption
    //4 pipe into file
    .then(ares => {
      dbFile = ares.data
      return Promise.fromNode(cb => crypto.randomBytes(512, cb))
    })
    .then(buf => {
      const startpad = bufToStream(buf)
      const cipherKey = dbFile.key
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(cipherKey, 'base64'), Buffer.from(dbFile.iv, 'base64'))
      const file = fs.createWriteStream(joinPath(process.env.UPLOAD_PATH, dbFile.id.toString()))
      startpad.on('error', reject)
      const inputStream = multistream.create()
      inputStream.append(startpad)
      inputStream.append(part)
      let currentSize = 0
      inputStream.on('error', reject)
      .pipe(cipher).on('error', reject)
      .pipe(through(function (chunk, enc, cb) {
        currentSize += chunk.length
        if (currentSize >= dbFile.maxSize)
          cb(new AppError(413, 'file too big'))
        else
          cb(null, chunk)
      })).on('error', reject)
      .pipe(file).on('error', reject)
      .on('finish', () => {
        const fileAuthTag = cipher.getAuthTag().toString('base64')
        axios({
          method: 'POST',
          url: process.env.API_URL + '/internal/fileuploaded/'+dbFile.id,
          headers: {Authorization: 'i '+process.env.INTERNAL_AUTH_KEY},
          data: {
            authTag: fileAuthTag,
            fileSize: currentSize
          }
        })
        .catch(e => {console.log(e)})
        if (fileSize <= process.env.MAX_SIZE_TO_PREVIEW)
          previewQueue.addFile({
            id: dbFile.id,
            key: dbFile.key,
            authTag: fileAuthTag,
            iv: dbFile.iv,
            name: dbFile.name
          })
        resolve()
      })
    })
    .catch(reject)
  })
  .catch(e => {
    if (dbFile) { //handle file deletion
      const path = joinPath(process.env.UPLOAD_PATH, dbFile.id.toString())
      Promise.fromNode(cb => fs.unlink(path, cb))
      .then(() => deleteFileFromDB(dbFile.id))
      .catch(e => deleteFileFromDB(dbFile.id))
    }
    if (e.response) {
      return Promise.reject(new AppError(e.response.status, e.response.data))
    }
    return Promise.reject(e)
  })
}

function deleteFileFromDB (fileId) {
  axios({
    method: 'DELETE',
    url: process.env.API_URL + '/internal/filedelete/'+fileId,
    headers: {Authorization: 'i '+process.env.INTERNAL_AUTH_KEY}
  })
  .catch(e => {})
}
