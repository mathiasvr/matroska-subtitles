const Transform = require('readable-stream').Transform
const ebml = require('ebml')
const ebmlBlock = require('ebml-block')
const readElement = require('./lib/read-element')

// track elements we care about
const TRACK_ELEMENTS = ['TrackNumber', 'TrackType', 'Language', 'CodecID', 'CodecPrivate']
const SUBTITLE_TYPES = ['S_TEXT/UTF8', 'S_TEXT/SSA', 'S_TEXT/ASS']
const ASS_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text']

// const CUES_ID = Buffer.from('1C53BB6B', 'hex')

class MatroskaSubtitles extends Transform {
  constructor ({ prevInstance, offset } = {}) {
    super()

    this.id = (Math.random() * 10000) | 0
    this.offset = offset
    this.bcount = 0

    let currentTrack = null
    let currentSubtitleBlock = null
    let currentClusterTimecode = null

    let currentSeekID = null

    this.on('close', () => {
      console.log('CLOSED:', this.id)
    });

    this.on('finish', () => {
      console.log('FINISH:', this.id)
    });

    this.decoder = new ebml.Decoder()

    if (prevInstance instanceof MatroskaSubtitles) {
      if (offset == null) throw new Error('no offset')

      if (prevInstance.decoder) console.log(`prevInstance id=${prevInstance.id}: decoder t=${prevInstance.decoder.total}, c=${prevInstance.decoder.cursor}`)

      prevInstance.once('drain', () => {
        console.log(`prevInstancee id=${prevInstance.id}: drained`)
        // prevInstance.end()
      })

      if (offset === 0) {
        // just begin normal parsing
        this.subtitleTracks = prevInstance.subtitleTracks || new Map()
        this.timecodeScale = prevInstance.timecodeScale || 1
        this.cues = prevInstance.cues

        this.decoder.on('data', _onMetaData.bind(this))
        return
      }

      // copy previous metadata
      this.subtitleTracks = prevInstance.subtitleTracks
      this.timecodeScale = prevInstance.timecodeScale
      this.cues = prevInstance.cues

      if (!this.cues) {
        this.decoder = null
        // TODO: AVOID THIS! - we can actually add seek points without the segment start (decoder.total), but this would cause problems later
        return console.warn('No cues was parsed. Subtitle parsing disabled.')
      }

      // TODO: should always be the case, but we currently allow some slack (initial instance not at z=0)
      if (prevInstance.decoder) {
        // use the position of the previous decoder as a valid seek point
        // this can help if offset is changed before parsing seeks and cues
        const decoderPosition = prevInstance.decoder.total - prevInstance.decoder.cursor
        this.cues.positions.add(decoderPosition)
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
        this.decoder = null
        console.warn(`No cues for offset ${offset}. Subtitle parsing disabled.`)
      }
    } else {
      if (offset) {
        this.decoder = null
        console.error(`Offset is ${offset}, and must be 0 for initial instance. Subtitle parsing disabled.`)
        return
      }

      this.subtitleTracks = new Map()
      this.timecodeScale = 1

      this.decoder.on('data', _onMetaData.bind(this))
    }

    function _onMetaData (chunk) {
      if (chunk[0] === 'start' && chunk[1].name === 'Segment') {
         // beginning of segment (next tag)
        const segStart = this.decoder.total
        // Keep cues if this is the same segment
        if (!this.cues) {
          this.cues = { start: segStart, positions: new Set() }
        } else if (this.cues.start !== segStart) {
          this.cues = { start: segStart, positions: new Set() }
          console.warn('New segment found - resetting cues! Not sure we can handle this!?')
        } else {
          console.info('Saw first segment again. Keeping cues.')
        }
      }

      if (chunk[1].name === 'SeekID') {
        // TODO: .value is undefined for some reason?
        currentSeekID = chunk[1].data
      }

      if (currentSeekID && chunk[1].name === 'SeekPosition') {
        //if (CUES_ID.equals(currentSeekID)) {
          // hack: this is not a cue position, but the position to the cue data itself,
          //       in case it's not located at the beginning of the file.
          // actually, just add all seek positions.
          this.cues.positions.add(this.cues.start + chunk[1].value)
        //}
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
    console.log(`Write id=${this.id}: z=${this.offset}, l=${chunk.length}, skip=${this.skip} pos=${(this.offset || 0) + this.bcount}`)
    this.bcount += chunk.length

    if (!this.decoder) {
      console.warn('Skipped decoder')
      return callback(null, chunk)
    }

    if (this.skip) {
      if (this.skip > 1048576 * 20) {
        console.warn(this.id, 'High skip value... This is bad.')
      }
      // skip bytes to reach cue position
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
