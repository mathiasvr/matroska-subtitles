const fs = require('fs')
const devnull = require('dev-null')
const { SubtitleSeekStream } = require('..')

// SubtitleStream intercepts subtitles in an mkv stream and implements seeking support
let subtitleStream = new SubtitleSeekStream()

subtitleStream.once('tracks', (tracks) => {
  console.log(tracks)
})

subtitleStream.once('cues', () => {
  const offset = 25882901

  // close the old subtitle stream and open a new to parse at a different stream offset
  subtitleStream = subtitleStream.seekTo(offset)

  subtitleStream.on('subtitle', (subtitle, trackNumber) =>
    console.log('track ' + trackNumber + ':', subtitle))

  // create a new stream and read from a specific position
  fs.createReadStream(null, { fd: filestream.fd, start: offset }).pipe(subtitleStream).pipe(devnull())
})

// create a stream starting from the beginning of the file
const filestream = fs.createReadStream(process.argv[2])

// initial subtitle stream instance should start at stream offset 0
filestream.pipe(subtitleStream).pipe(devnull())
