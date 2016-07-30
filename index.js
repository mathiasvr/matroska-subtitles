const ebml = require('ebml')
const ebmlBlock = require('ebml-block')
const through = require('through2')

// track elements we care about
const TRACK_ELEMENTS = ['TrackNumber', 'TrackType', 'Language', 'CodecID', 'CodecPrivate']

const ASS_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text']

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
      // 0x11: Subtitle Track, S_TEXT/UTF8: SRT format
      if (currentTrack.TrackType === 0x11) {
        if (currentTrack.CodecID === 'S_TEXT/UTF8' || currentTrack.CodecID === 'S_TEXT/ASS') {
          subtitleTracks.set(currentTrack.TrackNumber, currentTrack.CodecID)
          var info = {
            track: currentTrack.TrackNumber,
            language: currentTrack.Language,
            type: currentTrack.CodecID.substring(7)
          }
          if (currentTrack.CodecPrivate) {
            // only SSA/ASS
            info.header = currentTrack.CodecPrivate.toString('utf8')
          }
          stream.push(['new', info])
        }
      }
      currentTrack = null
    }

    if (currentTrack && chunk[0] === 'tag') {
      // save info about track currently being scanned
      if (TRACK_ELEMENTS.includes(chunk[1].name)) {
        currentTrack[chunk[1].name] = readData(chunk)
      }
    }

    // Blocks //

    if (chunk[1].name === 'Block') {
      var block = ebmlBlock(chunk[1].data)

      if (subtitleTracks.has(block.trackNumber)) {
        var type = subtitleTracks.get(block.trackNumber)

        // TODO: would a subtitle track ever use lacing? We just take the first (only) frame.
        var subtitle = {
          text: block.frames[0].toString('utf8'),
          time: (block.timecode + currentClusterTimecode) * timecodeScale
        }

        if (type === 'S_TEXT/ASS') {
          var i
          // extract ASS keys
          var values = subtitle.text.split(',')
          // ignore read-order
          for (i = 1; i < 9; i++) {
            subtitle[ASS_KEYS[i]] = values[i]
          }
          // re-append extra text that might have been splitted
          for (i = 9; i < values.length; i++) {
            subtitle.text += ',' + values[i]
          }
        }

        currentSubtitleBlock = [block.trackNumber, subtitle]
      }
    }

    // TODO: assuming `BlockDuration` exists and always comes after `Block`
    if (currentSubtitleBlock && chunk[1].name === 'BlockDuration') {
      currentSubtitleBlock[1].duration = readData(chunk) * timecodeScale

      stream.push(currentSubtitleBlock)

      currentSubtitleBlock = null
    }
  })

  // object stream
  var stream = through.obj(transform, flush)

  function transform (chunk, _, callback) {
    decoder.write(chunk)
    callback()
  }

  function flush (callback) {
    decoder.end()
    callback()
  }

  return stream
}

// TODO: module
function readData (chunk) {
  switch (chunk[1].type) {
    case 'b':
      return chunk[1].data
    case 's':
      return chunk[1].data.toString('ascii')
    case '8':
      return chunk[1].data.toString('utf8')
    case 'u':
      return chunk[1].data.readUIntBE(0, chunk[1].dataSize)
    default:
      console.error('Unsupported data:', chunk)
  }
}
