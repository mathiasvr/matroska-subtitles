# matroska-subtitles [![npm][npm-img]][npm-url] [![dependencies][dep-img]][dep-url] [![license][lic-img]][lic-url]

[npm-img]: https://img.shields.io/npm/v/matroska-subtitles.svg
[npm-url]: https://www.npmjs.com/package/matroska-subtitles
[dep-img]: https://david-dm.org/mathiasvr/matroska-subtitles.svg
[dep-url]: https://david-dm.org/mathiasvr/matroska-subtitles
[lic-img]: http://img.shields.io/:license-MIT-blue.svg
[lic-url]: http://mvr.mit-license.org

Transform stream for parsing embedded .mkv subtitles.

## install

```
npm install matroska-subtitles
```

## documetation

The `data` event of the stream will emit an array that determines the type of the data.
When a new subtitle track is encountered a *track number* and *language* is emitted:
```javascript
data = [ 'new', { track: <track number>, language: <string> } ]
```

Subsequently a specific subtitle track will emit data of this form:
```javascript
data = [ <track number>, { text: <string>, time: <ms>, duration: <ms> } ]
```

## example

The following is a basic example of extracting subtitle tracks of an mkv:

```javascript
const fs = require('fs')
const matroskaSubtitles = require('matroska-subtitles')

var tracks = new Map()
var subs = matroskaSubtitles()

subs.on('data', function (data) {
  if (data[0] === 'new') {
    var key = data[1].track
    tracks.set(key, {
      language: data[1].language,
      subtitles: []
    })
  } else {
    var key = data[0]
    var subtitle = data[1]
    tracks.get(key).subtitles.push(subtitle)
  }
})

subs.on('end', function () {
  tracks.forEach((track) => console.log(track))
})

fs.createReadStream('Sintel.2010.720p.mkv').pipe(subs)
```

> Notice that this example doesn't take advantage of streaming since the subtitles first are being outputted when the stream ends.

### response

The response of this example would look like this:
```javascript
{ language: 'eng',
  subtitles: 
   [ { text: 'This blade has a dark past.',
       time: 107250,
       duration: 1970 },
     { text: 'It has shed much innocent blood.',
       time: 111800,
       duration: 4000 },
     { text: 'You\'re a fool for traveling alone,\r\nso completely unprepared.',
       time: 118000,
       duration: 3450 } ] }
```

> Note that the `language` might be `undefined` if the mkv track has not specified it.

## contributing

This is still a work in progress.

If you find a bug or have suggestions feel free to create an issue or a pull request!

## license

MIT
