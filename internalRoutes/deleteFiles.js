const Promise = require('bluebird')
const fs = require('fs')
const joinPath = require('path').join
const rimraf = require('rimraf')

module.exports = (req, res) => {
  if (!req.body.files)
    return res.status(400).send('no files list provided')
  deleteFiles(req.body.files, () => {
    res.status(204).send()
  })
}

function deleteFiles (files, cb) {
  if (files.length == 0) {
    cb()
    return
  }
  fs.unlink(joinPath(process.env.UPLOAD_PATH, files[0].toString()), err => { //ignore errors
    rimraf(joinPath(process.env.UPLOAD_PATH, 'previews', files[0].toString()), {disableGlob: true}, err => {
      files.splice(0,1)
      deleteFiles(files, cb)
    })
  })
}
