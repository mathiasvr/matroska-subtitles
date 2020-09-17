const fs = require('fs')
const { SubtitleParser } = require('..')

const tracks = new Map()
const parser = new SubtitleParser()

parser.once('tracks', function (subtitleTracks) {
  subtitleTracks.forEach(function (track) {
    tracks.set(track.number, {
      language: track.language,
      subtitles: []
    })
  })

  parser.on('subtitle', function (subtitle, trackNumber) {
    tracks.get(trackNumber).subtitles.push(subtitle)
  })
})

parser.on('finish', function () {
  tracks.forEach((track) => console.log(track))
})

fs.createReadStream(process.argv[2]).pipe(parser)
