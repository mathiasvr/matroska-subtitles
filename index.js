const ebml = require('ebml')
const through = require('through2')

module.exports = function () {
  const subtitleTracks = new Map()
  const decoder = new ebml.Decoder()

  var timecodeScale = 1

  var currentTrack
  var currentSubtitleBlock
  var currentClusterTimecode

  decoder.on('data', function (chunk) {
    // Segment Information //

    if (chunk[1].name === 'TimecodeScale') {
      timecodeScale = readData(chunk) / 1000000
    }

    // Clusters //

    // TODO: assuming this is a Cluster `Timecode`
    if (chunk[1].name === 'Timecode') {
      currentClusterTimecode = readData(chunk)
    }

    // Tracks //

    if (chunk[0] === 'start' && chunk[1].name === 'TrackEntry') {
      currentTrack = {}
    }

    if (chunk[0] === 'end' && chunk[1].name === 'TrackEntry') {
      // TODO: would a subtitle track ever use lacing?
      // 0x11: Subtitle Track, S_TEXT/UTF8: SRT format
      if (currentTrack.TrackType === 0x11 && currentTrack.CodecID === 'S_TEXT/UTF8' && !currentTrack.FlagLacing) {
        stream.push(['new', {
          track: currentTrack.TrackNumber,
          language: currentTrack.Language
        }])
        subtitleTracks.set(currentTrack.TrackNumber, true)
      }
      currentTrack = null
    }

    if (currentTrack && chunk[0] === 'tag') {
      // save info about track currently being scanned
      if (['TrackNumber', 'TrackType', 'Language', 'CodecID', 'FlagLacing'].includes(chunk[1].name)) {
        currentTrack[chunk[1].name] = readData(chunk)
      }
    }

    // Blocks //

    if (chunk[1].name === 'Block') {
      var data = chunk[1].data
      var v = ebml.tools.readVint(data)

      var trackNumber = v.value

      if (subtitleTracks.has(trackNumber)) {
        var offset = v.length
        var timecode = data.readInt16BE(offset)

        // assume that block uses no lacing (respects the Track FlagLacing element)
        offset += 3

        currentSubtitleBlock = [ trackNumber, {
          text: data.toString('utf8', offset),
          time: (timecode + currentClusterTimecode) * timecodeScale
        } ]
      }
    }

    // TODO: assuming `BlockDuration` exists and always comes after `Block`
    if (currentSubtitleBlock && chunk[1].name === 'BlockDuration') {
      currentSubtitleBlock[1].duration = readData(chunk) * timecodeScale

      stream.push(currentSubtitleBlock)
    }
  })

  // create object stream
  var stream = through.obj(function write (chunk, _, callback) {
    decoder.write(chunk)
    callback()
  })

  return stream
}

function readData (chunk) {
  switch (chunk[1].type) {
    case 's': return chunk[1].data.toString('ascii')
    case '8': return chunk[1].data.toString('utf8')
    case 'u': return chunk[1].data.readUIntBE(0, chunk[1].dataSize)
    default : console.error('Unsupported data:', chunk)
  }
}
