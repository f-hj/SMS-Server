const sqlite3 = require('sqlite3').verbose();

const fs = require("fs");
const file = "data.db";
const exists = fs.existsSync(file);

const db = new sqlite3.Database(file);

db.serialize(() => {
	if (!exists) {
		console.log('Creating database...')
		db.run("CREATE TABLE msgs_recv (date INT, number TEXT, text TEXT, ref TEXT, nb_parts INT, current_part INT)")
		db.run("CREATE TABLE msgs_sent (date INT, number TEXT, text TEXT, user TEXT)")
		db.run("CREATE TABLE calls_recv (date INT, number TEXT)")
		db.run("CREATE TABLE calls_sent (date INT, number TEXT, user TEXT)")
		db.run("CREATE TABLE users (user TEXT, token TEXT, name TEXT, description TEXT)")
		db.run("CREATE TABLE subscriptions (number TEXT, user TEXT, date INT)")
		db.run("CREATE TABLE transactions (transaction_code TEXT, client_code TEST, number TEXT, user TEXT)")
		db.run("CREATE TABLE stopped (number TEXT, date INT)")
	} else {
		console.log('Restart program, delete transactions')
    db.run("DELETE FROM transactions")
	}
})

function getNow() {
	return Date.now();
}

module.exports = {
  addApplication: (user, token, name, description) => {
    db.run("INSERT INTO users (user, token, name, description) VALUES (?, ?, ?, ?)", [user, token, name, description])
  },
  getApplications: (cb) => {
    db.all("SELECT * FROM users", cb)
  },
  getTransactions: (cb) => {
    db.all("SELECT * FROM transactions", cb)
  },
  getSubscriptions: (cb) => {
    db.all("SELECT * FROM subscriptions", cb)
  },
	addSubscriber: (number, user) => {
		db.run("INSERT INTO subscriptions (number, user, date) VALUES (?, ?, ?)", [number, user, getNow()])
	},
	getSubscriberID: (number, cb) => {
		db.get("SELECT * FROM susbcriptions WHERE number = ?", [number], (err, row) => {
			if (row) {
				cb(row.user)
			} else {
				cb()
			}
		})
	},
	getTransactionByNumber: (number, cb) => {
		db.get("SELECT * FROM transactions WHERE number = ?", [number], (err, row) => {
			if (row) {
				cb(row.user)
			} else {
				cb()
			}
		})
	},
	getSubscriberOrTransaction: (number, cb) => {
		me.getSubscriberID(number, d => {
			if (d) {
				return cb(d)
			}
			me.getTransactionByNumber(number, cb)
		})
	},
	addTransaction: (transaction_code, client_code, number, user) => {
		db.run("INSERT INTO transactions (transaction_code, client_code, number, user) VALUES (?, ?, ?, ?)", [transaction_code, client_code, number, user])
	},
	getTransactionByCode: (transaction_code, user, cb) => {
		db.get("SELECT * FROM transactions WHERE transaction_code = ? AND user = ?", [transaction_code, user], (err, row) => {
			cb(row)
		})
	},
	getUserFromToken: (token, cb) => {
		db.get("SELECT * FROM users WHERE token = ?", [token], cb)
	},
	getCalls: (user, cb) => {
		db.all("SELECT * FROM calls_sent WHERE user = ?", [user], cb)
	},
  getCallsRecv: cb => {
    db.all("SELECT * FROM calls_recv", cb)
  },
	getMsgs: (user, cb) => {
		db.all("SELECT * FROM msgs_sent WHERE user = ?", [user], cb)
	},
  getMsgsRecv: cb => {
    db.all("SELECT * FROM msgs_recv", cb)
  },
	addMsgRecv: (date, number, text, ref, nb_parts, current_part) => {
		if (!ref) {
			db.run("INSERT INTO msgs_recv (date, number, text) VALUES (?, ?, ?)", [date, number, text])
		} else {
			db.run("INSERT INTO msgs_recv (date, number, text, ref, nb_parts, current_part) VALUES (?, ?, ?, ?)", [date, number, text, ref, nb_parts, current_part])
		}
	},
	addMsgSent: (date, number, text, user) => {
		db.run("INSERT INTO msgs_sent (date, number, text, user) VALUES (?, ?, ?, ?)", [date, number, text, user])
	},
	addCallRecv: (date, number) => {
		db.run("INSERT INTO calls_recv (date, number) VALUES (?, ?)", [date, number])
	},
	addCallSent: (date, number, user) => {
		db.run("INSERT INTO calls_sent (date, number, user) VALUES (?, ?, ?)", [date, number, user])
	},
	addStopped: (num) => {
		db.run("INSERT INTO stopped (number, date) VALUES (?, ?)", [num, getNow()])
	},
  getMsgsSubscribed: (user, cb) => {
    db.all("SELECT * FROM subscriptions WHERE user = ?", [user], (err, rows) => {
      var final = []
      rows.forEach(sub => {
        db.all("SELECT * FROM msgs_recv WHERE number = ? AND date >= ?", [sub.number, sub.date], (err, rows) => {

        })
      })
    })
  }
}

var me = module.exports
