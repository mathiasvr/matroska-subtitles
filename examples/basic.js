const fs = require('fs')
const { SubtitleParser } = require('..')

var parser = new SubtitleParser()

// first an array of subtitle track information is emitted
parser.once('tracks', function (tracks) {
  console.log(tracks)
})

// afterwards each subtitle is emitted
parser.on('subtitle', function (subtitle, trackNumber) {
  console.log('Track ' + trackNumber + ':', subtitle)
})

fs.createReadStream(process.argv[2]).pipe(parser)
