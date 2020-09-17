const SubtitleParserBase = require('./subtitle-parser-base')
// TODO: full path to node source to avoid webpack issues with ebml@3.0.0 'browser' tag
//       https://github.com/node-ebml/node-ebml/pull/113
const ebml = require('ebml/lib/ebml')

class SubtitleParser extends SubtitleParserBase {
  constructor () {
    super()
    this.decoder = new ebml.Decoder()
    this.decoder.on('data', this._parseEbmlSubtitles.bind(this))
  }

  _write (chunk, _, callback) {
    this.decoder.write(chunk)
    callback(null, chunk)
  }
}

module.exports = SubtitleParser
