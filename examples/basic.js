const fs = require('fs')
const MatroskaSubtitles = require('..')

var subtitles = MatroskaSubtitles()

// first an array of subtitle track information is be emitted
subtitles.once('tracks', function (tracks) {
  console.log(tracks)
})

// afterwards the subtitles are emitted
subtitles.on('subtitle', function (subtitle, trackNumber) {
//  console.log('Track ' + trackNumber + ':', subtitle)
})

fs.createReadStream(process.argv[2]).pipe(subtitles)
