const { Transform } = require('readable-stream')
const ebmlBlock = require('ebml-block')
const readElement = require('./read-element')

// track elements we care about
const TRACK_ELEMENTS = ['TrackNumber', 'TrackType', 'Language', 'CodecID', 'CodecPrivate']
const SUBTITLE_TYPES = ['S_TEXT/UTF8', 'S_TEXT/SSA', 'S_TEXT/ASS']
const ASS_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text']

class SubtitleParserBase extends Transform {
  constructor () {
    super()

    let currentTrack = null
    let currentSubtitleBlock = null
    let currentClusterTimecode = null

    this.subtitleTracks = new Map()
    this.timecodeScale = 1

    this._parseEbmlSubtitles = (chunk) => {
      // Segment Information
      if (chunk[1].name === 'TimecodeScale') {
        this.timecodeScale = readElement(chunk[1]) / 1000000
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

            this.subtitleTracks.set(currentTrack.TrackNumber, track)
          }
        }
        currentTrack = null
      }

      if (chunk[0] === 'end' && chunk[1].name === 'Tracks') {
        this.emit('tracks', Array.from(this.subtitleTracks.values()))
      }

      // Assumption: This is a Cluster `Timecode`
      if (chunk[1].name === 'Timecode') {
        currentClusterTimecode = readElement(chunk[1])
      }

      if (chunk[1].name === 'Block') {
        const block = ebmlBlock(chunk[1].data)

        if (this.subtitleTracks.has(block.trackNumber)) {
          const type = this.subtitleTracks.get(block.trackNumber).type

          const subtitle = {
            text: block.frames[0].toString('utf8'),
            time: (block.timecode + currentClusterTimecode) * this.timecodeScale
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

      // Assumption: `BlockDuration` exists and always comes after `Block`
      if (currentSubtitleBlock && chunk[1].name === 'BlockDuration') {
        currentSubtitleBlock[0].duration = readElement(chunk[1]) * this.timecodeScale

        this.emit('subtitle', ...currentSubtitleBlock)

        currentSubtitleBlock = null
      }
    }
  }
}

module.exports = SubtitleParserBase
