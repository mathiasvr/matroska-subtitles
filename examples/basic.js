const fs = require('fs')
const MatroskaSubtitles = require('..')

var parser = new MatroskaSubtitles()

// first an array of subtitle track information is emitted
parser.once('tracks', function (tracks) {
  console.log(tracks)
})

// afterwards each subtitle is emitted
parser.on('subtitle', function (subtitle, trackNumber) {
  console.log('Track ' + trackNumber + ':', subtitle)
})

fs.createReadStream(process.argv[2]).pipe(parser)
