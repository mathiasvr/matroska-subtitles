import { SubtitleParserBase } from './subtitle-parser-base'

export class SubtitleParser extends SubtitleParserBase {
  constructor () {
    super()

    this.decoder.on('data', (chunk) => {
      if (chunk[0] === 'end' && chunk[1].name === 'Tracks') {
        if (this.subtitleTracks.size === 0) this.end()
      }
    })
  }

  _write (chunk, _, callback) {
    this.decoder.write(chunk)
    callback(null, chunk)
  }
}
