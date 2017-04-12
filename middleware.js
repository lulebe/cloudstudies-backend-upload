const slowdown = function (req, res, next) {
  setTimeout(next, 2000)
}

const allowCORS = function(req, res, next) {
  const origin = req.get('origin')
  if ((origin == 'http://localhost:8080' && process.env.NODE_ENV != 'production') || origin == 'https://cloudstudies.de') {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cache-Control,Content-Length,X-Requested-With,x-store-auth,x-user-pw')
  }
  if (req.method == 'OPTIONS')
    res.status(200).end()
  else
    next()
}

module.exports = {slowdown, allowCORS}