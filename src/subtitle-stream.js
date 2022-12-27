import { SubtitleParserBase } from './subtitle-parser-base'
import { EbmlTagId } from 'ebml-stream'

export class SubtitleStream extends SubtitleParserBase {
  constructor (prevInstance) {
    super()

    if (prevInstance instanceof SubtitleParserBase) {
      prevInstance.once('drain', () => prevInstance.end())

      // copy previous metadata
      this.subtitleTracks = prevInstance.subtitleTracks
      this.timecodeScale = prevInstance.timecodeScale

      // may not be at ebml tag offset
      this.unstable = true
    }
    this.on('data', this._ondata.bind(this))
  }

  // passthrough stream: data is intercepted but not transformed
  _ondata (chunk) {
    if (this.unstable) {
      // the ebml decoder expects to see a tag, so we won't use it until we find a cluster
      for (let i = 0; i < chunk.length - 12; i++) {
        // cluster id 0x1F43B675
        // https://matroska.org/technical/elements.html#LevelCluster
        if (chunk[i] === 0x1f && chunk[i + 1] === 0x43 && chunk[i + 2] === 0xb6 && chunk[i + 3] === 0x75) {
          // length of cluster size tag
          const len = 8 - Math.floor(Math.log2(chunk[i + 4]))
          // first tag in cluster is a valid EbmlTag
          if (EbmlTagId[chunk[i + 4 + len]]) {
            // okay this is probably a cluster
            this.unstable = false
            this.decoderWrite(chunk.slice(i))
            return
          }
        }
      }
    } else {
      this.decoderWrite(chunk)
    }
  }

  decoderWrite (chunk) {
    // passthrough stream should allow chained streams to continue on error
    try {
      this.decoder.write(chunk)
    } catch (err) {
      console.warn('[matroska-subtitles] EBML stream decoding error', err)
    }
  }
}
