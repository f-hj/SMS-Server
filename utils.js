module.exports = {
	uid: (len, optionalArray) => {
		var buf = []
		var chars = optionalArray ? optionalArray : 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
		var charlen = chars.length

		for (var i = 0; i < len; ++i) {
			buf.push(chars[getRandomInt(0, charlen - 1)])
		}

		return buf.join('')
	},
	code: (len) => {
		return me.uid(len, "0123456789")
	}
}

var me = module.exports

var getRandomInt = (min, max) => {
	return Math.floor(Math.random() * (max - min + 1)) + min
}
