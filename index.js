const Transform = require('readable-stream').Transform
const ebml = require('ebml')
const ebmlBlock = require('ebml-block')
const readElement = require('./lib/read-element')

// track elements we care about
const TRACK_ELEMENTS = ['TrackNumber', 'TrackType', 'Language', 'CodecID', 'CodecPrivate']
const SUBTITLE_TYPES = ['S_TEXT/UTF8', 'S_TEXT/SSA', 'S_TEXT/ASS']
const ASS_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text']

class MatroskaSubtitles extends Transform {
  constructor ({ prevInstance, offset } = {}) {
    super()

    let currentTrack = null
    let currentSubtitleBlock = null
    let currentClusterTimecode = null

    let currentSeekID = null

    this.decoder = new ebml.Decoder()

    if (prevInstance instanceof MatroskaSubtitles) {
      if (offset == null) throw new Error('no offset')

      prevInstance.once('drain', () => {
        // prevInstance.end()
        // console.log('prevInstance drain')
      })

      // copy previous metadata
      this.subtitleTracks = prevInstance.subtitleTracks
      this.timecodeScale = prevInstance.timecodeScale
      this.cues = prevInstance.cues

      if (!this.cues) {
        return console.warn('No cues.')
      }

      // find a cue that's close to the file offset
      // const cueArray = Uint32Array.from(this.cues.positions)
      // cueArray.sort()
      const cueArray = Array.from(this.cues.positions)
      cueArray.sort((a, b) => a - b)

      const closestCue = cueArray.find(i => i >= offset)

      if (closestCue != null) {
        // prepare to skip file stream until we hit a cue position
        this.skip = closestCue - offset
        // set internal decoder position to output consistent file offsets
        this.decoder.total = closestCue

        // console.log('using cue:', closestCue)

        this.decoder.on('data', _onMetaData.bind(this))
      } else {
        console.warn(`No cues for offset ${offset}. Subtitle parsing disabled.`)
      }
    } else {
      if (offset) return console.error(`Offset is ${offset}, and must be 0 for initial instance!`)

      this.subtitleTracks = new Map()
      this.timecodeScale = 1

      this.decoder.on('data', _onMetaData.bind(this))
    }

    let waitForNext = false

    function _onMetaData (chunk) {
      if (waitForNext) {
        waitForNext = false
        // Keep cues if this is the same segment
        if (!this.cues || this.cues.start !== chunk[1].start) {
          console.log('reset cues', this.cues, chunk[1].start)
          // Add 0 as a valid cue point
          this.cues = { start: chunk[1].start, positions: new Set([0]) }
        }
      }

      if (chunk[0] === 'start' && chunk[1].name === 'Segment') {
        // TODO: only record first segment?
        // TODO: find a simpler way to do this
        waitForNext = true
      }

      if (chunk[1].name === 'SeekID') {
        // TODO: .value is undefined for some reason?
        currentSeekID = chunk[1].data
      }

      if (currentSeekID && chunk[1].name === 'SeekPosition') {
        if (currentSeekID[0] === 0x1c) { // KaxCues
          // TODO: correct id handling
          // hack: this is not a cue position, but the position to the cue data itself,
          //       in case it's not located at the beginning of the file.
          this.cues.positions.add(this.cues.start + chunk[1].value)
        }
      }

      if (chunk[1].name === 'CueClusterPosition') {
        this.cues.positions.add(this.cues.start + chunk[1].value)
      }

      if (chunk[0] === 'end' && chunk[1].name === 'Cues') {
        this.emit('cues')
      }

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
        // this.decoder.removeListener('data', _onMetaData)

        // if (this.subtitleTracks.size <= 0) return this.end()

        // this.decoder.on('data', _onClusterData)
        this.emit('tracks', Array.from(this.subtitleTracks.values()))
      }
      // }

      // function _onClusterData (chunk) {
      // TODO: assuming this is a Cluster `Timecode`
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

      // TODO: assuming `BlockDuration` exists and always comes after `Block`
      if (currentSubtitleBlock && chunk[1].name === 'BlockDuration') {
        currentSubtitleBlock[0].duration = readElement(chunk[1]) * this.timecodeScale

        this.emit('subtitle', ...currentSubtitleBlock)

        currentSubtitleBlock = null
      }
    }
  }

  _transform (chunk, _, callback) {
    if (this.skip) {
      if (this.skip < chunk.length) {
        // slice chunk
        const sc = chunk.slice(this.skip)
        this.skip = 0
        this.decoder.write(sc)
      } else {
        // skip entire chunk
        this.skip -= chunk.length
      }
    } else {
      this.decoder.write(chunk)
    }

    callback(null, chunk)
  }
}

module.exports = MatroskaSubtitles
