const ebml = require('ebml')
const ebmlBlock = require('ebml-block')
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
      // 0x11: Subtitle Track, S_TEXT/UTF8: SRT format
      if (currentTrack.TrackType === 0x11) {
        //if (['S_TEXT/UTF8'].includes(currentTrack.CodecID)) {
        if (currentTrack.CodecID === 'S_TEXT/UTF8' || currentTrack.CodecID === 'S_TEXT/ASS') {
          stream.push(['new', {
            track: currentTrack.TrackNumber,
            language: currentTrack.Language,
            type: currentTrack.CodecID.substring(7),
            header: currentTrack.CodecPrivate ? currentTrack.CodecPrivate.toString('utf8') : null // TODO: only ssa/ass
          }])
          subtitleTracks.set(currentTrack.TrackNumber, true)
        } /*else if (currentTrack.CodecID === 'S_TEXT/ASS') {
          console.log(currentTrack.CodecID)
        }*/
      }
      currentTrack = null
    }

    if (currentTrack && chunk[0] === 'tag') {
      // save info about track currently being scanned
      if (['TrackNumber', 'TrackType', 'Language', 'CodecID', 'CodecPrivate'].includes(chunk[1].name)) {
        currentTrack[chunk[1].name] = readData(chunk)
      }
    }

    // Blocks //

    if (chunk[1].name === 'Block') {
      var block = ebmlBlock(chunk[1].data)

      if (subtitleTracks.has(block.trackNumber)) {
        // TODO: would a subtitle track ever use lacing? We just take the first frame.
        currentSubtitleBlock = [ block.trackNumber, {
          text: block.frames[0].toString('utf8'),
          time: (block.timecode + currentClusterTimecode) * timecodeScale
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
    case 'b': return chunk[1].data
    case 's': return chunk[1].data.toString('ascii')
    case '8': return chunk[1].data.toString('utf8')
    case 'u': return chunk[1].data.readUIntBE(0, chunk[1].dataSize)
    default: console.error('Unsupported data:', chunk)
  }
}
