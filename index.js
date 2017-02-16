var express = require('express')
var app = express()
var SerialPort = require("serialport");
var pdu = require('./pdu.js')
var db = require('./db.js')
var utils = require('./utils.js')
var port = new SerialPort("/dev/ttyS0", {
	baudRate: 115200,
	parser: SerialPort.parsers.raw
})

var stack = []

var state = 'undefined'
var quality = 0

var offline = false

// use AT&W for profiles (pdu, clip...s)

// +CREG=0,1 : Opérateur national
// +CREG=0,5 : Opérateur roaming
// +CREG=0,2 : Rechrche

// +CSQ: rssi,ber
// rssi 0 : -113dbm
// rssi 31: -51dbm
// rssi 99: non détectable
// rssi < 10 : insufficient network
// rssi > 15 : perfect


var str = ''
var nextIsSms = false
port.on('data', function (data) {
	str += data
	//on '> ' smsS2()
	if (str.indexOf('>') != -1) {
		str.replace('>', '')
		smsS2()
	}
	for (var i = 0 ; i < str.length ; i++) {
		if (str[i] == '\r' && str[i + 1] == '\n') {
			var log = str.substr(0, i).replace('\r', '').replace('\n', '')

			if (log != '') {
				console.log('A6: ' + log)
			}

			if (nextIsSms) {
				if (log && log != '') {
					//parse log as pdu
					//console.log('parse this: ' + log);
					var m = pdu.parse(log)
					onMessage(m)
					//TODO: delete msg
					nextIsSms = false
				}
			}

			if (log.indexOf('+CLIP:') != -1) {
				var num = log.split('"')[1]
				onCall(num)
			}
			if (log.indexOf('+CIEV: "SOUNDER",0') != -1) {
				//console.log('CALL ANSWERED');
				if (stack[0] && typeof stack[0].onCallAnswered == 'function') {
					stack[0].onCallAnswered()
				}
			}
			if (log.indexOf('+CIEV: "CALL",0') != -1) {
				//call ended
				if (stack[0] && typeof stack[0].onCallEnded == 'function') {
					stack[0].onCallEnded()
				}
				onStackItemDone()
			}
			if (log.indexOf('+CMGS:') != -1) {
				stack[0].nbPduDone++
        onOK(() => {
  				if (stack[0].nbPduDone == stack[0].nbPdu) {
  					if (typeof stack[0].onSent == 'function') {
  						stack[0].onSent()
  					}
  					onStackItemDone()
  				} else {
  					smsS1()
  				}
        })
			}
			if (log.indexOf('+CREG=') != -1) {
				if (log.indexOf('0,2') != -1) {
					state = 'searching'
				} else if (log.indexOf('0,5') != -1) {
					state = 'roaming'
				}
			}
			if (log.indexOf('+COPS:') != -1) {
				if (log.indexOf('20801')) {
					state = 'roaming'
				} else {
					state = 'unknown_network'
				}
			}
			if (log.indexOf('+CSQ:') != -1) {
				var l = log.split(' ')[1].split(',')[0]
				quality = l
			}
			if (log.indexOf('ERROR') != -1 && log.indexOf('+') != -1 && log.indexOf('+CME ERROR:58') == -1) {
				if (stack[0] && typeof stack[0].onError == 'function') {
					stack[0].onError(parseErr(log))
				}
				onStackItemDone()
			}
			if (log.indexOf('+CMT:') != -1) {
				nextIsSms = true
			}
			if (log.indexOf('OK') != -1) {
				onOK()
			}
			str = str.substr(i, str.length)
			i = 0
		}
	}
});


port.on('open', () => {
	write('AT+CLIP=1\r')
	onOK(() => {
		write('AT+CMGF=0\r')
	})
})

app.use(require('body-parser').json())

app.get('/online', (req, res) => {
  res.json(online)
})

app.use((req, res, next) => {
  if (!online) {
    res.json({err: {
      type: 'internal',
      code: 0,
      msg: 'a6_offline'
    }})
  } else {
    next()
  }
})

app.use((req, res, next) => {
	db.getUserFromToken(req.get('Token'), (err, usr) => {
		if (err || !usr) {
			return res.json({
				err: {
					type: 'internal',
					code: 2,
					msg: 'invalid_token'
				}
			})
		}
		req.locals = usr
		next()
	})
})

app.use('/adm', require('./adm.js'))

