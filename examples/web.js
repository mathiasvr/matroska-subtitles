const http = require('http')
const { SubtitleParser } = require('..')
const parser = new SubtitleParser()

// first an array of subtitle track information is emitted
parser.once('tracks', (tracks) => console.log(tracks))

// afterwards each subtitle is emitted
parser.on('subtitle', (subtitle, trackNumber) =>
  console.log('Track ' + trackNumber + ':', subtitle))

const url = '../tests/matroska-test-files/test_files/test5.mkv'
http.get(url, (res) => res.pipe(parser))
