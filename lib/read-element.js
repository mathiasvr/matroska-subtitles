module.exports = function (tag) {
  switch (tag.type) {
    case 's': return tag.data.toString('ascii')
    case '8': return tag.data.toString('utf8')
    case 'f': return tag.dataSize === 4
      ? tag.data.readFloatBE()
      : tag.data.readDoubleBE()
    case 'u': return tag.data.readUIntBE(0, tag.dataSize)
    case 'i': case 'd': return tag.data.readIntBE(0, tag.dataSize)
    case 'b': case 'm': default: return tag.data
  }
}
