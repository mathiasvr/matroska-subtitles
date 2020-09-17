const fs = require('fs')
const devnull = require('dev-null')
const { SubtitleStream } = require('..')

// SubtitleStream acts as middleware for intercepting subtitles in existing mkv streams,
// and implements seeking support by logging seek and cue positions
const subtitleStream = new SubtitleStream()

subtitleStream.once('tracks', function (tracks) {
  console.log(tracks)
})

subtitleStream.on('cues', function () {
  const offset = 25882901

  // .seekTo closes the old subtitle stream and opens a new at a given offset
  subtitleStream = subtitleStream.seekTo(offset)

  subtitleStream.on('subtitle', function (subtitle, trackNumber) {
    console.log('track ' + trackNumber + ':', subtitle)
  })

  // create a new stream and read from a specific position
  fs.createReadStream(null, { fd: filestream.fd, start: offset }).pipe(subtitleStream).pipe(devnull())
})

// create a stream starting from the beginning of the file
const filestream = fs.createReadStream(process.argv[2])

// initial subtitle stream instance should start at stream offset 0
filestream.pipe(subtitleStream).pipe(devnull())
