const Promise = require('bluebird')
const axios = require('axios')
const fs = require('fs')
const joinPath = require('path').join

module.exports = (req, res) => {
  if (!req.headers['x-store-auth'])
    return res.status(400).send()
  const path = joinPath(process.env.UPLOAD_PATH, req.params.fileId)
  Promise.fromNode(cb => fs.stat(path, cb))
  .then(fileStats => {
    return axios({
      method: 'POST',
      url: process.env.API_URL + '/internal/filedelete/'+req.params.fileId,
      headers: {Authorization: 'i '+process.env.INTERNAL_AUTH_KEY},
      data: {
        userAuthentication: req.headers.authorization || null,
        storeAuthentication: req.headers['x-store-auth'],
        fileSize: fileStats.size
      }
    })
  })
  .then(ares => {
    return Promise.fromNode(cb => fs.unlink(path, cb))
  })
  .then(() => {
    res.status(204).send()
  })
  .catch(e => {
    res.status(500).send('an error occurred')
  })
}