app.post('/call', (req, res) => {
	//download file

  if (!authorizedNumber(req.body.number)) {
    res.json({
      err: {
        type: 'internal',
        code: 6,
        msg: 'invalid_number'
      }
    })
    return
  }

	var id = utils.uid(32)
	addToStack({
		a: 'call',
		number: req.body.number,
		id: id,
		onCallAnswered: () => {
			//play music or text or cut call
			setTimeout(() => {
				if (stack[0] && stack[0].id && stack[0].id == id) {
					write('ATH\r')
				}
			}, 30000)

      res.json({
				msg: 'call_answered'
			})
		},
		onError: (err) => {
			res.json({
				err: err
			})
		},
		onCallEnded: () => {

		}
	})
	db.addCallSent(Math.floor(new Date()), req.body.number, req.locals.user)
})

app.get('/sentcalls', (req, res) => {
	db.getCalls(req.locals.user, (err, rows) => {
		if (err) {
			console.log(err)
		}
		rows.forEach(c => {
			delete c.user
		})
		res.json(rows)
	})
})

app.post('/msg', (req, res) => {
	addToStack({
		a: 'msg',
		number: req.body.number,
		text: req.body.text,
		onSent: () => {
			res.end('sent')
		},
		onError: (err) => {
			res.json({
				err: err
			})
		}
	})
	db.addMsgSent(Math.floor(new Date()), req.body.number, req.body.text, req.locals.user)
})

app.get('/sentmsgs', (req, res) => {
	db.getMsgs(req.locals.user, (err, rows) => {
		if (err) {
			console.log(err)
		}
		rows.forEach(c => {
			delete c.user
		})
		res.json(rows)
	})
})

app.post('/subscribe', (req, res) => {
	var number = req.body.number

	//check if not subscribed by other
	db.getSubscriberOrTransaction(number, (t) => {
		if (t) {
			if (t == req.locals.user) {
				return res.json({
					err: 'already used by you'
				})
			}
			return res.json({
				err: 'already used by other'
			})
		}

		//generate client_code
		var client_code = utils.code(6)
		//generate transaction_code
		var transaction_code = utils.uid(8)
		//add to db
		db.addTransaction(transaction_code, client_code, number, req.locals.user)

		res.json({
			number: number,
			transaction_code: transaction_code
		})

		//send client_code to mobile
		addToStack({
			a: 'msg',
			number: number,
			text:
`${req.locals.name} want to use your messages when you send it to this number.
To continue, use this code: ${client_code}`,
			onSent: () => {
				//send transaction_code to res
			}
		})
	})
})

app.post('/subscribe/:transaction_code', (req, res) => {
	var t = req.body.verify
	//get number form db
	db.getTransactionByCode(req.params.transaction_code, req.locals.user, (r) => {
		if (!r) {
			return res.json({
				err: 'transaction not exist'
			})
		}
		if (t != r.client_code) {
			return res.json({
				err: 'not good code'
			})
		}
		//add subscriber
		db.addSubscriber(r.number, r.user)

		res.json({
			msg: "all's good",
			number: r.number
		})

    addToStack({
			a: 'msg',
			number: r.number,
			text: `All's good!`,
			onSent: () => {
				//send transaction_code to res
			}
		})
	})
})

app.get('/status', (req, res) => {
	write('AT+CSQ\r')
	onOK(() => {
		write('AT+COPS?\r')
		onOK(() => {
			res.json({
				quality: quality,
				status: state
			})
		})
	})
})

app.post('/command', (req, res) => {
	if (req.locals.user == 'flo') {
		write(req.body.c)
	} else {
		res.json({
			err: {
				type: 'internal',
				code: 4,
				msg: 'not_authorized'
			}
		})
	}
})

function write(t, c) {
	console.log()
	console.log('PC: ' + t + '\n')
	console.log()
    port.write(t, c)
}

function onCall(num) {
	//respond
	//protect if already in communication
	console.log('CALL FROM: ' + number.max(num))
	//TODO: check subscriber
	/*if (number.std(num) == flo) {
		console.log('This is FLO!')
		addToStack({
			a: 'call_in',
			number: num,
			onError: (err) => {
			},
			onCallEnded: () => {
			}
		}, true)
		write('ATA\r')
	}*/

	db.addCallRecv(Math.floor(new Date()), number.sys(num))
}

