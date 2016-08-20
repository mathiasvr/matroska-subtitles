const fs = require('fs')
const MatroskaSubtitles = require('..')

var parser = new MatroskaSubtitles()

parser.once('tracks', function (tracks) {
  console.log(tracks)

  // copy track metainfo to a new parser
  parser = new MatroskaSubtitles(parser)

  parser.on('subtitle', function (subtitle, trackNumber) {
    console.log('track ' + trackNumber + ':', subtitle)
  })

  // create a new stream and read from a specific position
  fs.createReadStream(null, { fd: filestream.fd, start: 29737907 }).pipe(parser)
})

// create a stream starting from the beginning of the file
var filestream = fs.createReadStream(process.argv[2])

filestream.pipe(parser)
