const Writable = require('stream').Writable
const ebml = require('ebml')
const ebmlBlock = require('ebml-block')
const readElement = require('./lib/read-element')

// track elements we care about
const TRACK_ELEMENTS = ['TrackNumber', 'TrackType', 'Language', 'CodecID', 'CodecPrivate']
const SUBTITLE_TYPES = ['S_TEXT/UTF8', 'S_TEXT/SSA', 'S_TEXT/ASS']
const ASS_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text']

class MatroskaSubtitles extends Writable {
  constructor (prevInstance) {
    super()

    let currentTrack = null
    let currentSubtitleBlock = null
    let currentClusterTimecode = null

    this.decoder = new ebml.Decoder()

    if (prevInstance instanceof MatroskaSubtitles) {
      prevInstance.once('drain', () => prevInstance.end())
      // copy previous metadata
      this.subtitleTracks = prevInstance.subtitleTracks
      this.timecodeScale = prevInstance.timecodeScale
      this.decoder.on('data', _onClusterData)
    } else {
      this.subtitleTracks = new Map()
      this.timecodeScale = 1
      this.decoder.on('data', _onMetaData)
    }

    const self = this

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
        if (currentTrack.TrackType === 0x11) { // Subtitle Track
          if (SUBTITLE_TYPES.includes(currentTrack.CodecID)) {
            const track = {
              number: currentTrack.TrackNumber,
              language: currentTrack.Language,
              type: currentTrack.CodecID.substring(7).toLowerCase()
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
        const block = ebmlBlock(chunk[1].data)

        if (self.subtitleTracks.has(block.trackNumber)) {
          const type = self.subtitleTracks.get(block.trackNumber).type

          let subtitle = {
            text: block.frames[0].toString('utf8'),
            time: (block.timecode + currentClusterTimecode) * self.timecodeScale
          }

          if (type === 'ass' || type === 'ssa') {
            // extract SSA/ASS keys
            const values = subtitle.text.split(',')
            // ignore read-order, and skip layer if ssa
            let i = type === 'ssa' ? 2 : 1
            for (; i < 9; i++) {
              subtitle[ASS_KEYS[i]] = values[i]
            }
            // re-append extra text that might have been split
            for (i = 9; i < values.length; i++) {
              subtitle.text += ',' + values[i]
            }
          }

          currentSubtitleBlock = [subtitle, block.trackNumber]
        }
      }

      // TODO: assuming `BlockDuration` exists and always comes after `Block`
      if (currentSubtitleBlock && chunk[1].name === 'BlockDuration') {
        currentSubtitleBlock[0].duration = readElement(chunk[1]) * self.timecodeScale

        self.emit('subtitle', ...currentSubtitleBlock)

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
