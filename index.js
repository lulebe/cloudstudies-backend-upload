const express = require('express')
const bodyParser = require('body-parser')

const mw = require('./middleware')
const uploadFile = require('./publicRoutes/uploadFile')
const getFile = require('./publicRoutes/getFile')
const getFileViaLink = require('./publicRoutes/getFileViaLink')
const deleteFiles = require('./internalRoutes/deleteFiles')
const reencryptFiles = require('./internalRoutes/reencryptFiles')

const app = express()

//app.use(mw.slowdown)
app.use(mw.allowCORS)

//public
app.post('/folder/:folderId', uploadFile)
app.get('/file/:jwt/:filename', getFileViaLink)
app.get('/file/:fileId', getFile)

//internal
app.post('/internal/files/reencrypt', [bodyParser.json(), mw.internalAuth], reencryptFiles)
app.post('/internal/files/delete', [bodyParser.json(), mw.internalAuth], deleteFiles)

app.listen(process.env.PORT, () => {
  console.log('Listening on ' + process.env.PORT)
})
