const imageExtensions = ['jpg', 'tif', 'tiff', 'png']

module.exports = function (extension) {
  if (imageExtensions.indexOf(extension.toLowerCase()) > -1)
    return 'image/jpeg'
  if (extension.toLowerCase() == 'pdf')
    return 'image/jpeg'
  return 'application/octet-stream'
}