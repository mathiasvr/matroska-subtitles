const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { deepStrictEqual } = require('assert')
const devnull = require('dev-null')
const { SubtitleParser, SubtitleStream } = require('..')

const repo = 'https://github.com/Matroska-Org/matroska-test-files.git'
const testFile = path.resolve(__dirname, 'matroska-test-files/test_files/test5.mkv')

if (!fs.existsSync(testFile)) {
  console.log(`Did not find ${testFile}, downloading from git repository.`)
  const git = spawn('git', ['clone', repo, '--depth', '1'], {
    cwd: __dirname,
    stdio: ['ignore', 'inherit', 'inherit']
  })

  git.on('close', (code) => {
    if (code === 0) {
      tests()
    } else {
      console.error(`git clone process exited with code ${code}`)
      process.exit(1)
    }
  })
} else {
  tests()
}

function tests () {
  console.log('Running mkv tests...')
  testBasic()
  testSeeking()
}

function testBasic () {
  const parser = new SubtitleParser()

  parser.once('tracks', (tracks) => deepStrictEqual(tracks, [
    { number: 3, language: undefined, type: 'utf8' },
    { number: 4, language: 'hun', type: 'utf8' },
    { number: 5, language: 'ger', type: 'utf8' },
    { number: 6, language: 'fre', type: 'utf8' },
    { number: 8, language: 'spa', type: 'utf8' },
    { number: 9, language: 'ita', type: 'utf8' },
    { number: 11, language: 'jpn', type: 'utf8' },
    { number: 7, language: 'und', type: 'utf8' }
  ]))

  parser.once('chapters', chapters => {
    // test files don't have chapters :/
    deepStrictEqual(chapters, [])
  })

  const subtitles = {}

  parser.on('subtitle', (subtitle, trackNumber) => {
    if (!subtitles[trackNumber]) subtitles[trackNumber] = []
    subtitles[trackNumber].push(subtitle)
  })

  parser.on('finish', () => {
    const expected = {
      3: [
        { text: '...the colossus of Rhodes!', time: 3549, duration: 1741 },
        { text: 'No!', time: 5757, duration: 921 },
        { text: 'The colossus of Rhodes\r\nand it is here just for you Proog.', time: 6715, duration: 5829 },
        { text: 'It is there...', time: 41626, duration: 1922 },
        { text: "I'm telling you,\r\nEmo...", time: 43584, duration: 3081 }
      ],
      4: [
        { text: 'A jobb oldaladon láthatod...\r\n...tudod mit...', time: 42, duration: 3375 },
        { text: '...a Rodoszi Kolosszust!', time: 3625, duration: 1750 },
        { text: 'Ne!', time: 6458, duration: 875 },
        { text: 'A Rodoszi Kolosszust\r\nés csak neked van itt Proog.', time: 7375, duration: 5417 },
        { text: 'Ott van...', time: 41958, duration: 1834 },
        { text: 'Én mondom neked,\r\nEmo...', time: 43833, duration: 2292 }
      ],
      5: [
        { text: 'Auf der rechten Seite sieht man...|...rate mal...', time: 42, duration: 3375 },
        { text: '...den Koloss von Rhodos!', time: 3625, duration: 1750 },
        { text: 'Nein!', time: 6458, duration: 875 },
        { text: 'Den Koloss von Rhodos|und er ist nur für dich hier, Proog.', time: 7375, duration: 5417 },
        { text: 'Es ist da...', time: 41958, duration: 1834 },
        { text: 'Wenn ich es dir doch sage,|Emo...', time: 43833, duration: 2292 }
      ],
      6: [
        { text: 'À votre droite vous pouvez voir...|Ça alors...', time: 42, duration: 3375 },
        { text: '... le colosse de Rhodes !', time: 3625, duration: 1750 },
        { text: 'Non !', time: 6375, duration: 750 },
        { text: "Le colosse de Rhodes,|et il n'est là que pour toi Proog.", time: 7375, duration: 5000 },
        { text: 'Mais c’est là...', time: 41958, duration: 1500 },
        { text: 'Je te le jure,|Emo...', time: 43833, duration: 2292 }
      ],
      7: [
        { text: 'å', time: 42, duration: 3375 },
        { text: 'â€¦ãƒ­ãƒ¼ãƒ‰ã‚¹å³¶ã', time: 3625, duration: 1750 },
        { text: 'ã‚„ã‚', time: 6458, duration: 875 },
        { text: 'ã', time: 7375, duration: 5417 },
        { text: 'ã', time: 41958, duration: 1834 },
        { text: 'ã', time: 43833, duration: 2292 }
      ],
      8: [
        { text: 'A tu derecha puedes ver...|adivina qué...', time: 42, duration: 3375 },
        { text: '...¡El Coloso de Rodas!', time: 3625, duration: 1750 },
        { text: '¡No!', time: 6458, duration: 875 },
        { text: 'El Coloso de Rodas |y está aquí sólo para ti, Proog.', time: 7375, duration: 5417 },
        { text: 'Está ahí...', time: 41958, duration: 1834 },
        { text: 'Te lo estoy diciendo,|Emo...', time: 43833, duration: 2292 }
      ],
      9: [
        { text: 'Alla tua destra puoi vedere...|...ma pensa...', time: 42, duration: 3375 },
        { text: '...Il colosso di Rodi!', time: 3625, duration: 1750 },
        { text: 'No!', time: 6458, duration: 875 },
        { text: 'Il colosso di Rodi|ed Ã¨ qui solo per te Proog.', time: 7375, duration: 5417 },
        { text: 'Ãˆ lÃ¬...', time: 41958, duration: 1834 },
        { text: 'Te lo stavo dicendo,|Emo...', time: 43833, duration: 2292 }
      ],
      11: [
        { text: '右にあるのは…|…すごい！…', time: 42, duration: 3375 },
        { text: '…ロードス島の巨像だ！', time: 3625, duration: 1750 },
        { text: 'やめろ！', time: 6458, duration: 875 },
        { text: 'この巨像はあなたの物|プルーグ、あなたのだよ', time: 7375, duration: 5417 },
        { text: 'いってるじゃないか…', time: 41958, duration: 1834 },
        { text: 'そこにあるって、イーモ…', time: 43833, duration: 2292 }
      ]
    }

    for (const key of Object.keys(expected)) {
      deepStrictEqual(subtitles[key], expected[key])
    }
  })

  fs.createReadStream(testFile).pipe(parser)
}

function testSeeking () {
  let subtitleStream = new SubtitleStream()

  subtitleStream.once('tracks', (tracks) => {
    subtitleStream = new SubtitleStream(subtitleStream)

    subtitleStream.on('subtitle', (subtitle, trackNumber) => {
      deepStrictEqual(subtitle.time, trackNumber === 3 ? 43584 : 43833)
    })

    fs.createReadStream(null, { fd: filestream.fd, start: 30000000 }).pipe(subtitleStream).pipe(devnull())
  })

  const filestream = fs.createReadStream(testFile)

  filestream.pipe(subtitleStream).pipe(devnull())
}
