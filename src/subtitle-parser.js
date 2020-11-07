import { EbmlTagId } from 'ebml-stream'
import { SubtitleParserBase } from './subtitle-parser-base'

export class SubtitleParser extends SubtitleParserBase {
  constructor () {
    super()

    this.decoder.on('data', (chunk) => {
      if (chunk.id === EbmlTagId.Tracks) {
        // stop decoding if no subtitle tracks are present
        if (this.subtitleTracks.size === 0) this.end()
      }
    })
  }

  _write (chunk, _, callback) {
    this.decoder.write(chunk)
    callback(null, chunk)
  }
}
