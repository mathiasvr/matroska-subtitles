const SubtitleParserBase = require('./subtitle-parser-base')
// TODO: full path to node source to avoid webpack issues with ebml@3.0.0 'browser' tag
//       https://github.com/node-ebml/node-ebml/pull/113
const ebml = require('ebml/lib/ebml')

class SubtitleStream extends SubtitleParserBase {
  constructor () {
    super()

    this.decoder = new ebml.Decoder()
    this.decoder.on('data', this._parseEbmlSubtitles.bind(this))
  }

  // returns new parser stream at offset
  seekTo () {
    this.once('drain', () => this.end())
    
    const newParser = new SubtitleStream()
    newParser.unstable = true

    // copy previous metadata
    newParser.subtitleTracks = this.subtitleTracks
    newParser.timecodeScale = this.timecodeScale

    return newParser
  }

  // passthrough stream: data is intercepted but not transformed
  _transform (chunk, _, callback) {
    if (this.unstable) {
      // the ebml decoder expects to see a tag, so we won't use it until we find a cluster
      for (let i = 0; i < chunk.length - 12; i++) {
        if (chunk[i] === 0x1f && chunk[i+1] === 0x43 && chunk[i+2] === 0xb6 && chunk[i+3] === 0x75) { 
          // length of cluster size tag
          const len = 8 - Math.floor(Math.log2(chunk[i+4]));
          // first tag in cluster is cluster timecode
          if (len < 9 && chunk[i + 4 + len] === 0xe7) {
            // okay this is probably a cluster
            this.unstable = false
            this.decoder.write(chunk.slice(i))
            break
          }
        }
      }
    } else {
      this.decoder.write(chunk)
    }

    callback(null, chunk)
  }
}

module.exports = SubtitleStream
