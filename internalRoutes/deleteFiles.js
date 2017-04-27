const Promise = require('bluebird')
const fs = require('fs')
const joinPath = require('path').join

module.exports = (req, res) => {
  if (!req.body.files)
    return res.status(400).send('no files list provided')
  Promise.fromNode(cb => deleteFiles(req.body.files, cb))
  .then(() => {
    res.status(204).send()
  })
  .catch(e => {
    res.status(500).send('an error occurred')
  })
}

function deleteFiles (files, cb) {
  if (files.length == 0) {
    cb(null)
    return
  }
  fs.unlink(joinPath(process.env.UPLOAD_PATH, files[0]), err => { //ignore errors
    files.splice(0,1)
    deleteFiles(files, cb)
  })
}