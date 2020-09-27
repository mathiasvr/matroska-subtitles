# matroska-subtitles

[![npm](https://img.shields.io/npm/v/matroska-subtitles.svg)](https://npm.im/matroska-subtitles)
![downloads](https://img.shields.io/npm/dt/matroska-subtitles.svg)
[![dependencies](https://david-dm.org/mathiasvr/matroska-subtitles.svg)](https://david-dm.org/mathiasvr/matroska-subtitles)
[![license](https://img.shields.io/:license-MIT-blue.svg)](https://mvr.mit-license.org)

Streaming parser for embedded .mkv subtitles.

Supported formats: `.srt`, `.ssa`, `.ass`.

## install

```shell
$ npm install matroska-subtitles
```

or include it directly:
```html
<script src="https://cdn.jsdelivr.net/npm/matroska-subtitles@3.0.1/dist/matroska-subtitles.min.js"></script>
```

## example

```javascript
const fs = require('fs')
const { SubtitleParser } = require('matroska-subtitles')

const parser = new SubtitleParser()

// first an array of subtitle track information is emitted
parser.once('tracks', (tracks) => console.log(tracks))

// afterwards each subtitle is emitted
parser.on('subtitle', (subtitle, trackNumber) =>
  console.log('Track ' + trackNumber + ':', subtitle))


fs.createReadStream('Sintel.2010.720p.mkv').pipe(parser)
```

See [examples](https://github.com/mathiasvr/matroska-subtitles/tree/master/examples) folder for more examples.

### `tracks` event response format

```javascript
[
  { number: 3, language: 'eng', type: 'utf8' },
  { number: 4, language: 'jpn', type: 'ass', header: '[Script Info]\r\n...' }
]
```

> The `language` attribute can be `undefined` if the mkv track does not specify it.

### `subtitle` event response format

```javascript
{
  text: 'This blade has a dark past.',
  time: 107250,  // ms
  duration: 1970 // ms
}
```

## random access
This module also includes a `SubtitleStream` class for intercepting subtitles
in mkv streams with support for seeking.

```js
const { SubtitleStream } = require('matroska-subtitles')

let subtitleStream = new SubtitleStream()

subtitleStream.once('tracks', (tracks) => {
  // seek to different stream offset
})
```

See [examples/random-access.js](examples/random-access.js) for a detailed example.

## see also 

[mkv-subtitle-extractor](https://npm.im/mkv-subtitle-extractor)

## license

MIT
