import { SubtitleParserBase } from './subtitle-parser-base'
// TODO: full path to node source to avoid webpack issues with ebml@3.0.0 'browser' tag
//       https://github.com/node-ebml/node-ebml/pull/113
import ebml from 'ebml/lib/ebml'

export class SubtitleParser extends SubtitleParserBase {
  constructor () {
    super()

    this.decoder = new ebml.Decoder()
    this.decoder.on('data', (chunk) => {
      if (chunk[0] === 'end' && chunk[1].name === 'Tracks') {
        if (this.subtitleTracks.size === 0) this.end()
      }
      this._parseEbmlSubtitles(chunk)
    })
  }

  _write (chunk, _, callback) {
    this.decoder.write(chunk)
    callback(null, chunk)
  }
}
