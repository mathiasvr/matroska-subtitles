(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('ebml-stream'), require('readable-stream'), require('zlib')) :
  typeof define === 'function' && define.amd ? define(['exports', 'ebml-stream', 'readable-stream', 'zlib'], factory) :
  (global = global || self, factory(global.MatroskaSubtitles = {}, global.ebmlStream, global.readableStream, global.zlib));
}(this, (function (exports, ebmlStream, readableStream, zlib) {
  const SSA_TYPES = new Set(['ssa', 'ass']);
  const SSA_KEYS = ['readOrder', 'layer', 'style', 'name', 'marginL', 'marginR', 'marginV', 'effect', 'text'];

  function getData(chunk, id) {
    const el = chunk.Children.find(c => c.id === id);
    return el ? el.data : undefined;
  }

  class SubtitleParserBase extends readableStream.Transform {
    constructor() {
      super();
      this.subtitleTracks = new Map();
      this.timecodeScale = 1;
      this._currentClusterTimecode = null;
      this.decoder = new ebmlStream.EbmlStreamDecoder({
        bufferTagIds: [ebmlStream.EbmlTagId.TimecodeScale, ebmlStream.EbmlTagId.Tracks, ebmlStream.EbmlTagId.BlockGroup, ebmlStream.EbmlTagId.AttachedFile]
      });
      this.decoder.on('data', this.parseEbmlSubtitles.bind(this));
    }

    parseEbmlSubtitles(chunk) {
      // Segment Information
      if (chunk.id === ebmlStream.EbmlTagId.TimecodeScale) {
        this.timecodeScale = chunk.data / 1000000;
      } // Assumption: This is a Cluster `Timecode`


      if (chunk.id === ebmlStream.EbmlTagId.Timecode) {
        this._currentClusterTimecode = chunk.data;
      }

      if (chunk.id === ebmlStream.EbmlTagId.Tracks) {
        for (const entry of chunk.Children.filter(c => c.id === ebmlStream.EbmlTagId.TrackEntry)) {
          // Skip non subtitle tracks
          if (getData(entry, ebmlStream.EbmlTagId.TrackType) !== 0x11) continue;
          const codecID = getData(entry, ebmlStream.EbmlTagId.CodecID) || '';

          if (codecID.startsWith('S_TEXT')) {
            const track = {
              number: getData(entry, ebmlStream.EbmlTagId.TrackNumber),
              language: getData(entry, ebmlStream.EbmlTagId.Language),
              type: codecID.substring(7).toLowerCase()
            };
            const name = getData(entry, ebmlStream.EbmlTagId.Name);

            if (name) {
              track.name = name;
            }

            const header = getData(entry, ebmlStream.EbmlTagId.CodecPrivate);

            if (header && SSA_TYPES.has(track.type)) {
              track.header = header.toString();
            } // TODO: Assume zlib deflate compression


            const compressed = entry.Children.find(c => c.id === ebmlStream.EbmlTagId.ContentEncodings && c.Children.find(cc => cc.id === ebmlStream.EbmlTagId.ContentEncoding && cc.Children.find(ccc => ccc.id === ebmlStream.EbmlTagId.ContentCompression)));

            if (compressed) {
              track._compressed = true;
            }

            this.subtitleTracks.set(track.number, track);
          }
        }

        this.emit('tracks', Array.from(this.subtitleTracks.values()));
      }

      if (chunk.id === ebmlStream.EbmlTagId.BlockGroup) {
        const block = chunk.Children.find(c => c.id === ebmlStream.EbmlTagId.Block);

        if (block && this.subtitleTracks.has(block.track)) {
          const blockDuration = getData(chunk, ebmlStream.EbmlTagId.BlockDuration);
          const track = this.subtitleTracks.get(block.track);
          const payload = track._compressed ? zlib.inflateSync(Buffer.from(block.payload)) : block.payload;
          const subtitle = {
            text: payload.toString('utf8'),
            time: (block.value + this._currentClusterTimecode) * this.timecodeScale,
            duration: blockDuration * this.timecodeScale
          };

          if (SSA_TYPES.has(track.type)) {
            // extract SSA/ASS keys
            const values = subtitle.text.split(','); // ignore read-order, and skip layer if ssa

            for (let i = track.type === 'ssa' ? 2 : 1; i < 8; i++) {
              subtitle[SSA_KEYS[i]] = values[i];
            }

            subtitle.text = values.slice(8).join(',');
          }

          this.emit('subtitle', subtitle, block.track);
        }
      } // Parse attached files, mainly to allow extracting subtitle font files.


      if (chunk.id === ebmlStream.EbmlTagId.AttachedFile) {
        this.emit('file', {
          filename: getData(chunk, ebmlStream.EbmlTagId.FileName),
          mimetype: getData(chunk, ebmlStream.EbmlTagId.FileMimeType),
          data: getData(chunk, ebmlStream.EbmlTagId.FileData)
        });
      }
    }

  }

  class SubtitleParser extends SubtitleParserBase {
    constructor() {
      super();
      this.decoder.on('data', chunk => {
        if (chunk.id === ebmlStream.EbmlTagId.Tracks) {
          // stop decoding if no subtitle tracks are present
          if (this.subtitleTracks.size === 0) this.end();
        }
      });
    }

    _write(chunk, _, callback) {
      this.decoder.write(chunk);
      callback(null, chunk);
    }

  }

  class SubtitleStream extends SubtitleParserBase {
    constructor(prevInstance) {
      super();

      if (prevInstance instanceof SubtitleStream) {
        prevInstance.once('drain', () => prevInstance.end()); // copy previous metadata

        this.subtitleTracks = prevInstance.subtitleTracks;
        this.timecodeScale = prevInstance.timecodeScale; // may not be at ebml tag offset

        this.unstable = true;
      }
    } // passthrough stream: data is intercepted but not transformed


    _transform(chunk, _, callback) {
      if (this.unstable) {
        // the ebml decoder expects to see a tag, so we won't use it until we find a cluster
        for (let i = 0; i < chunk.length - 12; i++) {
          // cluster id
          if (chunk[i] === 0x1f && chunk[i + 1] === 0x43 && chunk[i + 2] === 0xb6 && chunk[i + 3] === 0x75) {
            // length of cluster size tag
            const len = 8 - Math.floor(Math.log2(chunk[i + 4])); // first tag in cluster is cluster timecode

            if (chunk[i + 4 + len] === 0xe7) {
              // okay this is probably a cluster
              this.unstable = false;
              this.decoderWrite(chunk.slice(i));
              break;
            }
          }
        }
      } else {
        this.decoderWrite(chunk);
      }

      callback(null, chunk);
    }

    decoderWrite(chunk) {
      // passthrough stream should allow chained streams to continue on error
      try {
        this.decoder.write(chunk);
      } catch (err) {
        console.warn('[matroska-subtitles] EBML stream decoding error');
      }
    }

  }

  exports.SubtitleParser = SubtitleParser;
  exports.SubtitleStream = SubtitleStream;

})));
//# sourceMappingURL=matroska-subtitles.umd.js.map
