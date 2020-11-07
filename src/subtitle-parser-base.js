import { Transform } from 'readable-stream'
import { EbmlStreamDecoder, EbmlTagId } from 'ebml-stream'

const SSA_TYPES = new Set(['ssa', 'ass'])
const SSA_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text']

function getData (chunk, id) {
  const el = chunk.Children.find(c => c.id === id)
  return el ? el.data : undefined
}

export class SubtitleParserBase extends Transform {
  constructor () {
    super()

    this.subtitleTracks = new Map()
    this.timecodeScale = 1

    this._currentClusterTimecode = null

    this.decoder = new EbmlStreamDecoder({
      bufferTagIds: [
        EbmlTagId.TimecodeScale,
        EbmlTagId.Tracks,
        EbmlTagId.BlockGroup,
        EbmlTagId.AttachedFile
      ]
    })

    this.decoder.on('data', this.parseEbmlSubtitles.bind(this))
  }

  parseEbmlSubtitles (chunk) {
    // Segment Information
    if (chunk.id === EbmlTagId.TimecodeScale) {
      this.timecodeScale = chunk.data / 1000000
    }

    // Assumption: This is a Cluster `Timecode`
    if (chunk.id === EbmlTagId.Timecode) {
      this._currentClusterTimecode = chunk.data
    }

    if (chunk.id === EbmlTagId.Tracks) {
      for (const entry of chunk.Children) {
        // Skip non subtitle tracks
        if (getData(entry, EbmlTagId.TrackType) !== 0x11) continue

        const codecID = getData(entry, EbmlTagId.CodecID) || ''
        if (codecID.startsWith('S_TEXT')) {
          const track = {
            number: getData(entry, EbmlTagId.TrackNumber),
            language: getData(entry, EbmlTagId.Language),
            type: codecID.substring(7).toLowerCase()
          }

          const name = getData(entry, EbmlTagId.Name)
          if (name) {
            track.name = name
          }

          const header = getData(entry, EbmlTagId.CodecPrivate)
          if (header && SSA_TYPES.has(track.type)) {
            track.header = header
          }

          this.subtitleTracks.set(track.number, track)
        }
      }

      this.emit('tracks', Array.from(this.subtitleTracks.values()))
    }

    if (chunk.id === EbmlTagId.BlockGroup) {
      const block = chunk.Children.find(c => c.id === EbmlTagId.Block)

      if (this.subtitleTracks.has(block.track)) {
        const blockDuration = getData(chunk, EbmlTagId.BlockDuration)
        const type = this.subtitleTracks.get(block.track).type

        const subtitle = {
          text: block.payload.toString('utf8'),
          time: (block.value + this._currentClusterTimecode) * this.timecodeScale,
          duration: blockDuration * this.timecodeScale
        }

        if (SSA_TYPES.has(type)) {
          // extract SSA/ASS keys
          const values = subtitle.text.split(',')

          // ignore read-order, and skip layer if ssa
          for (let i = type === 'ssa' ? 2 : 1; i < 8; i++) {
            subtitle[SSA_KEYS[i]] = values[i]
          }

          subtitle.text = values.slice(8).join(',')
        }

        this.emit('subtitle', subtitle, block.track)
      }
    }

    // Parse attached files, mainly to allow extracting subtitle font files.
    if (chunk.id === EbmlTagId.AttachedFile) {
      this.emit('file', {
        filename: getData(chunk, EbmlTagId.FileName),
        mimetype: getData(chunk, EbmlTagId.FileMimeType),
        data: getData(chunk, EbmlTagId.FileData)
      })
    }
  }
}
