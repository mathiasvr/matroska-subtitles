const fs = require('fs')
const matroskaSubtitles = require('..')

var subs = matroskaSubtitles()

// first an array of subtitle track information will be emitted
subs.once('data', function (tracks) {
  console.log(tracks)

  //fstream.unpipe(subs)
  
  //subs.end()
  
  subs = matroskaSubtitles(subs)

  // following objects are subtitles
  subs.on('data', function (obj) {
    var num = obj[0]
    var subtitle = obj[1]
    console.log('track ' + num + ':', subtitle)
  })

 // fstream.pipe(subs)
  //fs.createReadStream(process.argv[2]).pipe(subs)
  fs.createReadStream(null, { fd: fstream.fd, start: 29737907 }).pipe(subs)
  
})

var fstream = fs.createReadStream(process.argv[2])
fstream.pipe(subs)
//fs.createReadStream(process.argv[2]).pipe(subs)
