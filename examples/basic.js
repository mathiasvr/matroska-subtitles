const fs = require('fs')
const MatroskaSubtitles = require('..')

var parser = new MatroskaSubtitles()

// first an array of subtitle track information is be emitted
parser.once('tracks', function (tracks) {
  console.log(tracks)
})

// afterwards the subtitles are emitted
parser.on('subtitle', function (subtitle, trackNumber) {
  console.log('Track ' + trackNumber + ':', subtitle)
})

fs.createReadStream(process.argv[2]).pipe(parser)
