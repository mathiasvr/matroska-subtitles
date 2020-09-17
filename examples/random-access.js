const fs = require('fs')
const devnull = require('dev-null')
const { SeekableSubtitleParser } = require('..')

var parser = new SeekableSubtitleParser()

parser.once('tracks', function (tracks) {
  console.log(tracks)
})

parser.on('cues', function () {
  const z = 25882901

  // copy track metainfo to a new parser
  parser = parser.seekTo(z)

  parser.on('subtitle', function (subtitle, trackNumber) {
    console.log('track ' + trackNumber + ':', subtitle)
  })

  // create a new stream and read from a specific position
  fs.createReadStream(null, { fd: filestream.fd, start: z }).pipe(parser).pipe(devnull())
})

// create a stream starting from the beginning of the file
var filestream = fs.createReadStream(process.argv[2])

filestream.pipe(parser).pipe(devnull())
