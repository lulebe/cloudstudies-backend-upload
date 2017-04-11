const Promise = require('bluebird')
const axios = require('axios')
const fs = require('fs')
const joinPath = require('path').join
const crypto = require('crypto')
const bufToStream = require('streamifier').createReadStream
const multistream = require('multistream')
const multiparty = require('multiparty')

module.exports = (req, res) => {
  if (!req.headers['x-store-auth'])
    return res.status(400).send()
  let formEnded = false
  let openParts = 0
  const form = new multiparty.Form()
  form.on('part', part => {
    console.log(part.name, part.filename)
    if (part.filename) {
      openParts++
      handleFile(req, part)
      .then(() => {
        console.log(openParts)
        if (--openParts <= 0 && formEnded)
          res.status(201).send()
      })
    }
  })
  form.on('error', err => {
    console.log('err', err)
    res.status(500).end()
  })
  form.on('close', () => {
    console.log('close')
    formEnded = true
    if (openParts == 0)
      res.status(201).send()
  })
  form.parse(req)
}

function handleFile (req, part) {
  let dbFile
  return axios({
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
  //4 pipe into gzip
  //5 pipe into file
  .then(ares => {
    dbFile = ares.data
    return Promise.fromNode(cb => crypto.randomBytes(512, cb))
  })
  .then(buf => {
    const startpad = bufToStream(buf)
    const cipherKey = crypto.createHash('sha256').update(req.headers['x-store-auth']+dbFile.salt).digest('base64')
    const cipher = crypto.createCipher('aes-256-cbc', cipherKey)
    const file = fs.createWriteStream(joinPath(process.env.UPLOAD_PATH, dbFile.id.toString()))
    return new Promise((resolve, reject) => {
      multistream([startpad, part]).pipe(cipher).pipe(file).on('finish', () => {
        console.log('finish')
        resolve()
      })
    })
  })
  .catch(e => {
    console.log(e)
    return Promise.resolve()
  })
}