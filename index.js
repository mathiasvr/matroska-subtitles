const Writable = require('stream').Writable
const ebml = require('ebml')
const ebmlBlock = require('ebml-block')
const readElement = require('./lib/read-element')

// track elements we care about
const TRACK_ELEMENTS = ['TrackNumber', 'TrackType', 'Language', 'CodecID', 'CodecPrivate']
const ASS_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text']

class MatroskaSubtitles extends Writable {
  constructor (prevInstance) {
    super()

    var currentTrack = null
    var currentSubtitleBlock = null
    var currentClusterTimecode = null

    this.decoder = new ebml.Decoder()

    if (prevInstance instanceof MatroskaSubtitles) {
      prevInstance.end()
      this.subtitleTracks = prevInstance.subtitleTracks
      this.timecodeScale = prevInstance.timecodeScale
      this.decoder.on('data', _onClusterData)
    } else {
      this.subtitleTracks = new Map()
      this.timecodeScale = 1
      this.decoder.on('data', _onMetaData)
    }

    var self = this

    function _onMetaData (chunk) {
      // Segment Information
      if (chunk[1].name === 'TimecodeScale') {
        self.timecodeScale = readElement(chunk[1]) / 1000000
      }

      // Tracks
      if (chunk[0] === 'start' && chunk[1].name === 'TrackEntry') {
        currentTrack = {}
      }

      if (currentTrack && chunk[0] === 'tag') {
        // save info about track currently being scanned
        if (TRACK_ELEMENTS.includes(chunk[1].name)) {
          currentTrack[chunk[1].name] = readElement(chunk[1])
        }
      }

      if (chunk[0] === 'end' && chunk[1].name === 'TrackEntry') {
        // 0x11: Subtitle Track, S_TEXT/UTF8: SRT format
        if (currentTrack.TrackType === 0x11) {
          if (currentTrack.CodecID === 'S_TEXT/UTF8' || currentTrack.CodecID === 'S_TEXT/ASS') {
            var track = {
              number: currentTrack.TrackNumber,
              language: currentTrack.Language,
              type: currentTrack.CodecID.substring(7)
            }
            if (currentTrack.CodecPrivate) {
              // only SSA/ASS
              track.header = currentTrack.CodecPrivate.toString('utf8')
            }

            self.subtitleTracks.set(currentTrack.TrackNumber, track)
          }
        }
        currentTrack = null
      }

      if (chunk[0] === 'end' && chunk[1].name === 'Tracks') {
        self.decoder.removeListener('data', _onMetaData)

        if (self.subtitleTracks.size <= 0) return self.end()

        self.decoder.on('data', _onClusterData)
        self.emit('tracks', Array.from(self.subtitleTracks.values()))
      }
    }

    function _onClusterData (chunk) {
      // TODO: assuming this is a Cluster `Timecode`
      if (chunk[1].name === 'Timecode') {
        currentClusterTimecode = readElement(chunk[1])
      }

      if (chunk[1].name === 'Block') {
        var block = ebmlBlock(chunk[1].data)

        if (self.subtitleTracks.has(block.trackNumber)) {
          var type = self.subtitleTracks.get(block.trackNumber).type

          // TODO: would a subtitle track ever use lacing? We just take the first (only) frame.
          var subtitle = {
            text: block.frames[0].toString('utf8'),
            time: (block.timecode + currentClusterTimecode) * self.timecodeScale
          }

          if (type === 'ASS') {
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

          // TODO: split?
          currentSubtitleBlock = [block.trackNumber, subtitle]
        }
      }

      // TODO: assuming `BlockDuration` exists and always comes after `Block`
      if (currentSubtitleBlock && chunk[1].name === 'BlockDuration') {
        currentSubtitleBlock[1].duration = readElement(chunk[1]) * self.timecodeScale

        self.emit('subtitle', currentSubtitleBlock[1], currentSubtitleBlock[0])

        currentSubtitleBlock = null
      }
    }
  }

  _write (chunk, _, callback) {
    this.decoder.write(chunk)
    callback(null)
  }
}

module.exports = MatroskaSubtitles
