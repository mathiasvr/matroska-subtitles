const fs = require('fs')
const matroskaSubtitles = require('..')

var tracks = new Map()
var subs = matroskaSubtitles()

// first an array of subtitle track information will be emitted
subs.once('data', function (subtitleTracks) {
  subtitleTracks.forEach(function (track) {
    tracks.set(track.number, {
      language: track.language,
      subtitles: []
    })
  })
  
  // following objects are subtitles
  subs.on('data', function (obj) {
    var key = obj[0]
    var subtitle = obj[1]
    tracks.get(key).subtitles.push(subtitle)
  })
})

subs.on('end', function () {
  tracks.forEach((track) => console.log(track))
})

fs.createReadStream(process.argv[2]).pipe(subs)
