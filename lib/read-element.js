const millennium = Date.UTC(2001, 0)

module.exports = function (tag) {
  switch (tag.type) {
    case 's': return tag.data.toString('ascii')
    case '8': return tag.data.toString('utf8')
    case 'u': return tag.data.readUIntBE(0, tag.dataSize)
    case 'i': return tag.data.readIntBE(0, tag.dataSize)
    case 'f': return tag.dataSize === 4
      ? tag.data.readFloatBE()
      : tag.data.readDoubleBE()
    case 'd': return new Date(millennium + tag.data.readIntBE(0, 8) / 1000000)
    case 'b': case 'm': default: return tag.data
  }
}
