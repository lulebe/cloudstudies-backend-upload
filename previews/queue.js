const generatePreviewForFile = require('./generatePreviewForFile')

const enqueuedFiles = []
let currentlyWorking = false

function startWork () {
  if (enqueuedFiles.length == 0) {
    currentlyWorking = false
    return
  }
  currentlyWorking = true
  const currentFile = enqueuedFiles.shift()
  generatePreviewForFile(currentFile)
  .then(startWork)
  .catch(console.log)
}

module.exports = {
  addFile (dbFile) {
    enqueuedFiles.push(dbFile)
    if (!currentlyWorking)
      startWork()
  }
}