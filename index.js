const express = require('express')

const mw = require('./middleware')
const uploadFile = require('./uploadFile')
const getFile = require('./getFile')
const deleteFile = require('./deleteFile')

const app = express()

//app.use(mw.slowdown)
app.use(mw.allowCORS)

app.post('/folder/:folderId', uploadFile)
app.get('/file/:fileId', getFile)
app.delete('/file/:fileId', deleteFile)

app.listen(process.env.PORT, () => {
  console.log('Listening on ' + process.env.PORT)
})
