const fs = require('fs')
const joinPath = require('path').join
const crypto = require('crypto')
const through = require('through2')
const exec = require('child_process').exec
const prom = require('util').promisify
const rimraf = prom(require('rimraf'))
const unlink = prom(fs.unlink)
const mkdir = prom(fs.mkdir)
const readdir = prom(fs.readdir)
const axios = require('axios')


const imageExtensions = ['jpg', 'tif', 'tiff', 'png']
const pdfExtensions = ['pdf']
const allExtensions = imageExtensions.concat(pdfExtensions)//.cancat()


module.exports = function (dbFile) {
  const fileName = dbFile.name
  const fileExtension = fileName.split('.').pop().toLowerCase()
  let paths = null
  if (allExtensions.indexOf(fileExtension) > -1)
    return decryptFile(dbFile, fileExtension)
    .then(p => {
      paths = p
      if (imageExtensions.indexOf(fileExtension) > -1)
        return processImage(dbFile, paths)
      if (pdfExtensions.indexOf(fileExtension) > -1)
        return processPdf(dbFile, paths)
    })
    .then(() => {
      return encryptOutputsAndDeleteTmpFiles(dbFile, paths)
    })
    .then(fileCount => {
      axios({
        method: 'POST',
        url: process.env.API_URL + '/internal/previewsgenerated/'+dbFile.id,
        headers: {Authorization: 'i '+process.env.INTERNAL_AUTH_KEY},
        data: {
          previewFileCount: fileCount
        }
      })
    })
    .catch(e => {
      console.log(e)
    })
  return Promise.resolve()
}

function decryptFile (dbFile, extension) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(dbFile.key, 'base64'), Buffer.from(dbFile.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(dbFile.authTag, 'base64'))
  const file = fs.createReadStream(joinPath(process.env.UPLOAD_PATH, dbFile.id.toString()))
  const tmpOutputPath = joinPath(process.env.UPLOAD_PATH, 'previews', 'tmp', dbFile.id.toString()) + '.' + extension
  const tmpOutputFile = fs.createWriteStream(tmpOutputPath)
  let position = 0
  return new Promise((resolve, reject) => {
    file.on('error', reject)
    .pipe(decipher).on('error', reject)
    .pipe(through(function (chunk, enc, cb) {
      if (position >= 512)
        this.push(chunk)
      else if (position + chunk.length >= 512)
        this.push(chunk.slice(512-position))
      position += chunk.length
      cb()
    })).on('error', reject)
    .pipe(tmpOutputFile).on('error', reject)
    .on('finish', () => {
      const tmpOutputResultPath = joinPath(process.env.UPLOAD_PATH, 'previews', 'tmp', dbFile.id.toString()) + '_out'
      fs.mkdir(tmpOutputResultPath, err => {
        if (err)
          reject(err)
        else
          resolve({filePath: tmpOutputPath, outFolder: tmpOutputResultPath})
      })
    })
  })
}

function encryptOutputsAndDeleteTmpFiles (dbFile, paths) {
  const finalOutputPath = joinPath(process.env.UPLOAD_PATH, 'previews', dbFile.id.toString())
  let fileCount = 0
  //1. create final output folder
  return mkdir(finalOutputPath)
  //2. read files list
  .then(() => {
    return readdir(paths.outFolder)
  })
  //3. encrypt and copy files to final location
  .then(f => {
    const files = f.sort((a, b) => parseInt(a.split(".").shift()) > parseInt(b.split(".").shift()))
    fileCount = files.length
    return encryptFiles(dbFile, files, paths.outFolder, finalOutputPath, 0)
  })
  //4. delete tmp files & folders
  .then(() => {
    return rimraf(paths.outFolder, {disableGlob: true})
  })
  .then(() => {
    return unlink(paths.filePath)
  })
  //5. return file count
  .then(() => {
    return Promise.resolve(fileCount)
  })
}

function encryptFiles (dbFile, files, folder, outFolder, index) {
  const currentInPath = joinPath(folder, files[index])
  const currentOutPath = joinPath(outFolder, index.toString())
  return encryptFile(dbFile, currentInPath, currentOutPath)
  .then(() => {
    const nextIndex = index + 1
    if (nextIndex < files.length)
      return encryptFiles(dbFile, files, folder, outFolder, nextIndex)
    return Promise.resolve(files.length)
  })
}

function encryptFile(dbFile, inPath, outPath) {
  return new Promise((resolve, reject) => {
    const cipher = crypto.createCipher('aes-128-cbc', Buffer.from(dbFile.key, 'base64'))
    const inFile = fs.createReadStream(inPath)
    const outFile = fs.createWriteStream(outPath)
    inFile.on('error', reject)
    .pipe(cipher).on('error', reject)
    .pipe(outFile).on('error', reject)
    .on('finish', () => {
      resolve()
    })
  })
}

function processImage (dbFile, paths) {
  return new Promise((resolve, reject) => {
    //1. call convert on input file
    exec(
      'convert -resize "640x640>" -quality 60 "'
      + paths.filePath
      + '" "'
      + joinPath(paths.outFolder, '0.jpg')
      + '"',
      (err, stdout, stderr) => {
        if (err)
          reject(err)
        else
          resolve()
      }
    )
  })
}

function processPdf (dbFile, paths) {
  return new Promise((resolve, reject) => {
    exec(
      "pdfinfo " + paths.filePath + " | grep Pages | awk '{print $2}'",
      (err, stdout, stderr) => {
        let pageCount = 0
        try {
          pageCount = parseInt(stdout.trim())
        } catch(e) {
          return reject(e)
        }
        processPdfPage(dbFile, paths, 0, pageCount)
        .then(resolve)
        .catch(reject)
      }
    )
  })
}

function processPdfPage (dbFile, paths, index, pageCount) {
  return new Promise((resolve, reject) => {
    exec(
      'convert -density 400 -background white -alpha flatten -resize 20% -quality 55 "'
      + paths.filePath
      + '"[' + index + '] "'
      + joinPath(paths.outFolder, index + '.jpg')
      + '"',
      (err, stdout, stderr) => {
        if (err)
          reject(err)
        else
          resolve()
      }
    )
  })
  .then(() => {
    const nextIndex = index + 1
    if (nextIndex < pageCount)
      return processPdfPage(dbFile, paths, nextIndex, pageCount)
    return Promise.resolve()
  })
}