function onMessage(msg) {
	//TODO: check subscriber
	if (msg.text.toLowerCase() == 'contact') {
		addToStack({
			a: 'msg',
			number: number.sys(msg.sender),
			text: "Madame Nadine ROUSSEAU, SIRET: 33931458500078. SMS non surtaxé."
		})
	} else if (msg.text.toLowerCase() == 'stop') {
		db.addStopped(number.sys(msg.sender))
		addToStack({
			a: 'msg',
			number: number.sys(msg.sender),
			text: 'Vous avez été supprimé de la liste de diffusion. SMS non surtaxé.'
		})
	} else {
		console.log(msg)
		if (msg.udh) {
			db.addMsgRecv(Math.floor(msg.time), msg.sender, msg.text, udh.reference_number, udh.parts, udh.current_part)
		} else {
			db.addMsgRecv(Math.floor(msg.time), msg.sender, msg.text)
		}
	}
}

function addToStack(obj, started) {
	if (started) {
		stack.unshift(obj)
	} else {
		stack.push(obj)
		if (stack.length == 1) {
			work(stack[0])
		}
	}
}

function onStackItemDone() {
	stack.shift()
	if (stack.length != 0) {
		work(stack[0])
	}
}

function work(obj) {
	console.log(obj);
	if (obj.a == 'call') {
		write('ATD' + obj.number + '\r')
	} else if (obj.a == 'msg') {
		//TODO verify number not banned
		var pdus = pdu.generate({
			receiver: obj.number,
			text: obj.text,
			encoding: '16bit'
		})
		obj.pdus = pdus
		obj.nbPdu = pdus.length
		obj.nbPduDone = 0
		smsS1()
	} else {
    console.log('error, not usable object');
    onStackItemDone()
  }
}

function smsS1() {
	var pdul = stack[0].pdus[stack[0].nbPduDone]
	stack[0].done = false
	write('AT+CMGS=' + ((pdul.length/2)-1) + '\r')
}

function smsS2() {
	if (!stack[0].done) {
		var pdul = stack[0].pdus[stack[0].nbPduDone]
		write(pdul + String.fromCharCode(26) + '\r')
		stack[0].done = true
	}
}

var okFunc
function onOK(func) {
	if (typeof func == 'function') {
		okFunc = func
		return
	}
	if (typeof okFunc == 'function') {
    online = true
		okFunc()
		okFunc = undefined
	}
}

function parseErr(log) {
	if (log.indexOf('+') != -1) {
		log = log.split('+')[1].split(' ')
		var type = log[0].toLowerCase()
		var code = parseInt(log[2])
		var msg = getMsgError(type, code)
		return {
			type: type,
			code: code,
			msg: msg
		}
	} else {
		if (log.indexOf('NO ANSWER') != -1) {
			return {
				type: 'dce',
				code: 7,
				msg: 'no answer'
			}
		}
	}
}

function getMsgError(type, code) {
	switch(type) {
		case 'cms': {
			switch(code) {
				case 500:
					return 'unknown_error'
			}
		}
	}
}

function authorizedNumber(num) {
	num = number.std(num)
	if (num && num.length == 10) {
		if (num[0] == '0' && num[1] == '1' && num[1] == '2' && num[1] == '3' && num[1] == '4' && num[1] == '5' && num[1] == '6' && num[1] == '7' && num[1] == '9') {
			return true
		}
	}
}

function estimateTimeStack() {
	if (stack.length == 0) {
		return 0
	}
	var time = 0
	//time is in ms
	stack.forEach(e => {
		if (e.a == 'call') {
			time += 30 * 1000
		}
		if (e.a == 'msg') {
			time += 5 * 1000
		}
	})
}

var number = {
	min: (nu) => {
		var p = number.parse(nu)
		return p.root
	},
	max: (nu) => {
		var p = number.parse(nu)
		return '+33' + p.root
	},
	std: (nu) => {
		var p = number.parse(nu)
		return '0' + p.root
	},
	sys: (nu) => {
		var p = number.parse(nu)
		return '33' + p.root
	},
	parse: (nu) => {
		if (nu[0] == '0' && nu.length == 10) {
			return ({
				first: nu[1],
				root: nu.substr(1, 10)
			})
		} else if (nu.substr(0, 3) == '+33' && nu.length == 12) {
			return ({
				first: nu[3],
				root: nu.substr(3, 12)
			})
		} else if (nu.substr(0, 2) == '33' && nu.length == 11) {
			return ({
				first: nu[2],
				root: nu.substr(2, 11)
			})
		}
	}
}


port.on('error', function(err) {
	console.log('Error: ', err.message);
})

app.listen(3000)
