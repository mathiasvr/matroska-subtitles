# matroska-subtitles

[![NPM](https://img.shields.io/npm/v/matroska-subtitles.svg?style=for-the-badge)](https://npm.im/matroska-subtitles)
![Downloads](https://img.shields.io/npm/dt/matroska-subtitles.svg?style=for-the-badge)
![Dependency status](https://img.shields.io/librariesio/release/npm/matroska-subtitles?style=for-the-badge)
[![License](https://img.shields.io/:license-MIT-blue.svg?style=for-the-badge)](https://mvr.mit-license.org)
[![forthebadge](https://forthebadge.com/images/badges/powered-by-coffee.svg)](https://forthebadge.com)

Streaming parser for embedded .mkv subtitles.

Supported formats: `.srt`, `.ssa`, `.ass`.

## install

```shell
$ npm install matroska-subtitles
```

or include it directly:
```html
<script src="https://cdn.jsdelivr.net/npm/matroska-subtitles@3.x/dist/matroska-subtitles.min.js"></script>
```

## example

```js
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

```js
[
  { number: 3, language: 'eng', type: 'utf8', name: 'English(US)' },
  { number: 4, language: 'jpn', type: 'ass', header: '[Script Info]\r\n...' }
]
```

- The `language` attribute can be `undefined` if the mkv track does not specify it, this is often interpreted as `eng`.
- The `name` attribute is not standard but may provide language info.

### `subtitle` event response format

```js
{
  text: 'This blade has a dark past.',
  time: 107250,  // ms
  duration: 1970 // ms
}
```

## attached files
The parser now also has a `file` event that emits embedded mkv files, mainly to be used to extract embedded subtitle fonts.

```js
parser.on('file', file => console.log('file:', file))
```

Output:
```js
{
  filename: 'Arial.ttf',
  mimetype: 'application/x-truetype-font',
  data: Buffer() [Uint8Array]
}
```

## random access
This module also includes a `SubtitleStream` class for intercepting subtitles
in mkv streams with support for seeking.

```js
const { SubtitleStream } = require('matroska-subtitles')

let subtitleStream = new SubtitleStream()

subtitleStream.once('tracks', (tracks) => {
  // close the old subtitle stream and open a new at a different stream offset
  subtitleStream = new SubtitleStream(subtitleStream)
})
```

See [examples/random-access.js](examples/random-access.js) for a detailed example.

## see also 

[mkv-subtitle-extractor](https://npm.im/mkv-subtitle-extractor)

## license

MIT
