const SubtitleParserBase = require('./subtitle-parser-base')
// TODO: full path to node source to avoid webpack issues with ebml@3.0.0 'browser' tag
//       https://github.com/node-ebml/node-ebml/pull/113
const ebml = require('ebml/lib/ebml')

class SubtitleStream extends SubtitleParserBase {
  constructor () {
    super()

    this.segmentStart = null
    this.seekPositions = new Set()

    this.decoder = new ebml.Decoder()
    this.decoder.on('data', this._interceptSeeksAndParse.bind(this))
  }

  // returns new parser stream at offset
  seekTo (offset) {
    if (offset == null) throw new Error('Must supply offset to seek to')

    this.once('drain', () => this.end())

    const newParser = new SubtitleStream()

    // copy previous metadata
    newParser.subtitleTracks = this.subtitleTracks
    newParser.timecodeScale = this.timecodeScale
    newParser.segmentStart = this.segmentStart
    newParser.seekPositions = this.seekPositions

    if (offset === 0) {
      // begin parsing from beginning of video
      return newParser
    }

    if (this.decoder) {
      // use the position of the previous decoder as a valid seek point
      // this can help if offset is changed before parsing seeks and cues
      const decoderPosition = this.decoder.total - this.decoder.cursor
      newParser.seekPositions.add(decoderPosition)
    }

    if (newParser.seekPositions.length === 0) {
      console.warn('No cues was parsed. Subtitle parsing disabled.')
      newParser.decoder = null
      return newParser
    }

    // find a cue that's close to the file offset
    // const seeksSorted = Uint32Array.from(newParser.seekPositions)
    // seeksSorted.sort()
    const seeksSorted = Array.from(newParser.seekPositions)
    seeksSorted.sort((a, b) => a - b)

    const closestSeek = seeksSorted.find(i => i >= offset)

    if (closestSeek != null) {
      // prepare to skip file stream until we hit a cue position
      newParser.skip = closestSeek - offset
      // set internal decoder position to output consistent file offsets
      newParser.decoder.total = closestSeek
    } else {
      console.warn(`No cues for offset ${offset}. Subtitle parsing disabled.`)
      this.decoder = null
    }

    return newParser
  }

  _interceptSeeksAndParse (chunk) {
    if (chunk[0] === 'start' && chunk[1].name === 'Segment') {
      // beginning of segment (next tag)
      const segStart = this.decoder.total

      if (this.segmentStart != null && this.segmentStart !== segStart) {
        // we don't really support multiple segments...
        this.seekPositions = new Set()
        console.warn('New segment found, this could be a problem!')
      }

      this.segmentStart = segStart
    }

    if (chunk[1].name === 'SeekPosition' || chunk[1].name === 'CueClusterPosition') {
      // save all seek and cue positions
      this.seekPositions.add(this.segmentStart + chunk[1].value)
    }

    if (chunk[0] === 'end' && chunk[1].name === 'Cues') {
      this.emit('cues')
    }

    this._parseEbmlSubtitles(chunk)
  }

  // passthrough stream: data is intercepted but not transformed
  _transform (chunk, _, callback) {
    if (!this.decoder) return callback(null, chunk)

    if (this.skip) {
      // Typically when no proper seek points are available
      if (this.skip > chunk.length * 20) {
        if (!this.stalling) console.warn('Subtitle parsing has stalled.')
        this.stalling = true
      } else {
        this.stalling = false
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

module.exports = SubtitleStream
