const fs = require('fs')
const matroskaSubtitles = require('..')

var parser = matroskaSubtitles()

parser.once('tracks', function (tracks) {
  console.log(tracks)

  // filestream.unpipe(parser)
  // parser.end()

  // copy track metainfo to a new parser
  parser = matroskaSubtitles(parser)

  parser.on('subtitle', function (subtitle, trackNumber) {
    console.log('track ' + trackNumber + ':', subtitle)
  })

  // create a new stream and read from a specific position
  fs.createReadStream(null, { fd: filestream.fd, start: 29737907 }).pipe(parser)
})

// create a stream starting from the beginning of the file
var filestream = fs.createReadStream(process.argv[2])

filestream.pipe(parser)
